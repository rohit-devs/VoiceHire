"""Persist default interview preferences on users."""

from alembic import op
import sqlalchemy as sa

revision = "20261015_0040"
down_revision = "20261015_0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("background", sa.Text(), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "default_interview_persona",
                sa.String(length=50),
                nullable=False,
                server_default="technical_lead",
            )
        )
        batch_op.add_column(
            sa.Column(
                "default_interview_difficulty",
                sa.String(length=20),
                nullable=False,
                server_default="medium",
            )
        )
def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("default_interview_difficulty")
        batch_op.drop_column("default_interview_persona")
        batch_op.drop_column("background")
