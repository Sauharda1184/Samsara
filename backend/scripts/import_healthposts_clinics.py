#!/usr/bin/env python3
"""
Fetch health posts and clinics from OpenStreetMap Overpass API and import into PostgreSQL.

Usage:
    uv run python scripts/import_healthposts_clinics.py

Clears existing Healthpost/Clinic rows before inserting, so safe to re-run.
Requires migration 0005 (facility_category column) to have been applied.
"""

import hashlib
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# Nepal bounding box: south, west, north, east
NEPAL_BBOX = "26.3,80.0,30.5,88.3"

OVERPASS_QUERIES = {
    "Healthpost": f"""
        [out:json][timeout:60];
        (
          node["healthcare"="health_post"]({NEPAL_BBOX});
          node["amenity"="health_post"]({NEPAL_BBOX});
          way["healthcare"="health_post"]({NEPAL_BBOX});
        );
        out center;
    """,
    "Clinic": f"""
        [out:json][timeout:60];
        (
          node["healthcare"="clinic"]({NEPAL_BBOX});
          node["amenity"="clinic"]({NEPAL_BBOX});
          way["healthcare"="clinic"]({NEPAL_BBOX});
        );
        out center;
    """,
}


def _h(seed: str, lo: int, hi: int) -> int:
    n = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    return lo + (n % (hi - lo + 1))


def simulate_data(name: str, category: str) -> dict:
    if category == "Healthpost":
        total_beds = _h(f"{name}:beds", 2, 20)
        total_docs = _h(f"{name}:docs", 1, 5)
    else:
        total_beds = _h(f"{name}:beds", 5, 30)
        total_docs = _h(f"{name}:docs", 2, 15)
    avail = _h(f"{name}:avail", max(1, total_beds // 5), max(1, total_beds // 2))
    emergency = _h(f"{name}:emerg", 0, 99) < (30 if category == "Healthpost" else 20)
    area = _h(f"{name}:area", 1, 99)
    number = _h(f"{name}:num", 1000000, 9999999)
    year = _h(f"{name}:year", 1970, 2015)
    return {
        "total_beds": total_beds,
        "available_beds": avail,
        "total_doctors": total_docs,
        "emergency_services": emergency,
        "phone": f"0{area:02d}-{number}",
        "established_year": year,
    }


def get_province(lat: float, lon: float) -> str:
    """Rough province assignment using approximate bounding boxes."""
    if lon >= 86.5:
        return "Province 1"
    if lon >= 85.7 and lat >= 27.5:
        return "Province 1"
    if lon >= 85.7 and lat < 27.5:
        return "Madhes"
    if 84.0 <= lon < 86.5 and lat < 27.5:
        return "Madhes"
    if 84.0 <= lon < 86.5 and lat >= 27.5:
        return "Bagmati"
    if 82.8 <= lon < 84.0 and lat >= 27.5:
        return "Gandaki"
    if 81.7 <= lon < 84.0 and lat < 27.5:
        return "Lumbini"
    if 81.0 <= lon < 82.8 and lat >= 28.0:
        return "Karnali"
    return "Sudurpaschim"


def fetch_overpass(query: str) -> list:
    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(
        url, data=data, headers={"User-Agent": "SamsaraHealthNepal/1.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read())["elements"]
    except Exception as e:
        print(f"  Overpass error: {e}")
        return []


def main():
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed. Run: uv sync")
        sys.exit(1)

    db_url = os.getenv("DATABASE_URL", "postgresql://samsara:samsara@localhost:5432/samsara")
    print(f"Connecting to: {db_url}")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute("DELETE FROM facilities WHERE facility_category IN ('Healthpost', 'Clinic')")
    deleted = cur.rowcount
    print(f"Cleared {deleted} existing Healthpost/Clinic rows.")

    total_inserted = 0

    for category, query in OVERPASS_QUERIES.items():
        print(f"\nFetching {category}s from Overpass API...")
        elements = fetch_overpass(query)
        print(f"  Received {len(elements)} elements")

        inserted = skipped = 0
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name") or tags.get("name:en") or tags.get("name:ne")
            if not name:
                skipped += 1
                continue

            if el["type"] == "node":
                lat, lon = el["lat"], el["lon"]
            elif el["type"] == "way" and "center" in el:
                lat, lon = el["center"]["lat"], el["center"]["lon"]
            else:
                skipped += 1
                continue

            province = get_province(lat, lon)
            sim = simulate_data(name, category)

            cur.execute(
                """
                INSERT INTO facilities
                    (id, name, province, country, location,
                     verification_status, coordinate_source,
                     hospital_type, specialties, facility_category,
                     total_beds, available_beds, total_doctors,
                     emergency_services, phone, established_year,
                     accreditation, services)
                VALUES (
                    %s, %s, %s, 'Nepal',
                    ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                    'verified', 'OSM', 'Community', 'General', %s,
                    %s, %s, %s, %s, %s, %s, 'None', ''
                )
                """,
                (
                    str(uuid.uuid4()), name, province, lon, lat,
                    category,
                    sim["total_beds"], sim["available_beds"], sim["total_doctors"],
                    sim["emergency_services"], sim["phone"], sim["established_year"],
                ),
            )
            inserted += 1

        print(f"  {inserted} inserted, {skipped} skipped (no name or coordinates)")
        total_inserted += inserted

        if category == "Healthpost":
            print("  Pausing 3s before next Overpass request...")
            time.sleep(3)

    conn.commit()
    cur.close()
    conn.close()
    print(f"\nDone. Total inserted: {total_inserted}")


if __name__ == "__main__":
    main()
