# Voice Architecture

## Decision

Use Agora RTC Web SDK for authenticated microphone publishing and connection
status, the browser Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`)
for speech-to-text, the browser `speechSynthesis` API for spoken interviewer
questions, the existing FastAPI WebSocket for authenticated transcript events,
and the existing server-side LLM provider for question generation.

This is the in-app RTC path, not an Agora Conversational AI agent. The existing
interview API already owns the interview state, question policy, provider
budgets, and transcript persistence. Conversational AI would add a separate
server-managed agent lifecycle and ASR/LLM/TTS configuration; adopting it would
replace or bridge those responsibilities and requires Agora customer REST
credentials and agent/model configuration beyond the installed RTC SDK. The
current product flow can preserve the existing interview behavior without
introducing another agent runtime or new packages.

The browser speech APIs are a separate speech pipeline from Agora transport:
speech recognition supplies final text segments to the existing authenticated
transcript API; spoken questions use the platform's local speech synthesis.
Agora RTC publishes the candidate microphone and provides actual RTC network,
connection, and audio-level observations. No remote AI participant or
Agora-hosted speech processing is claimed by this design. Browser recognition
availability and its privacy/processing characteristics depend on the user's
browser and platform.

## Official documentation consulted

- [Agora RTC quickstart](https://docs.agora.io/en/realtime-media/rtc/get-started-sdk):
  RTC client initialization, joining a channel, and publishing media. The
  current quickstart page is platform-mixed; its client/channel/media model is
  applicable, but implementation signatures are checked against the installed
  Web SDK package.
- [Agora Web SDK 4.x API reference](https://api-ref.agora.io/en/video-sdk/web/4.x/index.html):
  the Web SDK client, microphone track, connection-state, network-quality,
  volume-indicator, and leave/cleanup API surface. The repository lockfile
  resolves the declared `agora-rtc-sdk-ng` range to **4.24.8**.
- [Agora Voice Agent overview](https://docs.agora.io/en/ai):
  Conversational AI separates realtime transport, an agent runtime, model
  services, and the endpoint; the in-app path is appropriate for app-owned
  session orchestration.
- [Agora Voice Agent quickstart](https://docs.agora.io/en/ai/get-started/quickstart)
  and [start/stop agent](https://docs.agora.io/en/ai/build/start-stop-agent):
  the agent joins the user's Agora channel and its ASR, LLM, and TTS run as a
  server-managed pipeline with explicit start/stop controls.
- [Conversational AI REST API reference](https://docs.agora.io/en/api-reference/api-ref/conversational-ai.md):
  server-side Conversational AI control plane and credentials.

## Runtime behavior and limits

- Agora RTC credentials are needed for the live RTC transport. Tokens are
  generated only by the API for an owned, interviewable session channel and
  expire within one hour. The App Certificate is never returned.
- Browser speech recognition is capability-detected. If unavailable, denied,
  or blocked by browser policy, the room explains the limitation and keeps the
  text-answer path available. It does not simulate candidate speech.
- Browser speech synthesis is used only when available and enabled. Text
  questions remain visible regardless of audio playback support.
- Explicit demo sessions may use the deterministic FakeProvider and are visibly
  labeled simulated. Demo mode does not invent candidate audio, transcripts, or
  measurements.
- Only final transcript segments are persisted, deduplicated by message ID,
  ordered by a server sequence, and replayable after reconnect. Metrics are
  descriptive, derived only from final transcript timing/text or session
  timestamps, and return null with a reason when the required data is missing.
- VAD events may contribute to talk-time/silence only. Text is not used to
  infer confidence, emotion, pronunciation, vocal tone, or other acoustic
  qualities.
- A manual live two-minute interview, third-party browser speech behavior,
  Agora service connectivity, and live LLM behavior require external
  credentials and a supported browser/device; they are not established by
  automated tests alone.
