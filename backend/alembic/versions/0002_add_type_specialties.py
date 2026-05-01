"""Add hospital_type and specialties columns

Revision ID: 0002
Revises: 0001
Create Date: 2025-01-02 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "facilities",
        sa.Column("hospital_type", sa.String(50), nullable=False, server_default="Private"),
    )
    op.add_column(
        "facilities",
        sa.Column("specialties", sa.Text(), nullable=False, server_default="General"),
    )
    op.create_index("ix_facilities_hospital_type", "facilities", ["hospital_type"])


def downgrade() -> None:
    op.drop_index("ix_facilities_hospital_type", table_name="facilities")
    op.drop_column("facilities", "specialties")
    op.drop_column("facilities", "hospital_type")
