import type {
  InterviewConfig,
  PerformanceHistory,
  CoachingPlan,
  JobDescription,
  InterviewQuestion,
} from "@/types";

export interface InterviewBlueprint {
  sessionId: string;
  candidateName: string;
  targetRole: string;
  company: string;
  overallFitScore: number;
  estimatedDifficultyLevel: number;
  interviewFocusAreas: string[];
  skillGaps: string[];
  skillStrengths: string[];
  expectedDurationSeconds: number;
  message: string;
}

export interface TranscriptAck {
  message_id: string;
  sequence_number: number;
  timestamp_ms: number;
  idempotent?: boolean;
}

export interface InterviewService {
  createInterview(config: Partial<InterviewConfig> & {
    resumeText?: string;
    jobDescriptionText?: string;
    jobCategory?: string;
    isDemo?: boolean;
  }): Promise<InterviewConfig>;
  getInterview(id: string): Promise<InterviewConfig | null>;
  startInterview(id: string): Promise<{ sessionId: string; questions: InterviewQuestion[]; question_text?: string }>;
  submitTranscript(
    id: string,
    message: string,
    metadata?: {
      messageId?: string;
      durationMs?: number | null;
      language?: "en" | "es" | "fr";
    },
  ): Promise<TranscriptAck>;
  generateNextQuestion(id: string, candidateTranscript: string): Promise<{
    question_text: string;
    state: string;
    is_demo: boolean;
    source: "real" | "simulated";
    degraded: boolean;
    message_id: string;
    sequence_number: number;
    timestamp_ms: number;
  }>;
  endInterview(id: string): Promise<void>;
  getReport(id: string): Promise<never>;
  getHistory(): Promise<InterviewConfig[]>;
  getPerformanceHistory(days?: number): Promise<PerformanceHistory[]>;
  analyzeJobDescription(text: string): Promise<JobDescription>;
  getFingerprint(interviewId: string): Promise<never>;
  getCoachingPlan(interviewId: string): Promise<CoachingPlan>;
  generateBlueprint(candidateId: string, jobId: string, sessionId?: string): Promise<InterviewBlueprint>;
  generateEvaluation(sessionId: string): Promise<never>;
}
