import type {
  InterviewConfig,
  PerformanceHistory,
  CoachingPlan,
  JobDescription,
  InterviewQuestion,
  DashboardData,
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

export interface UserProfile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  target_role: string | null;
  background: string | null;
  default_interview_persona: "friendly_founder" | "technical_lead" | "hr_recruiter" | "stress_interviewer";
  default_interview_difficulty: "easy" | "medium" | "hard";
}

export interface PersistedTranscriptEntry {
  message_id: string;
  sequence_number: number;
  speaker: "candidate" | "interviewer";
  text: string;
  timestamp_ms: number;
  source: "real" | "simulated";
}

export interface EvaluationMetric<T> {
  value: T | null;
  unit: string;
  reason: string | null;
}

export interface EvaluationReport {
  id: string;
  session_id: string;
  status: "processing" | "completed" | "failed" | "insufficient_data";
  rubric_version: string;
  provider: string | null;
  model: string | null;
  measured_metrics: {
    speaking_duration_seconds: EvaluationMetric<number>;
    words_per_minute: EvaluationMetric<number>;
    filler_word_rate: EvaluationMetric<number>;
    answer_length_words: EvaluationMetric<number>;
    time_remaining_seconds: EvaluationMetric<number>;
    questions_answered: EvaluationMetric<number>;
    answer_lengths_by_question: EvaluationMetric<{ question_id: string; words: number }[]>;
    filler_word_language_lists: Record<string, string[]>;
  };
  ai_assessments: {
    overall_score: number;
    category_scores: Record<string, { score: number; rationale: string }>;
    per_question_analysis: Array<{
      question_id: string;
      question: string;
      evidence_quote: string;
      rationale: string;
      category_scores: Record<string, number>;
    }>;
    strengths: string[];
    missing_elements: string[];
    improved_answer_structure: string[];
    practice_exercises: Array<{
      category: string;
      title: string;
      task: string;
      target_role: string;
    }>;
  } | null;
  error: string | null;
  guidance_note: string;
  created_at: string | null;
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
  getReport(id: string): Promise<EvaluationReport>;
  getTranscript(id: string): Promise<PersistedTranscriptEntry[]>;
  getHistory(): Promise<InterviewConfig[]>;
  getPerformanceHistory(days?: number): Promise<PerformanceHistory[]>;
  getUserReports(): Promise<EvaluationReport[]>;
  getProfile(): Promise<UserProfile>;
  updateProfile(update: Partial<Omit<UserProfile, "id" | "email">>): Promise<UserProfile>;
  getDashboardData(): Promise<DashboardData>;
  analyzeJobDescription(text: string): Promise<JobDescription>;
  getFingerprint(interviewId: string): Promise<EvaluationReport>;
  getCoachingPlan(interviewId: string): Promise<CoachingPlan>;
  updateCoachingProgress(
    interviewId: string,
    day: number,
    checked: boolean,
    notes?: string,
  ): Promise<{ completed_days: number }>;
  generateBlueprint(candidateId: string, jobId: string, sessionId?: string): Promise<InterviewBlueprint>;
  generateEvaluation(sessionId: string): Promise<EvaluationReport>;
}
