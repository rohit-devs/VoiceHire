# 🎤 VoiceHire - Real-Time AI Interview Performance Engine

A cutting-edge platform that evaluates how candidates perform under pressure through bidirectional AI voice interviews with adaptive follow-ups, resume-based personalization, and post-session performance coaching.

## 📋 Project Structure

```
voicehire/
├── apps/
│   ├── web/                    # Next.js 14+ frontend (TypeScript, Tailwind)
│   │   ├── app/                # App Router
│   │   ├── components/         # React components (VoiceOrb, MetricsPanel, etc.)
│   │   ├── lib/                # Utilities, API clients
│   │   ├── hooks/              # Custom React hooks
│   │   └── types/              # TypeScript types
│   └── api/                    # FastAPI backend (Python 3.11+)
│       ├── app/
│       │   ├── main.py         # FastAPI app entry point
│       │   ├── config.py       # Settings and configuration
│       │   ├── database.py     # Database connection and setup
│       │   ├── routers/        # API route handlers
│       │   │   ├── agora.py    # Agora RTC tokens & events
│       │   │   ├── interviews.py # Interview session management
│       │   │   ├── users.py    # User management
│       │   │   ├── evaluations.py # Reports & coaching plans
│       │   │   └── health.py   # Health checks
│       │   └── models/         # SQLAlchemy ORM models
│       └── pyproject.toml      # Python dependencies
├── packages/
│   ├── database/               # Prisma schema & migrations
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Prisma ORM schema
│   │   └── package.json
│   └── prompts/                # Version-controlled prompt configs (YAML/JSON)
│       ├── interviewer.yaml    # Master interviewer system prompt
│       └── evaluator.yaml      # Evaluation agent prompt
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
└── package.json                # Monorepo root (pnpm workspaces)
```

## 🚀 Phase 1: Foundation & Infrastructure ✅

### Completed Setup

- ✅ **Monorepo Setup**: pnpm workspaces configured
- ✅ **Environment Configuration**: `.env.example` with all required secrets
- ✅ **Database Schema**: PostgreSQL with pgvector for embeddings
- ✅ **Prisma ORM**: Complete schema with migrations
- ✅ **FastAPI Backend**: Scaffolded with core routers
- ✅ **Next.js Frontend**: Initialized with TypeScript & Tailwind
- ✅ **Authentication**: Clerk integration prepared

### Key Infrastructure Files

| File | Purpose |
|------|---------|
| `pyproject.toml` | Python dependencies (FastAPI, SQLAlchemy, Pydantic v2) |
| `packages/database/prisma/schema.prisma` | ORM schema with all tables |
| `databases/schema.sql` | Raw PostgreSQL schema with indexes |
| `apps/api/app/config.py` | Centralized configuration (secrets via env vars) |
| `.env.example` | Template for all required environment variables |

## 🎤 Phase 2: Real-Time Voice Pipeline ✅ (In Progress)

### Completed Components (40% of Phase 2)

#### Backend Infrastructure
- ✅ **Agora Token Generation** (`apps/api/app/agora_utils.py`)
  - Secure server-side token generation
  - Channel name validation
  - Session state tracking

- ✅ **WebSocket Manager** (`apps/api/app/websocket_manager.py`)
  - Real-time transcript broadcasting
  - Live metrics streaming
  - State change notifications
  - Session-isolated connection management

- ✅ **Demo Session Manager** (`apps/api/app/demo_manager.py`)
  - Simulates realistic interview flow
  - Auto-generates transcript and metrics
  - Perfect for testing and demos

#### Frontend Components
- ✅ **VoiceOrb Component** (`apps/web/components/VoiceOrb.tsx`)
  - Animated SVG showing audio activity
  - Real-time audio level visualization
  - State-based coloring (AI/Candidate/Idle)

- ✅ **Interview Room Demo Page** (`apps/web/app/interview/room/page.tsx`)
  - Complete UI for interview sessions
  - Live transcript display
  - Metrics panel with gauge charts
  - Connection status indicators

