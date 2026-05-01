"""Add hospital operational details

Revision ID: 0003
Revises: 0002
Create Date: 2025-01-03 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("facilities", sa.Column("total_beds", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("facilities", sa.Column("available_beds", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("facilities", sa.Column("total_doctors", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("facilities", sa.Column("emergency_services", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("facilities", sa.Column("phone", sa.String(50), nullable=True))
    op.add_column("facilities", sa.Column("established_year", sa.Integer(), nullable=True))
    op.add_column("facilities", sa.Column("accreditation", sa.String(100), nullable=False, server_default="None"))


def downgrade() -> None:
    for col in ["accreditation", "established_year", "phone",
                "emergency_services", "total_doctors", "available_beds", "total_beds"]:
        op.drop_column("facilities", col)
