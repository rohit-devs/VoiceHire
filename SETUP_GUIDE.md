# VoiceHire Setup & Development Guide

## Quick Start (5 minutes)

### Prerequisites
- Node.js 18+ (for pnpm workspaces)
- Python 3.11+ (for FastAPI backend)
- PostgreSQL 14+ with pgvector extension
- Redis 6+ (for session state)
- Agora Account (free tier available)

### 1. Clone & Install
```bash
cd VoiceHire
pnpm install
cp .env.example .env.local
```

### 2. Configure Environment
Edit `.env.local` with your credentials:
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/voicehire
DATABASE_SHADOW_URL=postgresql://user:pass@localhost:5432/voicehire_shadow

# Agora RTC
NEXT_PUBLIC_AGORA_APP_ID=your-app-id
AGORA_APP_CERTIFICATE=your-app-certificate
AGORA_TOKEN_EXPIRATION=3600

# OpenAI
OPENAI_API_KEY=sk-...

# Redis
REDIS_URL=redis://localhost:6379

# Backend
PYTHONPATH=/path/to/apps/api
API_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Start Backend
```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -e .
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Start Frontend
```bash
cd apps/web
pnpm dev
# Runs on http://localhost:3000
```

### 5. Test Demo Page
1. Navigate to http://localhost:3000
2. Click "Demo Interview Room"
3. Click "Start Interview"
4. Grant microphone permission
5. Watch VoiceOrb animate with your audio level

## Troubleshooting

### Token Generation Fails (500 Error)
**Problem**: Missing Agora credentials
**Solution**: Verify AGORA_APP_ID and AGORA_APP_CERTIFICATE in .env.local

### Microphone Permission Denied
**Problem**: Browser didn't ask for permission or you denied it
**Solution**: 
- Chrome: Settings > Privacy > Site settings > Microphone > Allow voicehire.local
- Firefox: Settings > Privacy > Permissions > Microphone > Allow
- Restart browser after changing permissions

### WebSocket Connection Refused
**Problem**: Backend not running or API URL misconfigured
**Solution**: 
1. Ensure backend is running: `http://localhost:8000/api/health` should return 200
2. Check NEXT_PUBLIC_API_URL matches backend address

### Agora Channel Join Fails
**Problem**: Token expired or channel name invalid
**Solution**:
- Tokens expire after AGORA_TOKEN_EXPIRATION seconds (default 3600)
- Channel names must be alphanumeric with hyphens only (no spaces/special chars)
- Check browser console for detailed error

### PostgreSQL Connection Error
**Problem**: Database not running or URL incorrect
**Solution**: 
```bash
# Start PostgreSQL
# On Mac: brew services start postgresql
# On Linux: sudo systemctl start postgresql
# On Windows: Services > PostgreSQL > Start

# Verify connection
psql -U postgres -d voicehire -c "SELECT version();"
```

## Project Structure

```
VoiceHire/
├── apps/
│   ├── api/                          # FastAPI backend
│   │   ├── app/
│   │   │   ├── main.py              # FastAPI entry point
│   │   │   ├── config.py            # Settings management
│   │   │   ├── database.py          # SQLAlchemy setup
│   │   │   ├── agora_utils.py       # Token generation + session state
│   │   │   ├── websocket_manager.py # Real-time broadcast manager
│   │   │   └── routers/
│   │   │       ├── agora.py         # Token endpoint
│   │   │       ├── interviews.py    # Interview lifecycle + WebSocket
│   │   │       └── ...
│   │   └── pyproject.toml           # Python dependencies
│   │
│   └── web/                         # Next.js frontend
│       ├── app/
│       │   ├── page.tsx             # Home page with demo link
│       │   └── interview/
│       │       └── room/
│       │           └── page.tsx     # Demo interview room
│       ├── components/
│       │   ├── VoiceOrb.tsx         # SVG audio visualization
│       │   └── ...
│       ├── hooks/
│       │   ├── useInterviewWebSocket.ts  # WebSocket management
│       │   ├── useAgoraRTC.ts            # RTC client lifecycle
│       │   ├── useFetchAgoraToken.ts     # Token fetching
│       │   └── ...
│       └── package.json             # Node dependencies
│
├── packages/
│   ├── database/                    # Shared database layer
│   │   └── prisma/
│   │       └── schema.prisma        # Type-safe models
│   │
│   └── prompts/                     # Interview prompts
│       ├── interviewer.yaml         # AI interviewer instructions
│       └── ...
│
├── .env.example                     # Environment variables template
├── package.json                     # pnpm workspaces config
└── README.md
```