#### React Hooks
- ✅ **useInterviewWebSocket.ts** - WebSocket connection management
- ✅ **useAgoraRTC.ts** - Agora RTC client lifecycle
- ✅ **useFetchAgoraToken.ts** - Secure token fetching

### Remaining Phase 2 Tasks (60% to complete)
- ⏳ Agora Agents SDK integration (AI agent spawning)
- ⏳ Real-time metrics calculation (WPM, clarity, confidence)
- ⏳ State machine for interview flow orchestration
- ⏳ Response analyzer agent (LLM-based evaluation)
- ⏳ Enhanced UI components (Live Metrics Panel, Transcript Display)

### Quick Demo

See Phase 2 in action instantly:

```bash
# 1. Start backend & frontend (see Getting Started below)
# 2. Visit: http://localhost:3000
# 3. Click "Demo Interview Room"
# 4. Click "Start Interview"
# 5. Watch real-time transcript and metrics stream live!
```

**Note**: Demo sessions auto-start when session ID starts with `demo-` (no Agora microphone needed for testing UI)

## ⚙️ Getting Started

### Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **pnpm** (install via `npm install -g pnpm`)
- **PostgreSQL** 14+ with pgvector extension
- **Redis** (for session state)

### Installation

1. **Clone and Install Dependencies**
   ```bash
   cd voicehire
   pnpm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your actual credentials:
   # - Clerk API keys
   # - PostgreSQL connection string
   # - Agora credentials
   # - OpenAI API key
   ```

3. **Initialize Database**
   ```bash
   cd packages/database
   pnpm db:push
   pnpm db:seed  # (optional, when available)
   ```

4. **Install Python Dependencies** (for backend)
   ```bash
   cd apps/api
   pip install -e .
   ```

### Development

Start both frontend and backend in parallel:

```bash
# From root directory
pnpm dev
```

Or separately:

```bash
# Terminal 1: Frontend (Next.js on port 3000)
cd apps/web
pnpm dev

# Terminal 2: Backend (FastAPI on port 8000)
cd apps/api
python -m uvicorn app.main:app --reload --port 8000
```

### API Endpoints (Phase 1 - Scaffolded)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health/ready` | GET | Readiness probe |
| `/api/health/live` | GET | Liveness probe |
| `/api/agora/token` | POST | Generate Agora RTC token |
| `/api/users/register` | POST | Register new user |
| `/api/users/me` | GET | Get current user profile |
| `/api/interviews/sessions` | POST | Create interview session |
| `/api/interviews/sessions/{id}` | GET | Get session details |
| `/api/interviews/sessions/{id}/start` | POST | Start interview |
| `/api/interviews/sessions/{id}/end` | POST | End interview |
| `/api/evaluations/sessions/{id}/report` | GET | Get evaluation report |

## 🗄️ Database Schema (Highlights)

### Core Tables

- **users** - User accounts linked to Clerk
- **candidate_profiles** - Parsed resume data with embeddings
- **interview_sessions** - Active/completed interviews with state tracking
- **transcripts** - Real-time speech transcriptions with metrics
- **evaluation_reports** - Post-session scores & coaching plans
- **interview_analytics** - Detailed metrics (WPM, filler words, state transitions)
- **job_descriptions** - JD embeddings for RAG-based personalization
- **coaching_plans** - 7-day improvement plans with progress tracking

All tables support soft deletes, timestamps (created_at, updated_at), and JSONB for flexible data.

## 📚 Documentation

### Setup & Development
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete development environment setup and troubleshooting

### Demo & Testing
- **[DEMO_TESTING_GUIDE.md](./DEMO_TESTING_GUIDE.md)** - How to test Phase 2 demo with real-time interview simulation
- Visit demo: `http://localhost:3000/interview/room?sessionId=demo-1`

