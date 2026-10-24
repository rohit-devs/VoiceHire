"""Descriptive voice metrics derived only from finalized transcript segments."""

import re
from datetime import datetime, timezone
from typing import Iterable, Mapping

FILLER_WORDS: dict[str, frozenset[str]] = {
    "en": frozenset({"uh", "um", "er", "ah", "like", "basically", "actually"}),
    "es": frozenset({"eh", "este", "pues", "bueno", "o sea"}),
    "fr": frozenset({"euh", "ben", "voilà", "genre", "en fait"}),
}

_WORD_PATTERN = re.compile(r"[^\W_]+(?:['’][^\W_]+)?", re.UNICODE)


def _words(text: str) -> list[str]:
    return [word.casefold() for word in _WORD_PATTERN.findall(text)]


def calculate_voice_metrics(
    segments: Iterable[Mapping[str, object]],
    *,
    started_at: datetime | None,
    duration_seconds: int,
    now: datetime | None = None,
) -> dict[str, object]:
    """Return measured values, or null plus an explicit reason when unavailable."""
    rows = [row for row in segments if row.get("speaker") == "candidate"]
    all_words = [
        (str(row.get("language") or "en"), _words(str(row.get("message") or "")))
        for row in rows
    ]
    total_words = sum(len(words) for _, words in all_words)
    timed = [
        (words, row.get("duration_ms"))
        for row, (_, words) in zip(rows, all_words)
        if isinstance(row.get("timestamp_ms"), int)
        and isinstance(row.get("duration_ms"), int)
        and int(row["duration_ms"]) > 0
    ]
    timed_duration = sum(int(duration) for _, duration in timed)
    timed_words = sum(len(words) for words, _ in timed)
    fillers = 0
    for language, words in all_words:
        filler_phrases = [
            _words(phrase) for phrase in FILLER_WORDS.get(language, FILLER_WORDS["en"])
        ]
        for phrase in filler_phrases:
            fillers += sum(
                words[index:index + len(phrase)] == phrase
                for index in range(len(words) - len(phrase) + 1)
            )
    answers = [words for _, words in all_words if words]

    def metric(
        value: float | int | None, unit: str, reason: str | None = None
    ) -> dict[str, float | int | str | None]:
        return {"value": value, "unit": unit, "reason": reason}

    no_answers = "No finalized candidate answers are available."
    speaking_duration: float | None = (
        round(timed_duration / 1000, 2) if timed else None
    )
    wpm: float | None = (
        round(timed_words * 60_000 / timed_duration, 1) if timed_duration else None
    )
    filler_rate = round(fillers / total_words, 4) if total_words else None

    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)
    normalized_start = started_at
    if normalized_start is not None and normalized_start.tzinfo is None:
        normalized_start = normalized_start.replace(tzinfo=timezone.utc)
    remaining = (
        max(0, int(duration_seconds - (current_time - normalized_start).total_seconds()))
        if normalized_start is not None
        else None
    )

    return {
        "speaking_duration_seconds": metric(
            speaking_duration,
            "seconds",
            None if speaking_duration is not None else "Final segment timestamps and durations are unavailable.",
        ),
        "words_per_minute": metric(
            wpm,
            "words/minute",
            None if wpm is not None else "Timed finalized segments are required to calculate speaking pace.",
        ),
        "filler_word_rate": metric(
            filler_rate,
            "filler words / total words",
            None if filler_rate is not None else no_answers,
        ),
        "answer_length_words": metric(
            round(total_words / len(answers), 1) if answers else None,
            "words/answer",
            None if answers else no_answers,
        ),
        "time_remaining_seconds": metric(
            remaining,
            "seconds",
            None if remaining is not None else "Interview start time is unavailable.",
        ),
        "filler_word_language_lists": {
            language: sorted(words) for language, words in FILLER_WORDS.items()
        },
    }
