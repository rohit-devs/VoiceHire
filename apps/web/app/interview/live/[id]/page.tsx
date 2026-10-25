"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiInterviewService as interviewService } from "@/lib/services/apiInterviewService";
import { useInterviewStore } from "@/stores/interviewStore";
import { useInterviewWebSocket } from "@/hooks/useInterviewWebSocket";
import { useAgoraVoice, type AgoraVoiceState } from "@/hooks/useAgoraVoice";
import { getGuestId } from "@/lib/guest";
import { VoiceOrb } from "@/components/interview/VoiceOrb";
import { Loader2, ArrowRight, PhoneOff, Mic, MicOff } from "lucide-react";
import { Button, Card, Textarea } from "@/components/ui/primitives";
import {
  RecordedAudioSpeechRecognitionProvider,
  BrowserSpeechSynthesisProvider,
  InterviewTurnMachine,
  type FinalSpeechSegment,
  type STTProvider,
  type InterviewTurnState,
} from "@/lib/speech/speechProviders";

interface RoomTranscript {
  id: string;
  sequenceNumber: number;
  speaker: "candidate" | "interviewer";
  text: string;
  timestamp: number;
}

interface MetricResult {
  value: number | null;
  unit: string;
  reason: string | null;
}

export default function LiveInterviewPage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = params.id as string;
  const { setInterviewPhase, setSessionId } = useInterviewStore();

  const [guestId, setGuestIdState] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [aiQuestion, setAiQuestion] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [transcripts, setTranscripts] = useState<RoomTranscript[]>([]);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [orbState, setOrbState] = useState<AgoraVoiceState | "thinking" | "speaking" | "listening" | "user-speaking">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const [useRealVoice, setUseRealVoice] = useState(true);
  const [secureContext, setSecureContext] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [sttProviderName, setSTTProviderName] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [speechRestartSignal, setSpeechRestartSignal] = useState(0);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechVoiceURI, setSpeechVoiceURI] = useState("");
  const [speechRate, setSpeechRate] = useState(1);
  const [isDemo, setIsDemo] = useState(false);
  const [interviewType, setInterviewType] = useState("Interview");
  const [autoScroll, setAutoScroll] = useState(true);
  const [actionError, setActionError] = useState("");
  const [lastSubmittedAnswer, setLastSubmittedAnswer] = useState("");
  const [turnState, setTurnState] = useState<InterviewTurnState>("IDLE");
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<STTProvider | null>(null);
  const speechSynthesisRef = useRef<BrowserSpeechSynthesisProvider | null>(null);
  const processingAnswerRef = useRef(false);
  const spokenQuestionRef = useRef("");
  const turnMachineRef = useRef(new InterviewTurnMachine());

  const sessionId = interviewId;
  const {
    isConnected: wsConnected,
    isConnecting: wsConnecting,
    transcripts: wsTranscripts,
    metrics: wsMetrics,
    connect: connectWebSocket,
    disconnect: disconnectWebSocket,
  } = useInterviewWebSocket({ sessionId, autoConnect: false, guestId });

  const {
    state: agoraState,
    isMuted,
    audioLevel,
    networkQuality,
    join: joinAgora,
    leave: leaveAgora,
    mute: muteAgora,
    unmute: unmuteAgora,
  } = useAgoraVoice({ sessionId, guestId });

  // Resolve guest identity from localStorage; backend issues a cookie on first visit.
  useEffect(() => {
    const secure = window.isSecureContext;
    setSecureContext(secure);
    if (!secure) {
      setUseRealVoice(false);
      setSpeechError("Microphone needs HTTPS or localhost");
    }
    let active = true;
    void (async () => {
      const id = getGuestId();
      if (active) setGuestIdState(id);
    })().catch((cause: unknown) => {
      if (active) setActionError(cause instanceof Error ? cause.message : "Unable to load guest identity.");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void interviewService
      .getSTTProvider()
      .then((providerName) => {
        if (active) setSTTProviderName(providerName);
      })
      .catch((cause: unknown) => {
        if (active) {
          setSpeechError(
            cause instanceof Error
              ? cause.message
              : "Speech recognition provider status is unavailable.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Initialize the persisted session.
  useEffect(() => {
    interviewService
      .getInterview(interviewId)
      .then((session) => {
        if (!session) throw new Error("Interview session was not found.");
        setIsDemo(session.isDemo ?? false);
        setInterviewType(session.interviewType.replace("_", " "));
        setSessionId(sessionId);
        setInterviewPhase("live");
        setLoading(false);
      })
      .catch((cause) => {
        setActionError(cause instanceof Error ? cause.message : "Failed to load interview.");
        setLoading(false);
      });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      disconnectWebSocket();
      leaveAgora();
    };
  }, [interviewId, sessionId, setSessionId, setInterviewPhase, disconnectWebSocket, leaveAgora]);

  // Sync WebSocket transcripts to local state (merge, don't replace)
  useEffect(() => {
    if (wsTranscripts.length > 0) {
      const mapped = wsTranscripts.map((transcript) => ({
        id: transcript.message_id,
        sequenceNumber: transcript.sequence_number,
        speaker: transcript.speaker,
        text: transcript.text,
        timestamp: transcript.timestamp_ms,
      }));
      // Merge WebSocket transcripts into local, skipping exact duplicates
      setTranscripts((prev) => {
        const byId = new Map(prev.map((transcript) => [transcript.id, transcript]));
        for (const transcript of mapped) byId.set(transcript.id, transcript);
        return [...byId.values()].sort((left, right) => left.sequenceNumber - right.sequenceNumber);
      });
      const latestQuestion = [...wsTranscripts].reverse().find((t) => t.speaker === "interviewer");
      if (latestQuestion) setAiQuestion(latestQuestion.text);
    }
  }, [wsTranscripts]);

  // Sync WebSocket metrics
  useEffect(() => {
    if (wsMetrics) setMetrics(wsMetrics.metrics);
  }, [wsMetrics]);

  useEffect(() => {
    const recognition = sttProviderName
      ? new RecordedAudioSpeechRecognitionProvider(sessionId, sttProviderName, "en")
      : null;
    const synthesis = new BrowserSpeechSynthesisProvider();
    speechRecognitionRef.current = recognition;
    speechSynthesisRef.current = synthesis;
    setSpeechSupported(recognition?.supported ?? false);
    const updateVoices = () => setSpeechVoices(synthesis.voices);
    updateVoices();
    if (synthesis.supported) window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
    return () => {
      recognition?.stop();
      synthesis.stop();
      if (synthesis.supported) window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
      speechRecognitionRef.current = null;
      speechSynthesisRef.current = null;
    };
  }, [sttProviderName, sessionId]);

  // Subscribe to interview turn state machine
  useEffect(() => {
    const unsubscribe = turnMachineRef.current.subscribe((state) => {
      setTurnState(state);
    });
    return unsubscribe;
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (autoScroll) transcriptEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [autoScroll, transcripts]);

  // Timer
  useEffect(() => {
    if (!isInterviewStarted) return;
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isInterviewStarted]);

  const appendTranscript = useCallback((transcript: RoomTranscript) => {
    setTranscripts((previous) => {
      if (previous.some((entry) => entry.id === transcript.id)) return previous;
      return [...previous, transcript].sort(
        (left, right) => left.sequenceNumber - right.sequenceNumber,
      );
    });
  }, []);

  const startInterview = useCallback(async () => {
    setActionError("");
    try {
      const startResponse = await interviewService.startInterview(sessionId);
      if (startResponse.question_text) {
        setAiQuestion(startResponse.question_text);
        if (startResponse.message_id && startResponse.sequence_number && startResponse.timestamp_ms) {
          appendTranscript({
            id: startResponse.message_id,
            sequenceNumber: startResponse.sequence_number,
            speaker: "interviewer",
            text: startResponse.question_text,
            timestamp: startResponse.timestamp_ms,
          });
        }
        turnMachineRef.current.transition("ASKING");
      }
      setIsInterviewStarted(true);
      setOrbState(useRealVoice ? "listening" : "idle");
      connectWebSocket();
      if (useRealVoice) void joinAgora();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Failed to start interview.");
      setIsInterviewStarted(false);
    }
  }, [appendTranscript, connectWebSocket, joinAgora, sessionId, useRealVoice]);

  const submitAnswer = useCallback(
    async (candidateText?: string, speechSegment?: FinalSpeechSegment) => {
      const message = (candidateText ?? answerText).trim();
      if (!message || processingAnswerRef.current) return;
      processingAnswerRef.current = true;
      speechRecognitionRef.current?.stop();
      speechSynthesisRef.current?.stop();
      setActionError("");
      setOrbState("user-speaking");
      try {
        if (turnMachineRef.current.canTransition("TRANSCRIBING")) {
          turnMachineRef.current.transition("TRANSCRIBING");
        }
        const acknowledgment = await interviewService.submitTranscript(sessionId, message, {
          messageId: speechSegment?.messageId,
          durationMs: speechSegment?.durationMs,
          language: speechSegment?.language,
        });
        appendTranscript({
          id: acknowledgment.message_id,
          sequenceNumber: acknowledgment.sequence_number,
          speaker: "candidate",
          text: message,
          timestamp: acknowledgment.timestamp_ms,
        });
        setAnswerText("");
        setLastSubmittedAnswer(message);
        if (turnMachineRef.current.canTransition("EVALUATING")) {
          turnMachineRef.current.transition("EVALUATING");
        }
        setOrbState("thinking");
        const nextQuestion = await interviewService.generateNextQuestion(sessionId, message);
        setAiQuestion(nextQuestion.question_text);
        appendTranscript({
          id: nextQuestion.message_id,
          sequenceNumber: nextQuestion.sequence_number,
          speaker: "interviewer",
          text: nextQuestion.question_text,
          timestamp: nextQuestion.timestamp_ms,
        });
        setLastSubmittedAnswer("");
        if (nextQuestion.state === "completed") {
          setInterviewPhase("processing");
          disconnectWebSocket();
          speechRecognitionRef.current?.stop();
          speechSynthesisRef.current?.stop();
          leaveAgora();
          router.push(`/interview/complete/${interviewId}`);
        } else if (turnMachineRef.current.canTransition("ASKING")) {
          turnMachineRef.current.transition("ASKING");
        }
        setOrbState(useRealVoice ? "speaking" : "idle");
      } catch (cause) {
        setActionError(
          cause instanceof Error ? cause.message : "Failed to submit answer or generate the next question.",
        );
        setOrbState(useRealVoice ? "listening" : "idle");
        if (turnMachineRef.current.canTransition("LISTENING")) {
          turnMachineRef.current.transition("LISTENING");
        }
      } finally {
        processingAnswerRef.current = false;
      }
    },
    [
      answerText,
      appendTranscript,
      disconnectWebSocket,
      interviewId,
      leaveAgora,
      router,
      sessionId,
      setInterviewPhase,
      useRealVoice,
    ],
  );

  const retryQuestionGeneration = useCallback(async () => {
    if (!lastSubmittedAnswer) return;
    setActionError("");
    setOrbState("thinking");
    try {
      const nextQuestion = await interviewService.generateNextQuestion(sessionId, lastSubmittedAnswer);
      setAiQuestion(nextQuestion.question_text);
      appendTranscript({
        id: nextQuestion.message_id,
        sequenceNumber: nextQuestion.sequence_number,
        speaker: "interviewer",
        text: nextQuestion.question_text,
        timestamp: nextQuestion.timestamp_ms,
      });
      setLastSubmittedAnswer("");
      setOrbState(useRealVoice ? "speaking" : "idle");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Failed to generate the next question.");
      setOrbState(useRealVoice ? "listening" : "idle");
    }
  }, [appendTranscript, lastSubmittedAnswer, sessionId, useRealVoice]);

  const speakCurrentQuestion = useCallback(() => {
    if (
      !isInterviewStarted ||
      !useRealVoice ||
      !aiQuestion ||
      spokenQuestionRef.current === aiQuestion
    )
      return;
    const synthesis = speechSynthesisRef.current;
    if (!synthesis?.supported) return;
    synthesis.setVoice(speechVoiceURI);
    synthesis.setRate(speechRate);
    spokenQuestionRef.current = aiQuestion;
    setOrbState("speaking");
    synthesis.speak(aiQuestion, () => setOrbState("listening"));
  }, [aiQuestion, isInterviewStarted, speechRate, speechVoiceURI, useRealVoice]);

  useEffect(() => {
    speakCurrentQuestion();
  }, [speakCurrentQuestion]);

  useEffect(() => {
    const recognition = speechRecognitionRef.current;
    if (
      !isInterviewStarted ||
      !useRealVoice ||
      !speechSupported ||
      speechError ||
      orbState !== "listening" ||
      lastSubmittedAnswer ||
      processingAnswerRef.current ||
      !recognition
    ) {
      recognition?.stop();
      return;
    }
    try {
      if (turnMachineRef.current.canTransition("LISTENING")) {
        turnMachineRef.current.transition("LISTENING");
      }
      recognition.start(
        (segment) => {
          recognition.stop();
          setSpeechError(null);
          void submitAnswer(segment.text, segment);
        },
        (message) => {
          setSpeechError(message);
          setOrbState("idle");
        },
        () => {
          if (!processingAnswerRef.current) setSpeechRestartSignal((value) => value + 1);
        },
        setInterimTranscript,
      );
    } catch (cause) {
      setSpeechError(cause instanceof Error ? cause.message : "Speech recognition could not start.");
    }
    return () => recognition.stop();
  }, [
    isInterviewStarted,
    lastSubmittedAnswer,
    orbState,
    speechError,
    speechRestartSignal,
    speechSupported,
    submitAnswer,
    useRealVoice,
  ]);

  const handleEndInterview = async () => {
    if (!window.confirm("End this interview and save the session?")) return;
    setActionError("");
    try {
      await interviewService.endInterview(interviewId);
      setInterviewPhase("processing");
      disconnectWebSocket();
      speechRecognitionRef.current?.stop();
      speechSynthesisRef.current?.stop();
      await leaveAgora();
      router.push(`/interview/complete/${interviewId}`);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Failed to end interview.");
    }
  };

  const toggleVoiceMode = async () => {
    const enableVoice = !useRealVoice;
    setUseRealVoice(enableVoice);
    setSpeechError(null);
    if (!enableVoice) {
      speechSynthesisRef.current?.stop();
      speechRecognitionRef.current?.stop();
      speechSynthesisRef.current?.stop();
      await leaveAgora();
      setOrbState("idle");
    } else if (isInterviewStarted) {
      void joinAgora();
      setOrbState("listening");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  const interviewerQuestions = transcripts.filter((transcript) => transcript.speaker === "interviewer");
  const currentQuestion = { q: aiQuestion || "Waiting for the AI interviewer...", category: "Live session" };

  return (
    <div className="h-screen w-full bg-[#0a0a0f] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="min-h-12 border-b border-white/[0.08] bg-[#0a0a0f] flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[13px] font-semibold text-white">Live Interview</span>
          {isDemo && (
            <span className="text-[10px] font-semibold text-amber-200 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Simulated demo
            </span>
          )}
          <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
            <span className="capitalize">{interviewType}</span>
          </span>
          {wsConnected && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Live</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void toggleVoiceMode()}
            disabled={!secureContext}
            aria-label={
              secureContext ? undefined : "Voice unavailable: microphone needs HTTPS or localhost"
            }
            className={`text-[11px] px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
              useRealVoice
                ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                : "bg-white/5 text-slate-400 border-white/10"
            }`}
          >
            {useRealVoice ? "Voice mode: On" : "Voice mode: Off"}
          </button>
          <span className="text-[13px] font-mono text-muted-foreground">{formatTime(elapsed)}</span>
          <Button
            onClick={handleEndInterview}
            variant="danger"
            className="min-h-8 gap-1.5 px-3 py-1.5 text-xs"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            End Interview
          </Button>
        </div>
      </header>

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex flex-col overflow-hidden lg:flex-row">
        {/* Left Column - Session Info */}
        <div className="w-48 border-r border-white/[0.08] bg-[#0a0a0f] p-4 flex-col hidden md:flex">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Progress
              </p>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Question</span>
                <span className="text-xs font-semibold text-white">{interviewerQuestions.length}</span>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Category
              </p>
              <span className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded-md inline-block capitalize">
                {currentQuestion?.category}
              </span>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Timer
              </p>
              <p className="text-sm font-mono text-white">{formatTime(elapsed)}</p>
            </div>

            {useRealVoice && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Voice Status
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Optional RTC</span>
                    <span
                      className={`text-[11px] ${
                        agoraState === "connected" ? "text-emerald-400" : "text-muted-foreground"
                      }`}
                    >
                      {agoraState === "connected" ? "connected" : "not required"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">WebSocket</span>
                    <span
                      className={`text-[11px] ${wsConnected ? "text-emerald-400" : "text-amber-400"}`}
                    >
                      {wsConnecting ? "Connecting..." : wsConnected ? "Live" : "Off"}
                    </span>
                  </div>
                  {networkQuality && (
                    <p className="text-[10px] text-muted-foreground">
                      Network quality uplink {networkQuality.uplink}/downlink {networkQuality.downlink}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Questions
            </p>
            <div className="space-y-1">
              {interviewerQuestions.map((transcript, i) => (
                <div
                  key={transcript.id}
                  className={`rounded-md px-2 py-1.5 text-[11px] transition-all ${
                    i === interviewerQuestions.length - 1
                      ? "bg-violet-500/10 border border-violet-500/20 text-violet-300"
                      : "text-muted-foreground"
                  }`}
                >
                  <span className="font-medium">Q{i + 1}:</span> {transcript.text.slice(0, 35)}...
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Column - Interview */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* AI Interviewer Card */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="w-full max-w-2xl space-y-6">
              {/* AI Card */}
              <Card className="p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <VoiceOrb
                      state={orbState}
                      size={64}
                      audioLevel={agoraState === "connected" ? audioLevel : 0}
                      connected={agoraState === "connected"}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-white">AI Interviewer</span>
                      <span
                        aria-live="polite"
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          orbState === "speaking"
                            ? "bg-violet-500/15 text-violet-200"
                            : orbState === "listening"
                              ? "bg-blue-500/15 text-blue-200"
                              : orbState === "thinking"
                                ? "bg-amber-500/15 text-amber-100"
                                : "bg-white/10 text-slate-200"
                        }`}
                      >
                        {orbState === "speaking"
                          ? "AI speaking"
                          : orbState === "listening"
                            ? "Listening"
                            : orbState === "thinking"
                              ? "Thinking"
                              : isInterviewStarted
                                ? "Ready for your answer"
                                : "Idle"}
                      </span>
                    </div>
                    <p className="text-[15px] text-white leading-relaxed">{currentQuestion?.q}</p>
                    {useRealVoice && (
                      <p className="mt-3 text-[11px] text-slate-400">
                        {speechSupported
                          ? "Streaming speech with browser fallback · Local speech playback · Agora optional"
                          : "Voice recognition is unavailable. You can continue with text input."}
                      </p>
                    )}
                    {!secureContext && (
                      <p
                        role="status"
                        className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm leading-relaxed text-amber-100"
                      >
                        Microphone needs HTTPS or localhost. Continue by typing your answer below.
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              {/* User Response Card */}
              {transcripts.filter((t) => t.speaker === "candidate").length > 0 && (
                <Card className="border-emerald-500/20 bg-emerald-500/[0.03] p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">You</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-emerald-300">You</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Speaking
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        {agoraState === "connected" && audioLevel > 0 && (
                          <span className="text-[10px] text-emerald-300">
                            Microphone level {Math.round(audioLevel)}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-emerald-100 leading-relaxed">
                        {transcripts.filter((t) => t.speaker === "candidate").pop()?.text}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Controls */}
              {useRealVoice && (
                <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
                  {speechVoices.length > 0 && (
                    <label className="flex items-center gap-2">
                      Interviewer voice
                      <select
                        value={speechVoiceURI}
                        onChange={(event) => {
                          const voiceURI = event.target.value;
                          setSpeechVoiceURI(voiceURI);
                          speechSynthesisRef.current?.setVoice(voiceURI);
                        }}
                        className="min-h-10 rounded-md border border-white/10 bg-[#141414] px-2 text-foreground"
                      >
                        <option value="">System default</option>
                        {getUniqueSpeechVoices(speechVoices).map((voice) => (
                          <option
                            key={voice.voiceURI || `${voice.name}|${voice.lang}`}
                            value={voice.voiceURI}
                          >
                            {voice.name} ({voice.lang})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="flex items-center gap-2">
                    Speech rate
                    <input
                      type="range"
                      min="0.75"
                      max="1.25"
                      step="0.05"
                      value={speechRate}
                      onChange={(event) => {
                        const rate = Number(event.target.value);
                        setSpeechRate(rate);
                        speechSynthesisRef.current?.setRate(rate);
                      }}
                      aria-label="Interviewer speech rate"
                    />
                    <span>{speechRate.toFixed(2)}×</span>
                  </label>
                </div>
              )}
              <div className="flex items-center justify-center gap-3">
                {!isInterviewStarted ? (
                  <Button
                    onClick={startInterview}
                    disabled={agoraState === "connecting" || agoraState === "requesting-permission"}
                    className="rounded-xl px-6 py-2.5 shadow-lg shadow-violet-500/25"
                  >
                    {agoraState === "connecting" || agoraState === "requesting-permission" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {agoraState === "requesting-permission"
                          ? "Requesting microphone..."
                          : "Connecting..."}
                      </>
                    ) : (
                      <>
                        Start Interview
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <Textarea
                      value={answerText}
                      onChange={(event) => setAnswerText(event.target.value)}
                      placeholder="Type your answer"
                      rows={2}
                      aria-label="Type your answer"
                      className="max-w-md bg-white/5"
                    />
                    <Button
                      onClick={() => void submitAnswer()}
                      disabled={!answerText.trim() || orbState === "thinking"}
                      className="bg-emerald-700 text-white hover:bg-emerald-600"
                    >
                      Submit Answer
                    </Button>
                    {useRealVoice && speechSupported && turnState === "LISTENING" && (
                      <button
                        onClick={() => {
                          const provider = speechRecognitionRef.current;
                          if (provider && "finishRecording" in provider) {
                            (provider as RecordedAudioSpeechRecognitionProvider).finishRecording();
                          }
                        }}
                        aria-label="Done answering"
                        className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-200 hover:bg-violet-500/20"
                      >
                        Done Answering
                      </button>
                    )}
                    {agoraState === "connected" && (
                      <button
                        onClick={() => void (isMuted ? unmuteAgora() : muteAgora())}
                        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      >
                        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Error display */}
              {actionError && (
                <div role="alert" className="text-xs text-rose-400 text-center">
                  {actionError}
                  {lastSubmittedAnswer && (
                    <button onClick={retryQuestionGeneration} className="ml-2 underline">
                      Retry question
                    </button>
                  )}
                  <p className="mt-1 text-muted-foreground">
                    Typed answers remain available.{" "}
                    <Link href="/interview/new" className="underline">
                      Return to setup for a simulated demo
                    </Link>
                    .
                  </p>
                </div>
              )}
              {(speechError || (!speechSupported && isInterviewStarted)) && (
                <div role="status" className="text-xs text-amber-300 text-center">
                  {speechError || "Browser speech recognition is unsupported; use text input."}
                  <p className="mt-1 text-slate-400">Your interview remains available in text mode.</p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Metrics */}
          {isInterviewStarted && (
            <div className="grid grid-cols-2 gap-3 border-t border-white/[0.08] bg-[#0a0a0f] p-4 sm:grid-cols-3 lg:grid-cols-6">
              <MetricItem label="Speaking time" metric={getMetric(metrics, "speaking_duration_seconds")} />
              <MetricItem label="Words per minute" metric={getMetric(metrics, "words_per_minute")} />
              <MetricItem label="Filler rate" metric={getMetric(metrics, "filler_word_rate")} />
              <MetricItem label="Average answer" metric={getMetric(metrics, "answer_length_words")} />
              <MetricItem label="Time remaining" metric={getMetric(metrics, "time_remaining_seconds")} />
              <div className="flex min-w-0 flex-col justify-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <span className="text-xs font-medium text-slate-300">Interview progress</span>
                <span className="mt-1 text-sm font-semibold text-white">
                  {interviewerQuestions.length} questions asked
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Transcript */}
        <div className="h-52 w-full shrink-0 border-t border-white/[0.08] bg-[#0a0a0f] flex flex-col lg:h-auto lg:w-80 lg:border-l lg:border-t-0">
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-white">Live Transcript</h3>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(event) => setAutoScroll(event.target.checked)}
                className="rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500/20"
              />
              <span className="text-[11px] text-muted-foreground">Auto-scroll</span>
            </label>
          </div>
          {interimTranscript && (
            <p aria-hidden="true" className="px-4 pt-3 text-xs italic text-muted-foreground">
              {interimTranscript}
            </p>
          )}
          <div
            role="log"
            aria-label="Interview transcript"
            aria-live="polite"
            aria-relevant="additions"
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {transcripts.map((t) => (
              <div
                key={t.id}
                className={`rounded-lg p-3 text-sm ${
                  t.speaker === "candidate"
                    ? "bg-emerald-500/10 border border-emerald-500/20 ml-2"
                    : "bg-violet-500/10 border border-violet-500/20 mr-2"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[11px] font-medium ${
                      t.speaker === "candidate" ? "text-emerald-400" : "text-violet-400"
                    }`}
                  >
                    {t.speaker === "candidate" ? "You" : "AI Interviewer"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatTimestamp(t.timestamp)}
                  </span>
                </div>
                <p className="text-[13px] text-slate-200 leading-relaxed">{t.text}</p>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

function getUniqueSpeechVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const seen = new Set<string>();
  return voices.filter((voice) => {
    const key = voice.voiceURI || `${voice.name}|${voice.lang}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getMetric(metrics: Record<string, unknown> | null, key: string): MetricResult {
  const value = metrics?.[key];
  if (!value || typeof value !== "object") {
    return { value: null, unit: "", reason: "Metrics are not available yet." };
  }
  const candidate = value as Partial<MetricResult>;
  return {
    value: typeof candidate.value === "number" ? candidate.value : null,
    unit: typeof candidate.unit === "string" ? candidate.unit : "",
    reason: typeof candidate.reason === "string" ? candidate.reason : null,
  };
}

function MetricItem({ label, metric }: { label: string; metric: MetricResult }) {
  const value =
    metric.value === null
      ? "—"
      : `${Number.isInteger(metric.value) ? metric.value : metric.value.toFixed(1)} ${metric.unit}`;
  return (
    <div className="flex items-center gap-3" title={metric.reason ?? undefined}>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className="text-sm font-bold text-white"
          aria-label={metric.reason ?? `${label}: ${value}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
