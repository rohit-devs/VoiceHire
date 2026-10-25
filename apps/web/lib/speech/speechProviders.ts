import { apiInterviewService } from "@/lib/services/apiInterviewService";

// ── Interview turn state machine ─────────────────────────────────────────
export type InterviewTurnState =
  | "IDLE"
  | "ASKING"
  | "LISTENING"
  | "TRANSCRIBING"
  | "EVALUATING"
  | "NEXT";

const LEGAL_TRANSITIONS: Record<InterviewTurnState, InterviewTurnState[]> = {
  IDLE: ["ASKING"],
  ASKING: ["LISTENING", "NEXT"],
  LISTENING: ["TRANSCRIBING", "IDLE"],
  TRANSCRIBING: ["EVALUATING"],
  EVALUATING: ["ASKING", "NEXT"],
  NEXT: ["ASKING", "IDLE"],
};

export class InterviewTurnMachine {
  private state: InterviewTurnState = "IDLE";
  private requestId = 0;
  private subscribers: Array<(state: InterviewTurnState, requestId: number) => void> = [];

  get currentState(): InterviewTurnState {
    return this.state;
  }

  get currentRequestId(): number {
    return this.requestId;
  }

  subscribe(fn: (state: InterviewTurnState, requestId: number) => void): () => void {
    this.subscribers.push(fn);
    fn(this.state, this.requestId);
    return () => {
      const idx = this.subscribers.indexOf(fn);
      if (idx >= 0) this.subscribers.splice(idx, 1);
    };
  }

  private emit(): void {
    for (const fn of this.subscribers) fn(this.state, this.requestId);
  }

  nextRequestId(): number {
    this.requestId += 1;
    return this.requestId;
  }

  transition(to: InterviewTurnState, requestId?: number): boolean {
    if (requestId !== undefined && requestId !== this.requestId) return false;
    const allowed = LEGAL_TRANSITIONS[this.state];
    if (!allowed || !allowed.includes(to)) return false;
    this.state = to;
    this.emit();
    return true;
  }

  canTransition(to: InterviewTurnState): boolean {
    return LEGAL_TRANSITIONS[this.state]?.includes(to) ?? false;
  }
}

export interface FinalSpeechSegment {
  messageId: string;
  text: string;
  timestampMs: number;
  durationMs: number | null;
  language: "en" | "es" | "fr";
}

export interface STTProvider {
  readonly supported: boolean;
  start(
    onFinal: (segment: FinalSpeechSegment) => void,
    onError: (message: string) => void,
    onEnded?: () => void,
    onInterim?: (text: string) => void,
  ): void;
  stop(): void;
}

export interface TTSProvider {
  readonly supported: boolean;
  speak(text: string, onEnd?: () => void): void;
  stop(): void;
}

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function createMessageId(): string {
  return crypto.randomUUID();
}

export class BrowserSpeechRecognitionProvider implements STTProvider {
  private recognition: SpeechRecognitionLike | null = null;
  private speechStartedAt: number | null = null;
  private speechEndedAt: number | null = null;
  readonly language: "en" | "es" | "fr";

  constructor(language: "en" | "es" | "fr" = "en") {
    this.language = language;
  }

  get supported(): boolean {
    if (typeof window === "undefined") return false;
    const speechWindow = window as SpeechWindow;
    return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
  }

  start(
    onFinal: (segment: FinalSpeechSegment) => void,
    onError: (message: string) => void,
    onEnded?: () => void,
    onInterim?: (text: string) => void,
  ): void {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      onError("Speech recognition is not supported in this browser.");
      return;
    }

