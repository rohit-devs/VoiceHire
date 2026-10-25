# VoiceHire Dashboard Metrics

Each metric on the dashboard is computed from persisted backend data. No metric is
hardcoded or simulated outside an explicit DEMO MODE label.

## Data sources

| Source table | Description |
|---|---|
| `evaluation_reports` | AI evaluation results per completed interview session |
| `interview_sessions` | Interview session metadata (role, difficulty, state, demo flag) |
| `transcripts` | Question-answer pairs per session |
| `coaching_plans` | Coaching plan progress per evaluation report |

## Metric definitions

### Overall readiness

- **Source:** `evaluation_reports.ai_assessments.overall_score`
- **Formula:** Arithmetic mean of `overall_score` across all completed, non-demo evaluation reports
- **Unit:** Score 0–5
- **Null when:** No completed real interviews exist

### Technical knowledge

- **Source:** `evaluation_reports.ai_assessments.category_scores.technical_correctness.score`
- **Formula:** Arithmetic mean across all completed, non-demo reports
- **Unit:** Score 0–5
- **Null when:** No completed real interviews exist

### Communication

- **Source:** `evaluation_reports.ai_assessments.category_scores.communication.score`
- **Formula:** Arithmetic mean across all completed, non-demo reports
- **Unit:** Score 0–5
- **Null when:** No completed real interviews exist

### Clarity (structure)

- **Source:** `evaluation_reports.ai_assessments.category_scores.structure_and_clarity.score`
- **Formula:** Arithmetic mean across all completed, non-demo reports
- **Unit:** Score 0–5
- **Null when:** No completed real interviews exist

### Answer relevance

- **Source:** `evaluation_reports.ai_assessments.category_scores.relevance.score`
- **Formula:** Arithmetic mean across all completed, non-demo reports
- **Unit:** Score 0–5
- **Null when:** No completed real interviews exist

### Performance history

- **Source:** `evaluation_reports.created_at`, `ai_assessments.overall_score`, `ai_assessments.category_scores`
- **Formula:** One entry per completed, non-demo report, sorted by `created_at` ascending. Each entry includes `overall_score` and per-category scores.
- **Unit:** Score 0–5 per category
- **Null when:** No completed real interviews exist

### Recent interviews

- **Source:** `interview_sessions` (last 5 by `created_at`)
- **Formula:** List of the 5 most recent sessions regardless of completion state
- **Fields:** id, role, difficulty, status, current_state, created_at, is_demo

### Coaching plan progress

- **Source:** `coaching_plans.completed_days`, `coaching_plans.plan_data.total_days`
- **Formula:** `completed_days / total_days * 100`, rounded to nearest integer
- **Unit:** Percentage 0–100
- **Null when:** No coaching plan exists

## Empty state

When no completed real interviews exist, the dashboard shows:
- "No completed real interview evaluations are available yet."
- All metric cards show null/empty
- No performance history chart
- CTA to start a new interview

## Demo mode

All metrics above come from real persisted data. Demo/simulated sessions are
excluded (`is_demo = false` filter). No demo numbers are shown unless explicitly
labeled "DEMO MODE" in the UI.

## Computation location

All dashboard metrics are computed in the frontend service layer
(`apps/web/lib/services/apiInterviewService.ts:getDashboardData`) from data
returned by backend endpoints:
- `GET /api/interviews/sessions` (history)
- `GET /api/evaluations/user/reports` (reports)

Backend does not have a separate dashboard aggregation endpoint.
