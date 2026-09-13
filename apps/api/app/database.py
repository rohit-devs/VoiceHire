"""
Flexible database: uses PostgreSQL if available, otherwise SQLite (zero setup).
"""
import os
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import text

from app.config import settings

# ── Engine setup ──
if settings.is_postgres:
    # PostgreSQL + asyncpg
    db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(
        db_url,
        poolclass=NullPool,  # Simple for dev; remove for production pooling
        echo=False,
    )
else:
    # SQLite + aiosqlite (zero config, file-based)
    db_url = settings.DATABASE_URL
    if not db_url.startswith("sqlite"):
        db_url = "sqlite+aiosqlite:///./voicehire_demo.db"
    # Ensure directory exists
    db_path = db_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
    os.makedirs(os.path.dirname(os.path.abspath(db_path)) if os.path.dirname(db_path) else ".", exist_ok=True)
    engine = create_async_engine(db_url, poolclass=NullPool)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    """FastAPI dependency: yields an async DB session with auto-cleanup."""
    session = async_session()
    try:
        yield session
    except Exception as exc:
        await session.rollback()
        raise exc
    finally:
        await session.close()


async def init_db():
    """Create tables from schema.sql if using Postgres, or auto-create for SQLite."""
    try:
        if settings.is_postgres:
            # Read raw schema.sql
            schema_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "databases", "schema.sql")
            if os.path.exists(schema_path):
                with open(schema_path, "r") as f:
                    raw = f.read()
                async with engine.begin() as conn:
                    # Split by semicolon but skip empty blocks
                    for statement in raw.split(";"):
                        stmt = statement.strip()
                        if stmt and not stmt.startswith("--"):
                            await conn.execute(text(stmt))
                print("[DB] PostgreSQL schema initialized")
            else:
                print("[DB] schema.sql not found, skipping")
        else:
            # SQLite: auto-create core tables simply
            async with engine.begin() as conn:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        email TEXT UNIQUE,
                        clerk_id TEXT UNIQUE,
                        first_name TEXT,
                        last_name TEXT,
                        avatar_url TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS interview_sessions (
                        id TEXT PRIMARY KEY,
                        user_id TEXT,
                        role TEXT,
                        difficulty TEXT,
                        agora_channel TEXT UNIQUE,
                        status TEXT DEFAULT 'scheduled',
                        current_state TEXT DEFAULT 'intro',
                        persona TEXT,
                        started_at TIMESTAMP,
                        ended_at TIMESTAMP,
                        duration_seconds INTEGER,
                        interview_blueprint TEXT,
                        metadata TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS transcripts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id TEXT,
                        speaker TEXT,
                        message TEXT,
                        filler_word_count INTEGER DEFAULT 0,
                        filler_words TEXT,
                        words_per_minute INTEGER,
                        pause_duration_ms INTEGER,
                        confidence_score REAL,
                        clarity_score REAL,
                        relevance_score REAL,
                        timestamp_ms INTEGER,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS evaluation_reports (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id TEXT UNIQUE,
                        overall_score INTEGER,
                        technical_score INTEGER,
                        communication_score INTEGER,
                        confidence_score INTEGER,
                        clarity_score INTEGER,
                        relevance_score INTEGER,
                        problem_solving_score INTEGER,
                        communication_fingerprint TEXT,
                        seven_day_coaching_plan TEXT,
                        top_weakness TEXT,
                        top_strength TEXT,
                        recommendation TEXT,
                        detailed_feedback TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS interview_analytics (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id TEXT,
                        avg_words_per_minute INTEGER,
                        avg_pause_duration_ms INTEGER,
                        total_filler_words INTEGER,
                        filler_word_frequency TEXT,
                        technical_accuracy_percentage REAL,
                        answer_relevance_percentage REAL,
                        interruption_count INTEGER,
                        state_transitions TEXT,
                        difficulty_adjustments INTEGER,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS session_state_snapshots (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id TEXT,
                        state TEXT,
                        timestamp_ms INTEGER,
                        candidate_response_data TEXT,
                        ai_evaluation_data TEXT,
                        metrics_snapshot TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS agora_events_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id TEXT,
                        event_type TEXT,
                        event_data TEXT,
                        user_uid INTEGER,
                        timestamp_ms INTEGER,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS coaching_plans (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT,
                        evaluation_report_id INTEGER,
                        plan_data TEXT,
                        start_date TEXT,
                        end_date TEXT,
                        completed_days INTEGER DEFAULT 0,
                        progress_notes TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS candidate_profiles (
                        id TEXT PRIMARY KEY,
                        user_id TEXT,
                        target_role TEXT,
                        experience_level TEXT,
                        skills TEXT,
                        parsed_resume_json TEXT,
                        resume_file_url TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS job_descriptions (
                        id TEXT PRIMARY KEY,
                        role_title TEXT,
                        company_name TEXT,
                        competencies TEXT,
                        description_text TEXT,
                        embedding TEXT,
                        metadata TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
            print("[DB] SQLite demo tables initialized")
    except Exception as exc:
        print(f"[DB] Init warning (non-fatal): {exc}")


async def close_db():
    await engine.dispose()