### Architecture & Progress
- **[/memories/repo/voicehire-phase2-progress.md](/memories/repo/voicehire-phase2-progress.md)** - Detailed Phase 2 component status and architecture patterns
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Development workflows, debugging, and common tasks

## 🔧 Technology Stack

### Backend
- **Framework**: FastAPI 0.109+ with async/await
- **Database**: PostgreSQL 14+ with pgvector extension
- **ORM**: SQLAlchemy 2.0 async + Prisma (complementary)
- **Auth**: Clerk (JWT tokens)
- **Real-time**: WebSocket for transcript streaming
- **Voice**: Agora RTC SDK for bidirectional audio

### Frontend
- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Component State**: React hooks
- **Audio Capture**: Agora RTC SDK
- **Visualization**: Custom SVG (VoiceOrb), Recharts (metrics)
- **Auth**: Clerk integration

### Infrastructure
- **Workspaces**: pnpm monorepo
- **Python Runtime**: 3.11+
- **Node Runtime**: 18+
- **Environment**: .env.local (with secret management)

## 🚀 Roadmap

### Phase 1: ✅ Complete
- Monorepo setup, database schema, authentication scaffolding

### Phase 2: 🟡 In Progress (40% complete)
- Real-time voice pipeline, Agora integration, WebSocket streaming, demo UI

### Phase 3: ⏳ Planned
- AI Interview Orchestrator (state machine, response analysis, scoring)
- Integration with OpenAI GPT-4o-mini for response evaluation
- Coaching recommendations engine

### Phase 4: ⏳ Planned
- Advanced Analytics Dashboard
- Performance benchmarking and comparison
- Multi-language support
- Mobile app (React Native)

### Phase 5: ⏳ Planned
- Integration with ATS systems
- Bulk candidate interviews
- API for recruitment firms
- Enterprise deployment options

## 📞 Support

For issues or questions:
1. Check **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** troubleshooting section
2. Review **[DEMO_TESTING_GUIDE.md](./DEMO_TESTING_GUIDE.md)** for common issues
3. Check backend logs: `tail -f logs/backend.log`
4. Check browser console for frontend errors (F12)
5. See MongoDB logs if data pipeline is involved

## 📝 License

[Add your license here]

---

**Status**: Phase 2 in active development | Last Updated: 2024 | Built with ❤️


## 📦 Technology Stack

### Frontend
- **Next.js 14+** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** + shadcn/ui for design
- **Agora RTC SDK** for voice transmission
- **Zustand** for state management
- **Recharts** for data visualization (Communication Fingerprint)

### Backend
- **FastAPI** (Python 3.11+)
- **Pydantic v2** for validation
- **SQLAlchemy 2.0** with asyncio
- **PostgreSQL** with pgvector for embeddings
- **Redis** for session state
- **OpenAI GPT-4o-mini** for AI reasoning
- **Agora Agents SDK** for real-time voice

### Infrastructure
- **Vercel** for frontend deployment
- **Railway/Render** for backend deployment
- **Supabase/AWS RDS** for PostgreSQL
- **GitHub** for version control

## 🔐 Security Notes

1. **Secrets Management**
   - All API keys stored in `.env.local` (never committed)
   - Backend-only secrets (Agora Certificate, OpenAI Key, Database URL)
   - JWT-based authentication for API endpoints

2. **Database Security**
   - Row-level security (RLS) policies to be implemented in Phase 2
   - Clerk user ID as primary auth source

3. **Voice Privacy**
   - Transcripts encrypted at rest
   - Agora tokens expire after 1 hour
   - Audio streams isolated per session (channel-based)

## 📈 What's Next: Phase 2

Phase 2 will implement:
- ✨ **Real-Time Voice Pipeline** (Agora RTC + ASR/TTS)
- ✨ **AI Interview Orchestrator** (State machine, response analysis)
- ✨ **VoiceOrb Component** (Live audio visualization)
- ✨ **Agora Token Generation** (Secure backend tokens)

---

**Built with ❤️ for candidates who want to ace their interviews.**
