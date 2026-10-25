import { afterEach, describe, expect, it, vi } from "vitest";
import { apiInterviewService } from "@/lib/services/apiInterviewService";
import {
  BrowserSpeechSynthesisProvider,
  InterviewTurnMachine,
  RecordedAudioSpeechRecognitionProvider,
} from "./speechProviders";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "SpeechRecognition");
  Reflect.deleteProperty(window, "speechSynthesis");
});

describe("speech providers", () => {
  it("uses browser speech recognition when the selected provider is browser", () => {
    const recognition = {
      start: vi.fn(),
      stop: vi.fn(),
      continuous: false,
      interimResults: false,
      lang: "",
      onresult: null,
      onerror: null,
      onspeechstart: null,
      onspeechend: null,
      onend: null,
    };
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: vi.fn(() => recognition),
    });

    const provider = new RecordedAudioSpeechRecognitionProvider("session-1", "browser");
    provider.start(vi.fn(), vi.fn());

    expect(recognition.start).toHaveBeenCalledOnce();
  });

  it("records an answer and posts its audio to the selected backend STT provider", async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(apiInterviewService, "transcribeAudio").mockResolvedValue({
      text: "I improved service reliability.",
      provider: "deepgram",
      model: "nova-3",
    });

    class MockAudioContext {
      state = "running";
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      createAnalyser() {
        return {
          fftSize: 0,
          getByteTimeDomainData: (samples: Uint8Array) => samples.fill(128),
        };
      }
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }
    class MockMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      state: RecordingState = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(readonly mediaStream: MediaStream) {}

      start() {
        this.state = "recording";
        queueMicrotask(() => {
          this.ondataavailable?.({
            data: new Blob(["audio"]),
          } as BlobEvent);
          this.state = "inactive";
          this.onstop?.();
        });
      }

      stop() {
        this.state = "inactive";
        this.onstop?.();
      }
    }
    vi.stubGlobal("AudioContext", MockAudioContext);
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    const onFinal = vi.fn();
    const provider = new RecordedAudioSpeechRecognitionProvider("session-2", "deepgram");
    provider.start(onFinal, vi.fn());

    await vi.waitFor(() => expect(onFinal).toHaveBeenCalledOnce());
    expect(apiInterviewService.transcribeAudio).toHaveBeenCalledWith(
      "session-2",
      expect.objectContaining({ type: "audio/webm" }),
    );
    expect(onFinal.mock.calls[0][0].text).toBe("I improved service reliability.");
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it("applies a selected browser voice and rate and cancels speech", () => {
    const voice = { name: "Test Voice", lang: "en-US", voiceURI: "test-voice" };
    const speak = vi.fn();
    const cancel = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [voice],
        speak,
        cancel,
      },
    });
    class MockUtterance {
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(readonly text: string) {}
    }
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);

    const provider = new BrowserSpeechSynthesisProvider();
    provider.setVoice("test-voice");
    provider.setRate(1.2);
    provider.speak("How would you design this service?");

    expect(speak).toHaveBeenCalledOnce();
    expect(speak.mock.calls[0][0]).toMatchObject({
      text: "How would you design this service?",
      voice,
      rate: 1.2,
    });
    provider.stop();
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});

