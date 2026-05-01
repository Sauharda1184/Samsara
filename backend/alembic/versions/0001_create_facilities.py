"""Create facilities table with PostGIS geometry

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "facilities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("province", sa.String(100), nullable=False),
        sa.Column("country", sa.String(100), nullable=False, server_default="Nepal"),
        sa.Column(
            "location",
            geoalchemy2.types.Geometry(geometry_type="POINT", srid=4326),
            nullable=False,
        ),
        sa.Column("verification_status", sa.String(50), nullable=False, server_default="unverified"),
        sa.Column("coordinate_source", sa.String(50), nullable=False, server_default="OSM"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_index("ix_facilities_name", "facilities", ["name"])
    op.create_index("ix_facilities_province", "facilities", ["province"])
    op.execute(
        "CREATE INDEX ix_facilities_location ON facilities USING GIST (location)"
    )


def downgrade() -> None:
    op.drop_index("ix_facilities_location", table_name="facilities")
    op.drop_index("ix_facilities_province", table_name="facilities")
    op.drop_index("ix_facilities_name", table_name="facilities")
    op.drop_table("facilities")
