import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BrowserSpeechSynthesisProvider,
  DeepgramSpeechRecognitionProvider,
} from "./speechProviders";

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "SpeechRecognition");
  Reflect.deleteProperty(window, "speechSynthesis");
});

describe("speech providers", () => {
  it("falls back to browser speech recognition when Deepgram is disabled", () => {
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

    class MockWebSocket {
      static OPEN = 1;
      static CONNECTING = 0;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = MockWebSocket.CONNECTING;
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: (() => void) | null = null;

      constructor(readonly url: string) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({ type: "provider", status: "disabled" }),
          });
        });
      }

      close = vi.fn();
      send = vi.fn();
    }
    vi.stubGlobal("WebSocket", MockWebSocket);

    const provider = new DeepgramSpeechRecognitionProvider(
      "session-1",
      "clerk-token",
      true,
    );
    provider.start(vi.fn(), vi.fn());

    expect(recognition.start).toHaveBeenCalledOnce();
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
