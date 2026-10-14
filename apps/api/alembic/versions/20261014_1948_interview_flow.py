"""Add safe interview lifecycle, demo isolation, and token accounting."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261014_1948"
down_revision: Union[str, None] = "e7f663ed59d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("interview_sessions") as batch_op:
        batch_op.drop_constraint("ck_interview_sessions_status", type_="check")
        batch_op.drop_constraint("ck_interview_sessions_difficulty", type_="check")

    op.execute(
        sa.text(
            "UPDATE interview_sessions SET "
            "status = CASE "
            "WHEN status = 'scheduled' THEN 'created' "
            "WHEN status = 'active' THEN 'interviewing' "
            "ELSE status END, "
            "current_state = CASE "
            "WHEN status = 'completed' THEN 'completed' "
            "WHEN status = 'cancelled' THEN 'cancelled' "
            "WHEN status = 'active' THEN 'interviewing' "
            "ELSE 'created' END"
        )
    )

    with op.batch_alter_table("interview_sessions") as batch_op:
        batch_op.add_column(
            sa.Column("interview_type", sa.String(50), server_default="mixed", nullable=False)
        )
        batch_op.add_column(
            sa.Column(
                "requested_duration_seconds", sa.Integer(), server_default="1800", nullable=False
            )
        )
        batch_op.add_column(
            sa.Column("is_demo", sa.Boolean(), server_default=sa.false(), nullable=False)
        )
        batch_op.add_column(
            sa.Column("question_count", sa.Integer(), server_default="0", nullable=False)
        )
        batch_op.add_column(
            sa.Column("llm_tokens_used", sa.Integer(), server_default="0", nullable=False)
        )
        batch_op.add_column(
            sa.Column(
                "state_updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.current_timestamp(),
                nullable=False,
            )
        )
        batch_op.add_column(
            sa.Column("state_history", sa.JSON(), server_default="[]", nullable=False)
        )
        batch_op.alter_column("status", server_default="created")
        batch_op.alter_column("current_state", server_default="created")
        batch_op.create_check_constraint(
            "ck_interview_sessions_status",
            "status IN ('created', 'ready', 'connecting', 'interviewing', "
            "'processing_response', 'completed', 'failed', 'cancelled')",
        )
        batch_op.create_check_constraint(
            "ck_interview_sessions_state",
            "current_state IN ('created', 'ready', 'connecting', 'interviewing', "
            "'processing_response', 'completed', 'failed', 'cancelled')",
        )
        batch_op.create_check_constraint(
            "ck_interview_sessions_difficulty", "difficulty IN ('easy', 'medium', 'hard')"
        )

    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("llm_tokens_used", sa.Integer(), server_default="0", nullable=False)
        )
    with op.batch_alter_table("transcripts") as batch_op:
        batch_op.add_column(
            sa.Column("source", sa.String(20), server_default="real", nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("transcripts") as batch_op:
        batch_op.drop_column("source")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("llm_tokens_used")

    with op.batch_alter_table("interview_sessions") as batch_op:
        batch_op.drop_constraint("ck_interview_sessions_state", type_="check")
        batch_op.drop_constraint("ck_interview_sessions_status", type_="check")
        batch_op.drop_constraint("ck_interview_sessions_difficulty", type_="check")

    op.execute(
        sa.text(
            "UPDATE interview_sessions SET "
            "status = CASE WHEN status IN ('created', 'ready', 'connecting') THEN 'scheduled' "
            "WHEN status IN ('interviewing', 'processing_response') THEN 'active' "
            "ELSE status END, "
            "current_state = CASE WHEN status IN ('created', 'ready', 'connecting') THEN 'intro' "
            "WHEN status IN ('interviewing', 'processing_response') THEN 'intro' "
            "ELSE current_state END"
        )
    )

    with op.batch_alter_table("interview_sessions") as batch_op:
        batch_op.drop_column("state_history")
        batch_op.drop_column("state_updated_at")
        batch_op.drop_column("llm_tokens_used")
        batch_op.drop_column("question_count")
        batch_op.drop_column("is_demo")
        batch_op.drop_column("requested_duration_seconds")
        batch_op.drop_column("interview_type")
        batch_op.alter_column("status", server_default="scheduled")
        batch_op.alter_column("current_state", server_default="intro")
        batch_op.create_check_constraint(
            "ck_interview_sessions_status",
            "status IN ('scheduled', 'active', 'completed', 'cancelled')",
        )
        batch_op.create_check_constraint(
            "ck_interview_sessions_difficulty", "difficulty IN ('easy', 'medium', 'hard')"
        )
