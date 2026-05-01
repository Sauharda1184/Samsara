from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class FacilityResponse(BaseModel):
    id: UUID
    name: str
    province: str
    country: str
    latitude: float
    longitude: float
    verification_status: str
    coordinate_source: str
    hospital_type: str
    specialties: str
    total_beds: int
    available_beds: int
    total_doctors: int
    emergency_services: bool
    phone: Optional[str]
    established_year: Optional[int]
    accreditation: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FacilityNearbyResponse(FacilityResponse):
    distance_km: float


class FacilityUpdate(BaseModel):
    verification_status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class HealthResponse(BaseModel):
    status: str
    database: str
