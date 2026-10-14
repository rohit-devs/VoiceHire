"""Persist transcript event identity and speech timing."""

from alembic import op
import sqlalchemy as sa
import uuid

revision = "20261014_2213"
down_revision = "20261014_1948"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("transcripts") as batch_op:
        batch_op.add_column(sa.Column("message_id", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("duration_ms", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column("language", sa.String(length=10), server_default="en", nullable=True)
        )

    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id FROM transcripts WHERE message_id IS NULL"))
    for row in rows:
        connection.execute(
            sa.text("UPDATE transcripts SET message_id = :message_id WHERE id = :id"),
            {"message_id": str(uuid.uuid4()), "id": row.id},
        )

    with op.batch_alter_table("transcripts") as batch_op:
        batch_op.alter_column("message_id", existing_type=sa.String(length=36), nullable=False)
        batch_op.alter_column(
            "language",
            existing_type=sa.String(length=10),
            nullable=False,
            server_default="en",
        )
        batch_op.create_unique_constraint("uq_transcripts_message_id", ["message_id"])


def downgrade() -> None:
    with op.batch_alter_table("transcripts") as batch_op:
        batch_op.drop_constraint("uq_transcripts_message_id", type_="unique")
        batch_op.drop_column("language")
        batch_op.drop_column("duration_ms")
        batch_op.drop_column("message_id")