describe("interview turn state machine", () => {
  it("starts in IDLE and allows IDLE -> ASKING", () => {
    const machine = new InterviewTurnMachine();
    expect(machine.currentState).toBe("IDLE");
    expect(machine.transition("ASKING")).toBe(true);
    expect(machine.currentState).toBe("ASKING");
  });

  it("rejects illegal transitions", () => {
    const machine = new InterviewTurnMachine();
    expect(machine.transition("LISTENING")).toBe(false);
    expect(machine.currentState).toBe("IDLE");
    machine.transition("ASKING");
    expect(machine.transition("TRANSCRIBING")).toBe(false);
    expect(machine.currentState).toBe("ASKING");
  });

  it("follows the full turn cycle IDLE -> ASKING -> LISTENING -> TRANSCRIBING -> EVALUATING -> ASKING", () => {
    const machine = new InterviewTurnMachine();
    expect(machine.transition("ASKING")).toBe(true);
    expect(machine.transition("LISTENING")).toBe(true);
    expect(machine.transition("TRANSCRIBING")).toBe(true);
    expect(machine.transition("EVALUATING")).toBe(true);
    expect(machine.transition("ASKING")).toBe(true);
    expect(machine.currentState).toBe("ASKING");
  });

  it("can transition to NEXT from ASKING or EVALUATING", () => {
    const m1 = new InterviewTurnMachine();
    m1.transition("ASKING");
    expect(m1.transition("NEXT")).toBe(true);

    const m2 = new InterviewTurnMachine();
    m2.transition("ASKING");
    m2.transition("LISTENING");
    m2.transition("TRANSCRIBING");
    m2.transition("EVALUATING");
    expect(m2.transition("NEXT")).toBe(true);
  });

  it("can transition to IDLE from NEXT or LISTENING", () => {
    const m1 = new InterviewTurnMachine();
    m1.transition("ASKING");
    m1.transition("LISTENING");
    expect(m1.transition("IDLE")).toBe(true);
    expect(m1.currentState).toBe("IDLE");

    const m2 = new InterviewTurnMachine();
    m2.transition("ASKING");
    m2.transition("LISTENING");
    m2.transition("TRANSCRIBING");
    m2.transition("EVALUATING");
    m2.transition("NEXT");
    expect(m2.transition("IDLE")).toBe(true);
    expect(m2.currentState).toBe("IDLE");
  });

  it("rejects transitions with stale request IDs", () => {
    const machine = new InterviewTurnMachine();
    const firstId = machine.nextRequestId();
    expect(machine.transition("ASKING", firstId + 1)).toBe(false);
    expect(machine.currentState).toBe("IDLE");
  });

  it("notifies subscribers of state changes", () => {
    const machine = new InterviewTurnMachine();
    const states: string[] = [];
    const unsubscribe = machine.subscribe((state) => {
      states.push(state);
    });
    expect(states).toContain("IDLE");
    machine.transition("ASKING");
    expect(states).toContain("ASKING");
    unsubscribe();
    machine.transition("LISTENING");
    expect(states.length).toBe(2);
  });
});

describe("TTS pause/resume/mute", () => {
  it("pause then resume works", () => {
    const speak = vi.fn();
    const pause = vi.fn();
    const resume = vi.fn();
    const cancel = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { getVoices: () => [], speak, pause, resume, cancel },
    });
    class MockUtterance {
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(readonly text: string) {}
    }
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);

    const provider = new BrowserSpeechSynthesisProvider();
    provider.speak("Hello world");
    expect(speak).toHaveBeenCalledOnce();
    expect(provider.isPaused).toBe(false);

    provider.pause();
    expect(pause).toHaveBeenCalledOnce();
    expect(provider.isPaused).toBe(true);

    provider.resume();
    expect(resume).toHaveBeenCalledOnce();
    expect(provider.isPaused).toBe(false);
  });

  it("mute cancels speech and blocks pause/resume", () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { getVoices: () => [], speak, cancel },
    });
    class MockUtterance {
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(readonly text: string) {}
    }
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);

    const provider = new BrowserSpeechSynthesisProvider();
    provider.setMuted(true);
    expect(provider.isMuted).toBe(true);
    provider.speak("Should not speak");
    expect(speak).not.toHaveBeenCalled();
    provider.pause();
    expect(provider.isPaused).toBe(false);
  });

  it("speak cancels previous utterance before starting new one", () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { getVoices: () => [], speak, cancel },
    });
    class MockUtterance {
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(readonly text: string) {}
    }
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);

    const provider = new BrowserSpeechSynthesisProvider();
    provider.speak("First question");
    provider.speak("Second question");
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(speak).toHaveBeenCalledTimes(2);
  });
});
