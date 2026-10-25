"""GATE 3: Real Deepgram STT verification.

Generates a WAV file with known text using pyttsx3, transcribes it through
the actual Deepgram backend provider, and checks word-error rate against the
known text using word-level edit distance (Levenshtein). Reports command,
exit code, transcript, WER, and latency.

Prerequisites:
  - DEEPGRAM_API_KEY set in .env.local (never committed)
  - STT_PROVIDER=deepgram

This script is NOT collected by pytest (no test_ functions). Run it directly:
    apps\api\.venv\Scripts\python.exe apps\api\tests\test_gate3_stt.py
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path

import pyttsx3

from app.config import settings
from app.providers.stt import DeepgramProvider, get_stt_provider

KNOWN_TEXT = "Hello, my name is Alex and I am a software engineer with five years of experience building web applications."
OUTPUT_WAV = Path(__file__).resolve().parent / "gate3_test_audio.wav"


def generate_wav(text: str, path: Path) -> None:
    """Generate a WAV file with the given text using pyttsx3."""
    engine = pyttsx3.init()
    engine.setProperty("rate", 150)
    engine.save_to_file(text, str(path))
    engine.runAndWait()


def levenshtein_distance(a: list[str], b: list[str]) -> int:
    """Word-level Levenshtein edit distance between two token lists."""
    m, n = len(a), len(b)
    if m == 0:
        return n
    if n == 0:
        return m
    previous = list(range(n + 1))
    for i in range(1, m + 1):
        current = [i] + [0] * n
        for j in range(1, n + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            current[j] = min(
                current[j - 1] + 1,  # insertion
                previous[j] + 1,  # deletion
                previous[j - 1] + cost,  # substitution
            )
        previous = current
    return previous[n]


def word_error_rate(reference: str, hypothesis: str) -> float:
    """WER = Levenshtein edit distance / number of reference words.

    Words are lowercased and stripped of surrounding punctuation so that
    "Hello." and "Hello," count as the same word.
    """
    import re

    def clean(text: str) -> list[str]:
        return [re.sub(r"^[^\w]+|[^\w]+$", "", w) for w in text.lower().split()]

    ref_words = clean(reference)
    hyp_words = clean(hypothesis)
    ref_words = [w for w in ref_words if w]
    hyp_words = [w for w in hyp_words if w]
    if not ref_words:
        return 1.0 if hyp_words else 0.0
    distance = levenshtein_distance(ref_words, hyp_words)
    return distance / len(ref_words)


async def main() -> None:
    print("=== GATE 3: Real Deepgram STT Verification ===")
    print(f"Settings DEMO_MODE: {settings.DEMO_MODE}")
    print(f"Settings STT_PROVIDER: {settings.STT_PROVIDER}")
    print(f"DEEPGRAM_API_KEY set: {bool(settings.DEEPGRAM_API_KEY)}")

    provider = get_stt_provider()
    print(f"Resolved STT provider: {provider.name} (simulated={provider.simulated})")

    if not isinstance(provider, DeepgramProvider):
        print("SKIP: DeepgramProvider not resolved. Set STT_PROVIDER=deepgram and DEEPGRAM_API_KEY.")
        return

    # Generate test audio
    print(f"\nGenerating WAV with known text: {KNOWN_TEXT[:60]}...")
    generate_wav(KNOWN_TEXT, OUTPUT_WAV)
    audio_bytes = OUTPUT_WAV.read_bytes()
    print(f"Generated {len(audio_bytes)} bytes of audio")

    # Transcribe through Deepgram
    print("\nTranscribing through Deepgram...")
    start = time.perf_counter()
    try:
        transcript = await provider.transcribe(audio_bytes, content_type="audio/wav")
        elapsed_ms = (time.perf_counter() - start) * 1000
    except Exception as exc:
        print(f"DEEPGRAM ERROR: {type(exc).__name__}")
        return

    print(f"\nTranscript: '{transcript}'")
    print(f"Latency: {elapsed_ms:.0f} ms")

    wer = word_error_rate(KNOWN_TEXT, transcript)
    print(f"\nWord-error rate: {wer:.2%} (known text: {len(KNOWN_TEXT.split())} words)")
    if wer <= 0.25:
        print("RESULT: PASS — WER within acceptable range (<=25%)")
    else:
        print("RESULT: WARN — WER above 25%, check audio quality or provider")


if __name__ == "__main__":
    asyncio.run(main())
