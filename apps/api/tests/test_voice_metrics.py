from datetime import datetime, timezone

from app.interview.voice_metrics import calculate_voice_metrics


def test_empty_answers_have_null_values_with_reasons():
    metrics = calculate_voice_metrics(
        [], started_at=None, duration_seconds=120
    )
    assert metrics["speaking_duration_seconds"]["value"] is None
    assert metrics["words_per_minute"]["value"] is None
    assert metrics["filler_word_rate"]["value"] is None
    assert metrics["answer_length_words"]["value"] is None
    assert metrics["time_remaining_seconds"]["value"] is None
    assert all(
        metrics[name]["reason"]
        for name in (
            "speaking_duration_seconds",
            "words_per_minute",
            "filler_word_rate",
            "answer_length_words",
            "time_remaining_seconds",
        )
    )


def test_one_word_wpm_uses_only_timestamped_final_segment_duration():
    metrics = calculate_voice_metrics(
        [
            {
                "speaker": "candidate",
                "message": "Um",
                "language": "en",
                "timestamp_ms": 1_000,
                "duration_ms": 2_000,
            }
        ],
        started_at=datetime.fromtimestamp(0, tz=timezone.utc),
        duration_seconds=120,
        now=datetime.fromtimestamp(30, tz=timezone.utc),
    )
    assert metrics["speaking_duration_seconds"]["value"] == 2
    assert metrics["words_per_minute"]["value"] == 30
    assert metrics["filler_word_rate"]["value"] == 1
    assert metrics["answer_length_words"]["value"] == 1
    assert metrics["time_remaining_seconds"]["value"] == 90


def test_missing_segment_timestamps_do_not_fabricate_speaking_metrics():
    metrics = calculate_voice_metrics(
        [
            {
                "speaker": "candidate",
                "message": "I built an API",
                "language": "en",
                "timestamp_ms": None,
                "duration_ms": 10_000,
            }
        ],
        started_at=None,
        duration_seconds=120,
    )
    assert metrics["speaking_duration_seconds"]["value"] is None
    assert metrics["words_per_minute"]["value"] is None
    assert metrics["filler_word_rate"]["value"] == 0
    assert metrics["answer_length_words"]["value"] == 4


def test_filler_rate_uses_the_segment_language_list():
    metrics = calculate_voice_metrics(
        [
            {
                "speaker": "candidate",
                "message": "Eh, bueno, diseñé una API.",
                "language": "es",
                "timestamp_ms": 500,
                "duration_ms": 4_000,
            }
        ],
        started_at=None,
        duration_seconds=120,
    )
    assert metrics["filler_word_rate"]["value"] == 0.4
