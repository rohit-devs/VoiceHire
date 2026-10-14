"""Add transparent structured evaluation reports."""

from alembic import op
import sqlalchemy as sa

revision = "20261015_0030"
down_revision = "20261014_2213"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("evaluation_reports") as batch_op:
        batch_op.alter_column(
            "overall_score",
            existing_type=sa.Integer(),
            type_=sa.Float(),
            nullable=True,
        )
        for column in (
            "technical_score",
            "communication_score",
            "confidence_score",
            "clarity_score",
            "relevance_score",
            "problem_solving_score",
            "seven_day_coaching_plan",
        ):
            batch_op.alter_column(column, existing_nullable=False, nullable=True)
        batch_op.add_column(
            sa.Column("status", sa.String(length=30), nullable=False, server_default="processing")
        )
        batch_op.add_column(sa.Column("rubric_version", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("measured_metrics", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("ai_assessments", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("error", sa.Text(), nullable=True))

    legacy_report = sa.table(
        "evaluation_reports",
        sa.column("rubric_version", sa.String(length=50)),
        sa.column("measured_metrics", sa.JSON()),
        sa.column("status", sa.String(length=30)),
        sa.column("error", sa.Text()),
    )
    unavailable = {
        "speaking_duration_seconds": {
            "value": None,
            "unit": "seconds",
            "reason": "Legacy reports do not contain verified transcript timing.",
        },
        "words_per_minute": {
            "value": None,
            "unit": "words/minute",
            "reason": "Legacy reports do not contain verified transcript timing.",
        },
        "filler_word_rate": {
            "value": None,
            "unit": "filler words / total words",
            "reason": "Legacy reports do not contain verified transcript evidence.",
        },
        "answer_length_words": {
            "value": None,
            "unit": "words/answer",
            "reason": "Legacy reports do not contain verified transcript evidence.",
        },
        "time_remaining_seconds": {
            "value": None,
            "unit": "seconds",
            "reason": "Legacy reports do not contain verified session timing.",
        },
        "questions_answered": {
            "value": None,
            "unit": "questions",
            "reason": "Legacy reports do not contain verified question-answer pairs.",
        },
        "answer_lengths_by_question": {
            "value": None,
            "unit": "words",
            "reason": "Legacy reports do not contain verified question-answer pairs.",
        },
        "filler_word_language_lists": {},
    }
    op.get_bind().execute(
        legacy_report.update()
        .where(legacy_report.c.rubric_version.is_(None))
        .values(
            rubric_version="legacy-unversioned",
            measured_metrics=unavailable,
            status="insufficient_data",
            error="Legacy evaluation has no schema-validated evidence; no AI assessment is available.",
        )
    )
    with op.batch_alter_table("evaluation_reports") as batch_op:
        batch_op.alter_column(
            "rubric_version", existing_type=sa.String(length=50), nullable=False
        )
        batch_op.alter_column("measured_metrics", existing_type=sa.JSON(), nullable=False)
        batch_op.alter_column(
            "status",
            existing_type=sa.String(length=30),
            server_default=None,
        )
    with op.batch_alter_table("coaching_plans") as batch_op:
        batch_op.create_unique_constraint(
            "uq_coaching_plans_report", ["evaluation_report_id"]
        )


def downgrade() -> None:
    with op.batch_alter_table("coaching_plans") as batch_op:
        batch_op.drop_constraint("uq_coaching_plans_report", type_="unique")
    with op.batch_alter_table("evaluation_reports") as batch_op:
        batch_op.drop_column("error")
        batch_op.drop_column("ai_assessments")
        batch_op.drop_column("measured_metrics")
        batch_op.drop_column("rubric_version")
        batch_op.drop_column("status")
        for column in (
            "technical_score",
            "communication_score",
            "confidence_score",
            "clarity_score",
            "relevance_score",
            "problem_solving_score",
            "seven_day_coaching_plan",
        ):
            batch_op.alter_column(column, existing_nullable=True, nullable=False)
        batch_op.alter_column(
            "overall_score",
            existing_type=sa.Float(),
            type_=sa.Integer(),
            nullable=False,
        )
