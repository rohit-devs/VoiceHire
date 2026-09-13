"""Deterministic post-session metrics and evaluation report generation."""

from collections import Counter
from typing import Any


FILLERS = {"um", "uh", "like", "basically", "actually", "you know"}


def build_evaluation(transcripts: list[dict[str, Any]]) -> dict[str, Any]:
    """Calculate stable scores from persisted candidate transcript segments."""
    candidate = [item for item in transcripts if item.get("speaker") == "candidate"]
    text = " ".join(str(item.get("message", "")) for item in candidate)
    words = text.split()
    filler_counts = Counter(word.lower().strip(".,!?;:") for word in words if word.lower().strip(".,!?;:") in FILLERS)
    filler_total = sum(filler_counts.values())
    clarity = max(0, min(100, 90 - filler_total * 4))
    relevance = round(sum(float(item.get("relevance_score") or 70) for item in candidate) / len(candidate)) if candidate else 0
    confidence = round(sum(float(item.get("confidence_score") or 65) for item in candidate) / len(candidate)) if candidate else 0
    technical = round(sum(float(item.get("clarity_score") or 65) for item in candidate) / len(candidate)) if candidate else 0
    communication = round((clarity + confidence) / 2)
    overall = round((technical + communication + relevance) / 3)
    fingerprint = {"clarity": clarity, "conciseness": max(0, 90 - len(words) // 20), "structure": relevance, "pace": 75, "filler_control": max(0, 100 - filler_total * 5)}
    return {
        "overall_score": overall,
        "technical_score": technical,
        "communication_score": communication,
        "confidence_score": confidence,
        "clarity_score": clarity,
        "relevance_score": relevance,
        "problem_solving_score": technical,
        "communication_fingerprint": fingerprint,
        "seven_day_coaching_plan": {str(day): "Practice one concise STAR response and review filler words." for day in range(1, 8)},
        "top_weakness": "Filler word control" if filler_total else "Answer structure",
        "top_strength": "Clear communication" if clarity >= 75 else "Technical participation",
        "recommendation": "Continue practicing structured, concise answers.",
        "detailed_feedback": {"candidate_turns": len(candidate), "word_count": len(words), "filler_words": dict(filler_counts)},
    }
