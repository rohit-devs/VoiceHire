r"""10-run Deepgram transcription benchmark (transcription only).

Generates one WAV file with known text, then runs DeepgramProvider.transcribe()
10 times, reporting p50/p95 latency for the transcription step only
(audio generation is excluded).

Not collected by pytest. Run directly:
    apps\api\.venv\Scripts\python.exe apps\api\tests\deepgram_benchmark.py
"""
from __future__ import annotations

import asyncio
import statistics
import time
from pathlib import Path

import pyttsx3

from app.config import settings
from app.providers.stt import DeepgramProvider, get_stt_provider

KNOWN_TEXT = "Hello, my name is Alex and I am a software engineer with five years of experience building web applications."
OUTPUT_WAV = Path(__file__).resolve().parent / "deepgram_benchmark_audio.wav"


def generate_wav(text: str, path: Path) -> None:
    """Generate a WAV file with the given text using pyttsx3."""
    engine = pyttsx3.init()
    engine.setProperty("rate", 150)
    engine.save_to_file(text, str(path))
    engine.runAndWait()


def percentile(sorted_values: list[float], p: float) -> float:
    """Nearest-rank percentile."""
    if not sorted_values:
        return 0.0
    k = (p / 100.0) * (len(sorted_values) - 1)
    f = int(k)
    c = min(f + 1, len(sorted_values) - 1)
    if f == c:
        return sorted_values[f]
    d0 = sorted_values[f] * (c - k)
    d1 = sorted_values[c] * (k - f)
    return d0 + d1


async def run_benchmark(provider: DeepgramProvider, audio_bytes: bytes) -> None:
    """Run 10 transcription calls, timing only the Deepgram API step."""
    latencies: list[float] = []
    transcripts: list[str] = []
    for i in range(10):
        start = time.perf_counter()
        transcript = await provider.transcribe(audio_bytes, content_type="audio/wav")
        elapsed_ms = (time.perf_counter() - start) * 1000
        latencies.append(elapsed_ms)
        transcripts.append(transcript)
        print(f"Run {i + 1}/10: {elapsed_ms:.0f} ms -> '{transcript[:60]}...'")

    latencies.sort()
    p50 = percentile(latencies, 50)
    p95 = percentile(latencies, 95)
    avg = statistics.mean(latencies)
    min_ms = min(latencies)
    max_ms = max(latencies)

    print("\n=== Deepgram Transcription Benchmark (10 runs) ===")
    print(f"  p50 latency: {p50:.0f} ms")
    print(f"  p95 latency: {p95:.0f} ms")
    print(f"  average:     {avg:.0f} ms")
    print(f"  min:         {min_ms:.0f} ms")
    print(f"  max:         {max_ms:.0f} ms")
    print(f"  all runs:    {[f'{l:.0f}' for l in latencies]} ms")

    # Verify all transcripts match the known text (word-perfect, punctuation-insensitive)
    import re

    def clean(text: str) -> list[str]:
        return [w for w in (re.sub(r"^[^\w]+|[^\w]+$", "", w) for w in text.lower().split()) if w]

    ref_words = clean(KNOWN_TEXT)
    all_match = all(clean(t) == ref_words for t in transcripts)
    print(f"  word-perfect: {all_match}")


def main() -> None:
    provider = get_stt_provider()
    if not isinstance(provider, DeepgramProvider):
        print("SKIP: DeepgramProvider not resolved. Set STT_PROVIDER=deepgram and DEEPGRAM_API_KEY.")
        return

    # Generate audio once (excluded from timing)
    print(f"Generating WAV with known text ({len(KNOWN_TEXT.split())} words)...")
    generate_wav(KNOWN_TEXT, OUTPUT_WAV)
    audio_bytes = OUTPUT_WAV.read_bytes()
    print(f"Generated {len(audio_bytes)} bytes of audio")

    asyncio.run(run_benchmark(provider, audio_bytes))


if __name__ == "__main__":
    main()
