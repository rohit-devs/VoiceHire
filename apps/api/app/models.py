"""Authoritative SQLAlchemy schema for the VoiceHire API."""

from __future__ import annotations

import uuid
from datetime import datetime
from datetime import date
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base metadata for Alembic and application models."""


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


def _id() -> str:
    return str(uuid.uuid4())


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (Index("ix_users_created_at", "created_at"),)

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=_id)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    clerk_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    llm_tokens_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class CandidateProfile(TimestampMixin, Base):
    __tablename__ = "candidate_profiles"
    __table_args__ = (
        Index("ix_candidate_profiles_user_created", "user_id", "created_at"),
        Index("ix_candidate_profiles_target_role", "target_role"),
    )

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    target_role: Mapped[str] = mapped_column(String(100), nullable=False)
    experience_level: Mapped[str | None] = mapped_column(String(50))
    skills: Mapped[list[str] | None] = mapped_column(JSON)
    parsed_resume_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    resume_file_url: Mapped[str | None] = mapped_column(Text)


class JobDescription(TimestampMixin, Base):
    __tablename__ = "job_descriptions"
    __table_args__ = (
        Index("ix_job_descriptions_created_at", "created_at"),
        Index("ix_job_descriptions_role_title", "role_title"),
    )

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=_id)
    role_title: Mapped[str] = mapped_column(String(100), nullable=False)
    company_name: Mapped[str | None] = mapped_column(String(100))
    competencies: Mapped[list[str] | None] = mapped_column(JSON)
    description_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(
        Text().with_variant(Vector(1536), "postgresql")
    )
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON)


Index(
    "ix_job_descriptions_embedding",
    JobDescription.embedding,
    postgresql_using="ivfflat",
    postgresql_ops={"embedding": "vector_cosine_ops"},
    postgresql_with={"lists": 100},
).ddl_if(dialect="postgresql")


class InterviewSession(TimestampMixin, Base):
    __tablename__ = "interview_sessions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('created', 'ready', 'connecting', 'interviewing', "
            "'processing_response', 'completed', 'failed', 'cancelled')",
            name="ck_interview_sessions_status",
        ),
        CheckConstraint(
            "current_state IN ('created', 'ready', 'connecting', 'interviewing', "
            "'processing_response', 'completed', 'failed', 'cancelled')",
            name="ck_interview_sessions_state",
        ),
        CheckConstraint(
            "difficulty IN ('easy', 'medium', 'hard')", name="ck_interview_sessions_difficulty"
        ),
        Index("ix_interview_sessions_user_created", "user_id", "created_at"),
        Index("ix_interview_sessions_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    candidate_profile_id: Mapped[str | None] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="SET NULL")
    )
    role: Mapped[str] = mapped_column(String(100), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(50), nullable=False, default="medium")
    agora_channel: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    agora_channel_uid: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="created")
    current_state: Mapped[str] = mapped_column(String(50), nullable=False, default="created")
    persona: Mapped[str] = mapped_column(String(50), nullable=False, default="technical")
    interview_type: Mapped[str] = mapped_column(String(50), nullable=False, default="mixed")
    requested_duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=1800)
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    question_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    llm_tokens_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    state_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    state_history: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    interview_blueprint: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON)


class Transcript(TimestampMixin, Base):
    __tablename__ = "transcripts"
    __table_args__ = (
        CheckConstraint("speaker IN ('candidate', 'interviewer')", name="ck_transcripts_speaker"),
        Index("ix_transcripts_session_created", "session_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False
    )
    speaker: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    filler_word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    filler_words: Mapped[list[str] | None] = mapped_column(JSON)
    words_per_minute: Mapped[int | None] = mapped_column(Integer)
    pause_duration_ms: Mapped[int | None] = mapped_column(Integer)
    confidence_score: Mapped[float | None] = mapped_column(Float)
    clarity_score: Mapped[float | None] = mapped_column(Float)
    relevance_score: Mapped[float | None] = mapped_column(Float)
    timestamp_ms: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="real")


class EvaluationReport(TimestampMixin, Base):
    __tablename__ = "evaluation_reports"
    __table_args__ = (
        Index("ix_evaluation_reports_session_created", "session_id", "created_at"),
        Index("ix_evaluation_reports_overall_score", "overall_score"),
    )

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=_id)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    technical_score: Mapped[int] = mapped_column(Integer, nullable=False)
    communication_score: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence_score: Mapped[int] = mapped_column(Integer, nullable=False)
    clarity_score: Mapped[int] = mapped_column(Integer, nullable=False)
    relevance_score: Mapped[int] = mapped_column(Integer, nullable=False)
    problem_solving_score: Mapped[int] = mapped_column(Integer, nullable=False)
    communication_fingerprint: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    seven_day_coaching_plan: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    top_weakness: Mapped[str | None] = mapped_column(Text)
    top_strength: Mapped[str | None] = mapped_column(Text)
    recommendation: Mapped[str | None] = mapped_column(Text)
    detailed_feedback: Mapped[dict[str, Any] | None] = mapped_column(JSON)


class InterviewAnalytics(TimestampMixin, Base):
    __tablename__ = "interview_analytics"
    __table_args__ = (
        Index("ix_interview_analytics_session_created", "session_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=_id)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    avg_words_per_minute: Mapped[int | None] = mapped_column(Integer)
    avg_pause_duration_ms: Mapped[int | None] = mapped_column(Integer)
    total_filler_words: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    filler_word_frequency: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    technical_accuracy_percentage: Mapped[float | None] = mapped_column(Float)
    answer_relevance_percentage: Mapped[float | None] = mapped_column(Float)
    interruption_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    state_transitions: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    difficulty_adjustments: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class SessionStateSnapshot(TimestampMixin, Base):
    __tablename__ = "session_state_snapshots"
    __table_args__ = (Index("ix_session_snapshots_session_created", "session_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=_id)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False
    )
    state: Mapped[str] = mapped_column(String(50), nullable=False)
    timestamp_ms: Mapped[int | None] = mapped_column(Integer)
    candidate_response_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    ai_evaluation_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    metrics_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSON)


class AgoraEventLog(TimestampMixin, Base):
    __tablename__ = "agora_events_log"
    __table_args__ = (Index("ix_agora_events_log_session_created", "session_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=_id)
    session_id: Mapped[str | None] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE")
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    event_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    user_uid: Mapped[int | None] = mapped_column(Integer)
    timestamp_ms: Mapped[int | None] = mapped_column(Integer)


class CoachingPlan(TimestampMixin, Base):
    __tablename__ = "coaching_plans"
    __table_args__ = (Index("ix_coaching_plans_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    evaluation_report_id: Mapped[str | None] = mapped_column(
        ForeignKey("evaluation_reports.id", ondelete="CASCADE")
    )
    plan_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    completed_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    progress_notes: Mapped[dict[str, Any] | None] = mapped_column(JSON)


class IdempotencyRecord(TimestampMixin, Base):
    __tablename__ = "idempotency_records"
    __table_args__ = (
        UniqueConstraint("user_id", "operation", "idempotency_key", name="uq_idempotency_scope"),
        Index("ix_idempotency_user_created", "user_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    operation: Mapped[str] = mapped_column(String(100), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(255))
    response_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
