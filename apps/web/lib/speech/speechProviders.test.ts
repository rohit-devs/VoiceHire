import { afterEach, describe, expect, it, vi } from "vitest";
import { apiInterviewService } from "@/lib/services/apiInterviewService";
import {
  BrowserSpeechSynthesisProvider,
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
