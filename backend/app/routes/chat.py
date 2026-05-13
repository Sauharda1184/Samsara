from typing import AsyncIterator

import anthropic
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db

router = APIRouter(prefix="/chat", tags=["chat"])

SYSTEM_PROMPT = """You are Samsara's friendly health guide — a warm, caring assistant helping people in Nepal find the right medical care.

Your personality:
- Direct and warm. Get to the point fast.
- No lengthy intros, no "Great question!", no closing questions.
- Simple words. Assume the user is on a slow phone.

Response format rules — keep it SHORT:
- 3–5 lines max for general questions. No preamble, no sign-off.
- For hospital recommendations: list up to 3 facilities, one line each (name, distance, one reason). Nothing else.
- End with ONE next step sentence. No follow-up questions.
- Never use headers. Use a dash list only when listing facilities.
- Total response must fit on a phone screen without scrolling.

Critical rules:
- Never diagnose. Always say "a doctor will be able to confirm" for anything clinical.
- ALWAYS respond in the exact language the user typed their message in. If the message is in English, reply entirely in English. If the message is in Nepali script, reply in Nepali. Default to English if unsure.
- For emergencies always mention: 102 (ambulance) or 1166 (health helpline).
- Only mention facilities from the nearby list provided — never invent names or details.
- If no nearby list is given, give general guidance about hospital types.

Nepal health system (use this to guide people):
- Healthpost: free, basic care, good for minor issues and referrals
- Clinic: small private, outpatient care, quick but costs a little
- Government hospital: free or cheap, may be crowded, good for serious issues
- Teaching hospital: best specialists and equipment, usually in cities
- Private hospital: faster, more comfortable, but more expensive
"""


class ChatRequest(BaseModel):
    message: str
    lat: float | None = None
    lon: float | None = None


def get_nearby_context(lat: float, lon: float, db: Session) -> str:
    rows = db.execute(
        text("""
            SELECT name, hospital_type, facility_category, specialties,
                   emergency_services, available_beds, total_beds, services,
                   ROUND((ST_Distance(
                       location::geography,
                       ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                   ) / 1000.0)::numeric, 1) AS distance_km
            FROM facilities
            WHERE ST_DWithin(
                location::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                10000
            )
            ORDER BY distance_km
            LIMIT 10
        """),
        {"lat": lat, "lon": lon},
    ).fetchall()

    if not rows:
        return "No facilities found within 10km of the user's location."

    lines = ["Nearby facilities (within 10km):"]
    for r in rows:
        emergency = "Yes" if r.emergency_services else "No"
        lines.append(
            f"- {r.name} ({r.facility_category}, {r.hospital_type}) — "
            f"{r.distance_km}km away | Emergency: {emergency} | "
            f"Available beds: {r.available_beds}/{r.total_beds} | "
            f"Services: {r.services or 'General'}"
        )
    return "\n".join(lines)


async def stream_response(message: str, context: str) -> AsyncIterator[str]:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_key)

    full_system = SYSTEM_PROMPT
    if context:
        full_system += f"\n\n{context}"

    async with client.messages.stream(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=full_system,
        messages=[{"role": "user", "content": message}],
    ) as stream:
        async for text_chunk in stream.text_stream:
            yield text_chunk


@router.post("")
async def chat(req: ChatRequest, db: Session = Depends(get_db)):
    context = ""
    if req.lat is not None and req.lon is not None:
        context = get_nearby_context(req.lat, req.lon, db)

    return StreamingResponse(
        stream_response(req.message, context),
        media_type="text/plain",
    )