    this.stop();
    const recognition = new Recognition();
    this.recognition = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = { en: "en-US", es: "es-ES", fr: "fr-FR" }[this.language];
    recognition.onspeechstart = () => {
      this.speechStartedAt = Date.now();
      this.speechEndedAt = null;
    };
    recognition.onspeechend = () => {
      this.speechEndedAt = Date.now();
    };
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript.trim();
        if (!text) continue;
        if (!result.isFinal) {
          onInterim?.(text);
          continue;
        }
        onInterim?.("");
        const endedAt = this.speechEndedAt ?? Date.now();
        onFinal({
          messageId: createMessageId(),
          text,
          timestampMs: endedAt,
          durationMs:
            this.speechStartedAt === null
              ? null
              : Math.max(1, endedAt - this.speechStartedAt),
          language: this.language,
        });
        this.speechStartedAt = null;
        this.speechEndedAt = null;
      }
    };
    recognition.onerror = (event) => {
      onError(
        event.error === "not-allowed"
          ? "Microphone permission was denied for speech recognition."
          : `Speech recognition failed: ${event.error}`,
      );
    };
    recognition.onend = () => {
      if (this.recognition === recognition) this.recognition = null;
      onEnded?.();
    };
    recognition.start();
  }

  stop(): void {
    const recognition = this.recognition;
    this.recognition = null;
    this.speechStartedAt = null;
    this.speechEndedAt = null;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onspeechstart = null;
    recognition.onspeechend = null;
    recognition.onend = null;
    recognition.stop();
  }
}

export class RecordedAudioSpeechRecognitionProvider implements STTProvider {
  private readonly browser: BrowserSpeechRecognitionProvider;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private frame = 0;
  private timeout: number | null = null;
  private chunks: Blob[] = [];
  private active = false;
  private heardSpeech = false;
  private startedAt = 0;
  private lastSpeechAt = 0;
  private onFinal: ((segment: FinalSpeechSegment) => void) | null = null;
  private onError: ((message: string) => void) | null = null;
  private onEnded: (() => void) | null = null;
  private onInterim: ((text: string) => void) | null = null;

  constructor(
    private readonly sessionId: string,
    private readonly providerName: string,
    language: "en" | "es" | "fr" = "en",
  ) {
    this.browser = new BrowserSpeechRecognitionProvider(language);
  }

  get supported(): boolean {
    if (this.providerName === "browser") return this.browser.supported;
    return typeof window !== "undefined" &&
      "MediaRecorder" in window &&
      "AudioContext" in window &&
      Boolean(navigator.mediaDevices?.getUserMedia);
  }

  start(
    onFinal: (segment: FinalSpeechSegment) => void,
    onError: (message: string) => void,
    onEnded?: () => void,
    onInterim?: (text: string) => void,
  ): void {
    this.stop();
    if (this.providerName === "browser") {
      this.browser.start(onFinal, onError, onEnded, onInterim);
      return;
    }
    if (!this.supported) {
      onError("Audio recording is not supported in this browser. Use text input instead.");
      return;
    }
    this.active = true;
    this.onFinal = onFinal;
    this.onError = onError;
    this.onEnded = onEnded ?? null;
    this.onInterim = onInterim ?? null;
    this.heardSpeech = false;
    this.chunks = [];
    void this.beginRecording();
  }

