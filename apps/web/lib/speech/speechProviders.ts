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
    recognition.interimResults = false;
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
        if (!result.isFinal) continue;
        const text = result[0]?.transcript.trim();
        if (!text) continue;
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

export class BrowserSpeechSynthesisProvider implements TTSProvider {
  get supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  speak(text: string, onEnd?: () => void): void {
    if (!this.supported) {
      onEnd?.();
      return;
    }
    this.stop();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (this.supported) window.speechSynthesis.cancel();
  }
}