## API Reference

### Token Generation Endpoint
```bash
POST /api/agora/token
Content-Type: application/json

{
  "channel_name": "vh-session-123",
  "uid": 1,
  "role": "publisher"
}

Response (200 OK):
{
  "token": "006...",
  "channel_name": "vh-session-123",
  "uid": 1,
  "app_id": "abc123...",
  "expires_in_seconds": 3600
}

Error Responses:
- 400: Invalid input (validation failed)
- 500: Missing Agora credentials
- 503: Service unavailable
```

### WebSocket Endpoint
```bash
WS /api/interviews/sessions/{session_id}/ws

Message Types:

1. Transcript
{
  "type": "transcript",
  "speaker": "candidate|interviewer",
  "text": "Your response here",
  "timestamp_ms": 1234567890,
  "metrics": {
    "wpm": 125,
    "pause_ms": 200,
    "filler_words": ["um", "uh", "like"]
  }
}

2. Metrics
{
  "type": "metrics",
  "clarity_score": 85,
  "confidence_score": 78,
  "relevance_score": 92,
  "filler_words_count": 3,
  "avg_wpm": 120,
  "timestamp_ms": 1234567890
}

3. State Change
{
  "type": "state_change",
  "state": "technical|behavioral|pressure",
  "metadata": {"question": "Tell me about..."}
}

4. AI Thinking
{
  "type": "ai_thinking",
  "text": "Analyzing your response..."
}

5. Evaluation Complete
{
  "type": "evaluation_complete",
  "report": { /* full evaluation */ }
}
```

## Common Development Tasks

### Add a New API Endpoint
```python
# File: apps/api/app/routers/new_feature.py
from fastapi import APIRouter, Depends
from app.database import get_db

router = APIRouter(prefix="/api/feature", tags=["feature"])

@router.post("/endpoint")
async def feature_endpoint(db = Depends(get_db)):
    return {"status": "ok"}

# Register in apps/api/app/main.py
app.include_router(new_feature.router)
```

### Add a New Database Model
```python
# File: packages/database/prisma/schema.prisma
model NewModel {
  id           String   @id @default(cuid())
  name         String
  created_at   DateTime @default(now())
  
  @@index([name])
}

# Migrate
cd packages/database
npx prisma migrate dev --name add_new_model
```

### Add a New Frontend Component
```typescript
// File: apps/web/components/NewComponent.tsx
"use client";

export default function NewComponent() {
  return <div>Component here</div>;
}

// Import in page
import NewComponent from "@/components/NewComponent";
```

### Run Tests
```bash
# Python backend tests
cd apps/api
pytest

# Frontend tests
cd apps/web
pnpm test

# Type checking
pnpm type-check
```

## Performance Monitoring

### Backend Logs
```bash
# Check Uvicorn logs for request timing
# Look for: "POST /api/agora/token" response times

# Enable debug logging
export DEBUG=true
uvicorn app.main:app --reload --log-level debug
```

### Frontend Performance
```typescript
// Browser DevTools
1. Open DevTools (F12)
2. Network tab: Monitor WebSocket messages
3. Console: Check for JS errors and slow operations
4. Lighthouse: Run performance audit

// Real-time metrics from interview room:
- Audio Level: Should update smoothly (0-100)
- WPM: Should be 80-200 for normal speech
- Clarity Score: 0-100 (higher is better)
- Filler Words: Count increases during interview
```

### Database Performance
```sql
-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Monitor connections
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;
```

## Deployment Checklist

- [ ] Update .env.local with production Agora credentials
- [ ] Set NEXT_PUBLIC_API_URL to production backend URL
- [ ] Run database migrations: `prisma migrate deploy`
- [ ] Build frontend: `pnpm build`
- [ ] Build backend: Docker container or serverless deployment
- [ ] Test token generation with production credentials
- [ ] Load test WebSocket connections
- [ ] Monitor error rates for first 24 hours
- [ ] Set up log aggregation (CloudWatch, Datadog, etc.)
- [ ] Configure CDN for frontend assets
- [ ] Set up HTTPS/WSS (required for production)

## Next Steps

1. **Phase 2B**: Implement Agora Agents SDK for AI agent
2. **Phase 2C**: Add state machine for interview flow
3. **Phase 3**: Implement response analyzer and coaching
4. **Phase 4**: Analytics dashboard and reporting

See `/memories/repo/voicehire-phase2-progress.md` for detailed component status.
