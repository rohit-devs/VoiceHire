-- ==========================================
-- VOICEHIRE DATABASE SCHEMA
-- PostgreSQL with pgvector extension
-- ==========================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ==========================================
-- USERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    clerk_id VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_clerk_id ON users(clerk_id);

-- ==========================================
-- CANDIDATE PROFILES (Parsed Resume Context)
-- ==========================================
CREATE TABLE IF NOT EXISTS candidate_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    target_role VARCHAR(100) NOT NULL,
    experience_level VARCHAR(50),
    skills TEXT[],
    parsed_resume_json JSONB,
    resume_file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_candidate_profiles_user_id ON candidate_profiles(user_id);
CREATE INDEX idx_candidate_profiles_target_role ON candidate_profiles(target_role);

-- ==========================================
-- JOB DESCRIPTIONS FOR RAG
-- ==========================================
CREATE TABLE IF NOT EXISTS job_descriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_title VARCHAR(100) NOT NULL,
    company_name VARCHAR(100),
    competencies TEXT[],
    description_text TEXT NOT NULL,
    embedding VECTOR(1536),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_job_descriptions_role_title ON job_descriptions(role_title);
CREATE INDEX idx_job_descriptions_embedding ON job_descriptions USING ivfflat (embedding vector_cosine_ops);

-- ==========================================
-- ACTIVE INTERVIEW SESSIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    candidate_profile_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
    role VARCHAR(100) NOT NULL,
    difficulty VARCHAR(50) DEFAULT 'medium',
    agora_channel VARCHAR(100) UNIQUE NOT NULL,
    agora_channel_uid INT,
    status VARCHAR(50) DEFAULT 'scheduled',
    current_state VARCHAR(50) DEFAULT 'intro',
    persona VARCHAR(50) DEFAULT 'technical',
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INT,
    interview_blueprint JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX idx_interview_sessions_agora_channel ON interview_sessions(agora_channel);

-- ==========================================
-- REAL-TIME TRANSCRIPTS WITH METRICS
-- ==========================================
CREATE TABLE IF NOT EXISTS transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE NOT NULL,
    speaker VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    filler_word_count INT DEFAULT 0,
    filler_words TEXT[],
    words_per_minute INT,
    pause_duration_ms INT,
    confidence_score FLOAT,
    clarity_score FLOAT,
    relevance_score FLOAT,
    timestamp_ms INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transcripts_session_id ON transcripts(session_id);
CREATE INDEX idx_transcripts_speaker ON transcripts(speaker);
CREATE INDEX idx_transcripts_created_at ON transcripts(created_at);

-- ==========================================
-- EVALUATION REPORTS (Post-Session)
-- ==========================================
CREATE TABLE IF NOT EXISTS evaluation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE NOT NULL,
    overall_score INT NOT NULL,
    technical_score INT NOT NULL,
    communication_score INT NOT NULL,
    confidence_score INT NOT NULL,
    clarity_score INT NOT NULL,
    relevance_score INT NOT NULL,
    problem_solving_score INT NOT NULL,
    communication_fingerprint JSONB,
    seven_day_coaching_plan JSONB NOT NULL,
    top_weakness TEXT,
    top_strength TEXT,
    recommendation TEXT,
    detailed_feedback JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_evaluation_reports_session_id ON evaluation_reports(session_id);
CREATE INDEX idx_evaluation_reports_overall_score ON evaluation_reports(overall_score);

-- ==========================================
-- INTERVIEW ANALYTICS & TRACKING
-- ==========================================
CREATE TABLE IF NOT EXISTS interview_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE NOT NULL,
    avg_words_per_minute INT,
    avg_pause_duration_ms INT,
    total_filler_words INT,
    filler_word_frequency JSONB,
    technical_accuracy_percentage FLOAT,
    answer_relevance_percentage FLOAT,
    interruption_count INT,
    state_transitions JSONB,
    difficulty_adjustments INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_interview_analytics_session_id ON interview_analytics(session_id);

-- ==========================================
-- SESSION STATE SNAPSHOTS
-- ==========================================
CREATE TABLE IF NOT EXISTS session_state_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE NOT NULL,
    state VARCHAR(50) NOT NULL,
    timestamp_ms INT,
    candidate_response_data JSONB,
    ai_evaluation_data JSONB,
    metrics_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_session_state_snapshots_session_id ON session_state_snapshots(session_id);

-- ==========================================
-- AGORA VOICE EVENTS LOG
-- ==========================================
CREATE TABLE IF NOT EXISTS agora_events_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    user_uid INT,
    timestamp_ms INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agora_events_log_session_id ON agora_events_log(session_id);
CREATE INDEX idx_agora_events_log_event_type ON agora_events_log(event_type);

-- ==========================================
-- COACHING PLANS & PROGRESS
-- ==========================================
CREATE TABLE IF NOT EXISTS coaching_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    evaluation_report_id UUID REFERENCES evaluation_reports(id) ON DELETE CASCADE,
    plan_data JSONB NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    completed_days INT DEFAULT 0,
    progress_notes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coaching_plans_user_id ON coaching_plans(user_id);
CREATE INDEX idx_coaching_plans_start_date ON coaching_plans(start_date);