  private async beginRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!this.active) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.startedAt = Date.now();
      this.lastSpeechAt = this.startedAt;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : undefined;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      this.recorder = recorder;
      this.chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) this.chunks.push(event.data);
      };
      recorder.onerror = () => this.fail("Audio recording failed. Use text input instead.");
      recorder.onstop = () => void this.transcribeRecording(recorder.mimeType);
      recorder.start(250);

      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);
      this.detectSpeech();
      this.timeout = window.setTimeout(() => {
        if (!this.heardSpeech) {
          this.fail("No speech was detected. Try again or use text input.");
        } else {
          this.finishRecording();
        }
      }, 45_000);
    } catch (cause) {
      this.fail(
        cause instanceof Error
          ? `Microphone recording failed: ${cause.message}`
          : "Microphone recording failed. Use text input instead.",
      );
    }
  }

  private detectSpeech(): void {
    const analyser = this.analyser;
    if (!this.active || !analyser) return;
    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    const rms = Math.sqrt(
      samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) /
        samples.length,
    );
    const now = Date.now();
    if (rms > 0.035) {
      this.heardSpeech = true;
      this.lastSpeechAt = now;
    } else if (this.heardSpeech && now - this.lastSpeechAt >= 1_200) {
      this.finishRecording();
      return;
    }
    this.frame = window.requestAnimationFrame(() => this.detectSpeech());
  }

  public finishRecording(): void {
    if (this.timeout !== null) window.clearTimeout(this.timeout);
    this.timeout = null;
    if (this.frame) window.cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (this.recorder?.state === "recording") this.recorder.stop();
  }

  private async transcribeRecording(contentType: string): Promise<void> {
    const blob = new Blob(this.chunks, { type: contentType || "audio/webm" });
    this.chunks = [];
    this.recorder = null;
    this.releaseMedia();
    if (!blob.size) {
      this.fail("No audio was recorded. Try again or use text input.");
      return;
    }
    try {
      const result = await apiInterviewService.transcribeAudio(this.sessionId, blob);
      if (!this.active) return;
      const text = result.text.trim();
      if (!text) {
        this.fail("No speech was recognized. Try again or use text input.");
        return;
      }
      const endedAt = Date.now();
      this.active = false;
      this.onInterim?.("");
      this.onFinal?.({
        messageId: createMessageId(),
        text,
        timestampMs: endedAt,
        durationMs: Math.max(1, endedAt - this.startedAt),
        language: "en",
      });
      this.onEnded?.();
      this.clearCallbacks();
    } catch (cause) {
      this.fail(cause instanceof Error ? cause.message : "Speech transcription failed.");
    }
  }

  private fail(message: string): void {
    if (!this.active && !this.onError) return;
    this.active = false;
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      if (recorder.state === "recording") recorder.stop();
    }
    this.releaseMedia();
    this.onInterim?.("");
    this.onError?.(message);
    this.onEnded?.();
    this.clearCallbacks();
  }

  private releaseMedia(): void {
    if (this.timeout !== null) window.clearTimeout(this.timeout);
    this.timeout = null;
    if (this.frame) window.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.analyser = null;
    if (this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close();
    }
    this.audioContext = null;
  }

  private clearCallbacks(): void {
    this.onFinal = null;
    this.onError = null;
    this.onEnded = null;
    this.onInterim = null;
  }

  stop(): void {
    this.active = false;
    this.browser.stop();
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      if (recorder.state === "recording") recorder.stop();
    }
    this.chunks = [];
    this.releaseMedia();
    this.clearCallbacks();
  }
}

export class BrowserSpeechSynthesisProvider implements TTSProvider {
  private selectedVoiceURI: string | null = null;
  private rate = 1;
  private paused = false;
  private muted = false;

  get supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  get voices(): SpeechSynthesisVoice[] {
    return this.supported ? window.speechSynthesis.getVoices() : [];
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setVoice(voiceURI: string): void {
    this.selectedVoiceURI = voiceURI || null;
  }

  setRate(rate: number): void {
    this.rate = Math.min(2, Math.max(0.5, rate));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      window.speechSynthesis?.cancel();
      this.paused = false;
    }
  }

  speak(text: string, onEnd?: () => void): void {
    if (!this.supported || this.muted) {
      onEnd?.();
      return;
    }
    this.stop();
    this.paused = false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.rate;
    utterance.voice =
      this.voices.find((voice) => voice.voiceURI === this.selectedVoiceURI) ?? null;
    utterance.onend = () => {
      this.paused = false;
      onEnd?.();
    };
    utterance.onerror = () => {
      this.paused = false;
      onEnd?.();
    };
    window.speechSynthesis.speak(utterance);
  }

  pause(): void {
    if (!this.supported || this.paused || this.muted) return;
    window.speechSynthesis?.pause();
    this.paused = true;
  }

  resume(): void {
    if (!this.supported || !this.paused || this.muted) return;
    window.speechSynthesis?.resume();
    this.paused = false;
  }

  stop(): void {
    if (this.supported) window.speechSynthesis.cancel();
    this.paused = false;
  }
}
