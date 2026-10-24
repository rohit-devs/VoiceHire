"""rename clerk_id to guest_id on users

Revision ID: f7bb771e8172
Revises: 20261015_0040
Create Date: 2026-10-24 12:45:34.955149
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f7bb771e8172'
down_revision: Union[str, None] = '20261015_0040'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column("clerk_id", new_column_name="guest_id")


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column("guest_id", new_column_name="clerk_id")
