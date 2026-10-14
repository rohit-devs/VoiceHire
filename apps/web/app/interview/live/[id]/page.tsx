"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiInterviewService as interviewService } from "@/lib/services/apiInterviewService";
import { useInterviewStore } from "@/stores/interviewStore";
import { useInterviewWebSocket } from "@/hooks/useInterviewWebSocket";
import { useFetchAgoraToken } from "@/hooks/useFetchAgoraToken";
import { useAgoraRTC } from "@/hooks/useAgoraRTC";
import { useAuth } from "@clerk/nextjs";
import { VoiceOrb } from "@/components/interview/VoiceOrb";
import { Loader2, ArrowRight, PhoneOff } from "lucide-react";

type OrbState = "idle" | "listening" | "thinking" | "speaking" | "user_speaking" | "interrupted";

interface TranscriptMessage {
  id: string;
  speaker: "candidate" | "interviewer";
  text: string;
  timestamp: number;
}

interface LiveMetrics {
  clarity: number;
  confidence: number;
  relevance: number;
  fillerWordsCount: number;
  avgWpm: number;
  longPauses: number;
  avgResponseTime: number;
  answerStructure: number;
}

export default function LiveInterviewPage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = params.id as string;
  const { setInterviewPhase, setSessionId } = useInterviewStore();

  const { isLoaded: clerkLoaded, isSignedIn, getToken } = useAuth();
  const [authToken, setAuthTokenState] = useState<string | null>(null);

  const [agoraToken, setAgoraToken] = useState("");
  const [agoraChannel, setAgoraChannel] = useState("");
  const [loading, setLoading] = useState(true);
  const [aiQuestion, setAiQuestion] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const [useRealVoice, setUseRealVoice] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [actionError, setActionError] = useState("");
  const [lastSubmittedAnswer, setLastSubmittedAnswer] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket for real-time transcript/metrics
  const sessionId = interviewId;
  const {
    isConnected: wsConnected,
    isConnecting: wsConnecting,
    transcripts: wsTranscripts,
    metrics: wsMetrics,
    aiThinking,
    connect: connectWebSocket,
    disconnect: disconnectWebSocket,
   } = useInterviewWebSocket({ sessionId, autoConnect: false, authToken });

   // Agora token fetching
   const { fetchToken, isLoading: tokenLoading, error: tokenError } = useFetchAgoraToken({ authToken });

  // Agora RTC
  const {
    isConnected: agoraConnected,
    isConnecting: agoraConnecting,
    error: agoraError,
    join: joinAgora,
    leave: leaveAgora,
   } = useAgoraRTC({
    token: agoraToken,
    channelName: agoraChannel || `vh-${interviewId}`,
    uid: 1,
    autoConnect: false,
   });

  // Load Clerk JWT for authenticated WebSocket/token requests
  useEffect(() => {
    if (!clerkLoaded) return;
    (async () => {
      const token = isSignedIn ? await getToken() : null;
      setAuthTokenState(token);
    })();
  }, [clerkLoaded, isSignedIn, getToken]);

  // Initialize the persisted session.
  useEffect(() => {
    interviewService.getInterview(interviewId)
      .then((session) => {
        if (!session) throw new Error("Interview session was not found.");
        setAgoraChannel(session.agoraChannel ?? "");
        setIsDemo(session.isDemo ?? false);
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
      const mapped = wsTranscripts.map((t, idx) => ({
        id: `ws-${idx}`,
        speaker: t.speaker,
        text: t.text,
        timestamp: t.timestamp_ms,
      }));
      // Merge WebSocket transcripts into local, skipping exact duplicates
      setTranscripts((prev) => {
        const existingKeys = new Set(prev.map((t) => `${t.speaker}:${t.text}`));
        const newOnes = mapped.filter(
          (t) => !existingKeys.has(`${t.speaker}:${t.text}`)
        );
        return [...prev, ...newOnes];
      });
      const latestQuestion = [...wsTranscripts].reverse().find((t) => t.speaker === "interviewer");
      if (latestQuestion) setAiQuestion(latestQuestion.text);
      setOrbState("speaking");
    }
  }, [wsTranscripts]);

  // Sync WebSocket metrics
  useEffect(() => {
    if (wsMetrics) {
      setMetrics({
        clarity: wsMetrics.clarity_score,
        confidence: wsMetrics.confidence_score,
        relevance: wsMetrics.relevance_score,
        fillerWordsCount: wsMetrics.filler_words_count,
        avgWpm: wsMetrics.avg_wpm,
        longPauses: 0,
        avgResponseTime: 0,
        answerStructure: 0,
      });
    }
  }, [wsMetrics]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Timer
  useEffect(() => {
    if (!isInterviewStarted) return;
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isInterviewStarted]);

  // The persisted API session is authoritative; realtime voice is optional.
  const startInterview = useCallback(async () => {
    setActionError("");
    try {
      const startResponse = await interviewService.startInterview(sessionId);
      if (startResponse.question_text) {
        setAiQuestion(startResponse.question_text);
        setTranscripts([{ id: "first-q", speaker: "interviewer", text: startResponse.question_text, timestamp: Date.now() }]);
      }
      setIsInterviewStarted(true);
      setOrbState("listening");
      if (useRealVoice && authToken && agoraChannel) {
        const tokenData = await fetchToken(agoraChannel, 1);
        if (tokenData) {
          setAgoraToken(tokenData.token);
          await joinAgora({
            token: tokenData.token,
            appId: tokenData.app_id,
            channelName: tokenData.channel_name,
            uid: tokenData.uid,
          });
          connectWebSocket();
          setOrbState("listening");
        }
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Failed to start interview.");
      setIsInterviewStarted(false);
    }
  }, [useRealVoice, authToken, agoraChannel, sessionId, fetchToken, joinAgora, connectWebSocket]);

  const submitAnswer = useCallback(async () => {
    const message = answerText.trim();
    if (!message) return;
    setActionError("");
    setOrbState("user_speaking");
    try {
      await interviewService.submitTranscript(sessionId, message);
      setTranscripts((prev) => [...prev, {
        id: `cand-${Date.now()}`,
        speaker: "candidate",
        text: message,
        timestamp: Date.now(),
      }]);
      setAnswerText("");
      setLastSubmittedAnswer(message);
      setOrbState("thinking");
      const nextQuestion = await interviewService.generateNextQuestion(sessionId, message);
      setAiQuestion(nextQuestion.question_text);
      setTranscripts((prev) => [...prev, {
        id: `question-${Date.now()}`,
        speaker: "interviewer",
        text: nextQuestion.question_text,
        timestamp: Date.now(),
      }]);
      setLastSubmittedAnswer("");
      setOrbState("listening");
      if (nextQuestion.state === "completed") {
        setInterviewPhase("processing");
        disconnectWebSocket();
        leaveAgora();
        router.push(`/interview/complete/${interviewId}`);
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Failed to submit answer or generate the next question.");
      setOrbState("listening");
    }
  }, [answerText, disconnectWebSocket, interviewId, leaveAgora, router, sessionId, setInterviewPhase]);

  const retryQuestionGeneration = useCallback(async () => {
    if (!lastSubmittedAnswer) return;
    setActionError("");
    setOrbState("thinking");
    try {
      const nextQuestion = await interviewService.generateNextQuestion(sessionId, lastSubmittedAnswer);
      setAiQuestion(nextQuestion.question_text);
      setTranscripts((prev) => [...prev, {
        id: `question-${Date.now()}`,
        speaker: "interviewer",
        text: nextQuestion.question_text,
        timestamp: Date.now(),
      }]);
      setLastSubmittedAnswer("");
      setOrbState("listening");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Failed to generate the next question.");
      setOrbState("listening");
    }
  }, [lastSubmittedAnswer, sessionId]);

  const handleEndInterview = async () => {
    setActionError("");
    try {
      await interviewService.endInterview(interviewId);
      setInterviewPhase("processing");
      disconnectWebSocket();
      leaveAgora();
      router.push(`/interview/complete/${interviewId}`);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Failed to end interview.");
    }
  };

  const toggleVoiceMode = () => {
    setUseRealVoice((enabled) => !enabled);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
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
      <header className="h-12 border-b border-white/[0.08] bg-[#0a0a0f] flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[13px] font-semibold text-white">Live Interview</span>
          {isDemo && (
            <span className="text-[10px] font-semibold text-amber-200 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Simulated demo
            </span>
          )}
          <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
            Technical Round
          </span>
          {wsConnected && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Live</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleVoiceMode}
            className={`text-[11px] px-2 py-1 rounded border transition-colors ${
              useRealVoice
                ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                : "bg-white/5 text-slate-400 border-white/10"
            }`}
          >
            {useRealVoice ? "Voice: ON" : "Voice: OFF"}
          </button>
          <span className="text-[13px] font-mono text-muted-foreground">{formatTime(elapsed)}</span>
          <button
            onClick={handleEndInterview}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            End Interview
          </button>
        </div>
      </header>

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Session Info */}
        <div className="w-48 border-r border-white/[0.08] bg-[#0a0a0f] p-4 flex-col hidden md:flex">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Progress</p>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Question</span>
                <span className="text-xs font-semibold text-white">{interviewerQuestions.length}</span>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Category</p>
              <span className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded-md inline-block capitalize">
                {currentQuestion?.category}
              </span>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Timer</p>
              <p className="text-sm font-mono text-white">{formatTime(elapsed)}</p>
            </div>

            {useRealVoice && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Voice Status</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Agora</span>
                    <span className={`text-[11px] ${agoraConnected ? "text-emerald-400" : "text-amber-400"}`}>
                      {agoraConnecting ? "Connecting..." : agoraConnected ? "Connected" : "Off"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">WebSocket</span>
                    <span className={`text-[11px] ${wsConnected ? "text-emerald-400" : "text-amber-400"}`}>
                      {wsConnecting ? "Connecting..." : wsConnected ? "Live" : "Off"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Questions</p>
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
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <VoiceOrb state={orbState} size={64} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-white">AI Interviewer</span>
                      {orbState === "speaking" && (
                        <span className="text-[10px] text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded">Speaking</span>
                      )}
                      {orbState === "thinking" && (
                        <span className="text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">Thinking</span>
                      )}
                      {orbState === "listening" && (
                        <span className="text-[10px] text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded">Listening</span>
                      )}
                      {aiThinking && (
                        <span className="text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded animate-pulse">AI Thinking</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <WaveformBars state={orbState} />
                    </div>
                    <p className="text-[15px] text-white leading-relaxed">
                      {currentQuestion?.q}
                    </p>
                  </div>
                </div>
              </div>

              {/* User Response Card */}
              {transcripts.filter(t => t.speaker === "candidate").length > 0 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">You</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-emerald-300">You</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Speaking</span>
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <GreenWaveformBars active={orbState === "user_speaking"} />
                      </div>
                      <p className="text-sm text-emerald-100 leading-relaxed">
                        {transcripts.filter(t => t.speaker === "candidate").pop()?.text}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                {!isInterviewStarted ? (
                  <button
                    onClick={startInterview}
                    disabled={tokenLoading || agoraConnecting}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all disabled:opacity-50"
                  >
                    {tokenLoading || agoraConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        Start Interview
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <textarea
                      value={answerText}
                      onChange={(event) => setAnswerText(event.target.value)}
                      placeholder="Type your answer"
                      rows={2}
                      className="w-full max-w-md rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                    >
                    </textarea>
                    <button
                      onClick={submitAnswer}
                      disabled={!answerText.trim() || orbState === "thinking"}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Submit Answer
                    </button>
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
                </div>
              )}
              {(tokenError || agoraError) && (
                <div className="text-xs text-rose-400 text-center">
                  {tokenError || agoraError}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Metrics */}
          {metrics && (
            <div className="h-16 border-t border-white/[0.08] bg-[#0a0a0f] flex items-center px-6 gap-6 flex-shrink-0">
              <MetricItem label="Speaking Pace" value={`${metrics.avgWpm} WPM`} />
              <MetricItem label="Filler Words" value={metrics.fillerWordsCount.toString()} />
              <MetricItem label="Clarity" value={`${metrics.clarity}%`} />
              <MetricItem label="Confidence" value={`${metrics.confidence}%`} />
              <MetricItem label="Relevance" value={`${metrics.relevance}%`} />
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Interview Progress</span>
                <span className="text-xs font-semibold text-white">{interviewerQuestions.length} asked</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Transcript */}
        <div className="w-80 border-l border-white/[0.08] bg-[#0a0a0f] flex flex-col hidden lg:flex">
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-white">Live Transcript</h3>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500/20" />
              <span className="text-[11px] text-muted-foreground">Auto-scroll</span>
            </label>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                  <span className={`text-[11px] font-medium ${t.speaker === "candidate" ? "text-emerald-400" : "text-violet-400"}`}>
                    {t.speaker === "candidate" ? "You" : "AI Interviewer"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{formatTimestamp(t.timestamp)}</span>
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

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function WaveformBars({ state }: { state: OrbState }) {
  const isActive = state === "speaking" || state === "thinking" || state === "listening";
  return (
    <div className="flex items-center gap-[3px] h-6">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-violet-400 transition-all duration-150"
          style={{
            height: isActive ? `${Math.random() * 16 + 4}px` : "4px",
            opacity: isActive ? 0.8 : 0.3,
            animation: isActive ? `waveform 0.6s ease-in-out infinite alternate` : "none",
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}

function GreenWaveformBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-[3px] h-5">
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-emerald-400 transition-all duration-150"
          style={{
            height: active ? `${Math.random() * 12 + 4}px` : "3px",
            opacity: active ? 0.8 : 0.3,
            animation: active ? `waveform 0.5s ease-in-out infinite alternate` : "none",
            animationDelay: `${i * 0.04}s`,
          }}
        />
      ))}
    </div>
  );
}
