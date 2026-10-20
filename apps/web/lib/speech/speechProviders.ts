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

export class DeepgramSpeechRecognitionProvider implements STTProvider {
  private readonly fallback: BrowserSpeechRecognitionProvider;
  private socket: WebSocket | null = null;
  private recorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private active = false;
  private fallbackActive = false;
  private speechStartedAt = 0;
  private finalParts: string[] = [];
  private onFinal: ((segment: FinalSpeechSegment) => void) | null = null;
  private onError: ((message: string) => void) | null = null;
  private onEnded: (() => void) | null = null;
  private onInterim: ((text: string) => void) | null = null;

  constructor(
    private readonly sessionId: string,
    private readonly authToken: string | null,
    private readonly enabled: boolean,
    language: "en" | "es" | "fr" = "en",
  ) {
    this.fallback = new BrowserSpeechRecognitionProvider(language);
  }

  get supported(): boolean {
    return this.enabled
      ? typeof window !== "undefined" &&
          "MediaRecorder" in window &&
          Boolean(navigator.mediaDevices?.getUserMedia)
      : this.fallback.supported;
  }

  start(
    onFinal: (segment: FinalSpeechSegment) => void,
    onError: (message: string) => void,
    onEnded?: () => void,
    onInterim?: (text: string) => void,
  ): void {
    this.stop();
    this.active = true;
    this.onFinal = onFinal;
    this.onError = onError;
    this.onEnded = onEnded ?? null;
    this.onInterim = onInterim ?? null;

    if (!this.enabled || !this.supported) {
      this.startFallback();
      return;
    }

    const pageUrl = new URL(window.location.href);
    const socketUrl = new URL(
      `/api/interviews/sessions/${encodeURIComponent(this.sessionId)}/stt`,
      pageUrl.origin,
    );
    socketUrl.protocol = pageUrl.protocol === "https:" ? "wss:" : "ws:";
    if (this.authToken) socketUrl.searchParams.set("token", this.authToken);

    const socket = new WebSocket(socketUrl.toString());
    this.socket = socket;
    socket.onopen = () => {
      void this.startRecording();
    };
    socket.onmessage = (event) => this.handleMessage(event.data);
    socket.onerror = () => this.startFallback();
    socket.onclose = () => {
      if (this.active && !this.fallbackActive) this.startFallback();
    };
  }

  private async startRecording(): Promise<void> {
    try {
      if (!this.active) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!this.active) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.mediaStream = stream;
      this.speechStartedAt = Date.now();
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : undefined;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      this.recorder = recorder;
      recorder.ondataavailable = (event) => {
        const socket = this.socket;
        if (!event.data.size || socket?.readyState !== WebSocket.OPEN) return;
        void event.data.arrayBuffer().then((audio) => {
          if (socket.readyState === WebSocket.OPEN) socket.send(audio);
        }).catch(() => this.startFallback());
      };
      recorder.start(250);
    } catch {
      this.startFallback();
    }
  }

  private handleMessage(raw: string): void {
    let message: {
      type?: string;
      status?: string;
      message?: string;
      text?: string;
      is_final?: boolean;
      speech_final?: boolean;
      timestamp_ms?: number;
    };
    try {
      message = JSON.parse(raw) as typeof message;
    } catch {
      this.startFallback();
      return;
    }
    if (message.type === "provider") {
      if (message.status !== "ok") this.startFallback();
      return;
    }
    if (message.type !== "transcript" || !message.text) return;
    if (!message.is_final) {
      this.onInterim?.([...this.finalParts, message.text].join(" "));
      return;
    }
    this.finalParts.push(message.text);
    const fullText = this.finalParts.join(" ").trim();
    this.onInterim?.(fullText);
    if (!message.speech_final) return;

    this.onInterim?.("");
    this.finalParts = [];
    this.onFinal?.({
      messageId: createMessageId(),
      text: fullText,
      timestampMs: message.timestamp_ms ?? Date.now(),
      durationMs: this.speechStartedAt
        ? Math.max(1, Date.now() - this.speechStartedAt)
        : null,
      language: "en",
    });
  }

  private startFallback(): void {
    if (!this.active || this.fallbackActive) return;
    this.fallbackActive = true;
    this.stopDeepgram();
    this.fallback.start(
      (segment) => this.onFinal?.(segment),
      (message) => this.onError?.(message),
      () => this.onEnded?.(),
      (text) => this.onInterim?.(text),
    );
  }

  private stopDeepgram(): void {
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder?.state === "recording") recorder.stop();
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
    const socket = this.socket;
    this.socket = null;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "stop" }));
      socket.close();
    } else if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close();
    }
  }

  stop(): void {
    this.active = false;
    this.fallbackActive = false;
    this.fallback.stop();
    this.stopDeepgram();
    this.finalParts = [];
    this.onFinal = null;
    this.onError = null;
    this.onEnded = null;
    this.onInterim = null;
  }
}

export class BrowserSpeechSynthesisProvider implements TTSProvider {
  private selectedVoiceURI: string | null = null;
  private rate = 1;

  get supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  get voices(): SpeechSynthesisVoice[] {
    return this.supported ? window.speechSynthesis.getVoices() : [];
  }

  setVoice(voiceURI: string): void {
    this.selectedVoiceURI = voiceURI || null;
  }

  setRate(rate: number): void {
    this.rate = Math.min(2, Math.max(0.5, rate));
  }

  speak(text: string, onEnd?: () => void): void {
    if (!this.supported) {
      onEnd?.();
      return;
    }
    this.stop();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.rate;
    utterance.voice =
      this.voices.find((voice) => voice.voiceURI === this.selectedVoiceURI) ?? null;
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (this.supported) window.speechSynthesis.cancel();
  }
}
