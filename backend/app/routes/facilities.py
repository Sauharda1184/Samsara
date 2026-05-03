from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import FacilityNearbyResponse, FacilityResponse, FacilityUpdate

router = APIRouter(prefix="/facilities", tags=["facilities"])

_SELECT = """
    SELECT id, name, province, country, verification_status, coordinate_source,
           hospital_type, specialties, total_beds, available_beds, total_doctors,
           emergency_services, phone, established_year, accreditation, services,
           facility_category, created_at,
           ST_Y(location) AS latitude, ST_X(location) AS longitude
    FROM facilities
"""


def _row_to_response(row) -> FacilityResponse:
    return FacilityResponse(
        id=row.id,
        name=row.name,
        province=row.province,
        country=row.country,
        latitude=float(row.latitude),
        longitude=float(row.longitude),
        verification_status=row.verification_status,
        coordinate_source=row.coordinate_source,
        hospital_type=row.hospital_type,
        specialties=row.specialties,
        total_beds=row.total_beds,
        available_beds=row.available_beds,
        total_doctors=row.total_doctors,
        emergency_services=row.emergency_services,
        phone=row.phone,
        established_year=row.established_year,
        accreditation=row.accreditation,
        services=row.services,
        facility_category=row.facility_category,
        created_at=row.created_at,
    )


@router.get("/search", response_model=List[FacilityResponse])
def search_facilities(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    rows = db.execute(
        text(f"{_SELECT} WHERE name ILIKE :q ORDER BY name"),
        {"q": f"%{q}%"},
    ).fetchall()
    return [_row_to_response(r) for r in rows]


@router.get("/nearby", response_model=List[FacilityNearbyResponse])
def nearby_facilities(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(default=50.0, gt=0, le=500),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT id, name, province, country, verification_status, coordinate_source,
                   hospital_type, specialties, created_at,
                   total_beds, available_beds, total_doctors,
                   emergency_services, phone, established_year, accreditation, services,
                   facility_category,
                   ST_Y(location) AS latitude,
                   ST_X(location) AS longitude,
                   ST_Distance(
                       location::geography,
                       ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                   ) / 1000.0 AS distance_km
            FROM facilities
            WHERE ST_DWithin(
                location::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radius_m
            )
            ORDER BY distance_km
            """
        ),
        {"lat": lat, "lon": lon, "radius_m": radius_km * 1000},
    ).fetchall()

    return [
        FacilityNearbyResponse(
            id=r.id,
            name=r.name,
            province=r.province,
            country=r.country,
            latitude=float(r.latitude),
            longitude=float(r.longitude),
            verification_status=r.verification_status,
            coordinate_source=r.coordinate_source,
            hospital_type=r.hospital_type,
            specialties=r.specialties,
            total_beds=r.total_beds,
            available_beds=r.available_beds,
            total_doctors=r.total_doctors,
            emergency_services=r.emergency_services,
            phone=r.phone,
            established_year=r.established_year,
            accreditation=r.accreditation,
            services=r.services,
            facility_category=r.facility_category,
            created_at=r.created_at,
            distance_km=round(float(r.distance_km), 2),
        )
        for r in rows
    ]


@router.get("/province", response_model=List[FacilityResponse])
def facilities_by_province(name: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    rows = db.execute(
        text(f"{_SELECT} WHERE province ILIKE :name ORDER BY name"),
        {"name": name},
    ).fetchall()
    return [_row_to_response(r) for r in rows]


@router.get("/specialty", response_model=List[FacilityResponse])
def facilities_by_specialty(name: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    rows = db.execute(
        text(f"{_SELECT} WHERE specialties ILIKE :name ORDER BY name"),
        {"name": f"%{name}%"},
    ).fetchall()
    return [_row_to_response(r) for r in rows]


@router.get("", response_model=List[FacilityResponse])
def list_facilities(db: Session = Depends(get_db)):
    rows = db.execute(
        text(f"{_SELECT} ORDER BY province, name")
    ).fetchall()
    return [_row_to_response(r) for r in rows]


@router.get("/bounds", response_model=List[FacilityResponse])
def facilities_by_bounds(
    lat_min: float = Query(..., ge=-90, le=90),
    lat_max: float = Query(..., ge=-90, le=90),
    lon_min: float = Query(..., ge=-180, le=180),
    lon_max: float = Query(..., ge=-180, le=180),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            f"{_SELECT} WHERE ST_Within("
            "location, ST_MakeEnvelope(:lon_min, :lat_min, :lon_max, :lat_max, 4326)"
            ") ORDER BY province, name"
        ),
        {"lat_min": lat_min, "lat_max": lat_max, "lon_min": lon_min, "lon_max": lon_max},
    ).fetchall()
    return [_row_to_response(r) for r in rows]


@router.get("/{facility_id}", response_model=FacilityResponse)
def get_facility(facility_id: UUID, db: Session = Depends(get_db)):
    row = db.execute(
        text(f"{_SELECT} WHERE id = :id"),
        {"id": str(facility_id)},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Facility not found")
    return _row_to_response(row)


@router.patch("/{facility_id}", response_model=FacilityResponse)
def update_facility(facility_id: UUID, payload: FacilityUpdate, db: Session = Depends(get_db)):
    row = db.execute(
        text(f"{_SELECT} WHERE id = :id"),
        {"id": str(facility_id)},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Facility not found")

    updates = []
    params: dict = {"id": str(facility_id)}

    if payload.verification_status is not None:
        updates.append("verification_status = :verification_status")
        params["verification_status"] = payload.verification_status

    if payload.latitude is not None and payload.longitude is not None:
        updates.append("location = ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)")
        params["lat"] = payload.latitude
        params["lon"] = payload.longitude

    if updates:
        updates.append("updated_at = now()")
        db.execute(
            text(f"UPDATE facilities SET {', '.join(updates)} WHERE id = :id"),
            params,
        )
        db.commit()

    updated = db.execute(
        text(f"{_SELECT} WHERE id = :id"),
        {"id": str(facility_id)},
    ).fetchone()
    return _row_to_response(updated)
