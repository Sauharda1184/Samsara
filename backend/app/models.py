import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from .database import Base


class Facility(Base):
    __tablename__ = "facilities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False, index=True)
    province = Column(String(100), nullable=False, index=True)
    country = Column(String(100), nullable=False, default="Nepal")
    location = Column(Geometry("POINT", srid=4326), nullable=False)
    verification_status = Column(String(50), nullable=False, default="unverified")
    coordinate_source = Column(String(50), nullable=False, default="OSM")
    hospital_type = Column(String(50), nullable=False, default="Private", index=True)
    specialties = Column(Text, nullable=False, default="General")
    total_beds = Column(Integer, nullable=False, default=0)
    available_beds = Column(Integer, nullable=False, default=0)
    total_doctors = Column(Integer, nullable=False, default=0)
    emergency_services = Column(Boolean, nullable=False, default=False)
    phone = Column(String(50), nullable=True)
    established_year = Column(Integer, nullable=True)
    accreditation = Column(String(100), nullable=False, default="None")
    services = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
