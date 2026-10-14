import type {
  InterviewConfig,
  InterviewReport,
  PerformanceHistory,
  CoachingPlan,
  JobDescription,
  CommunicationFingerprint,
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

export interface EvaluationReport {
  sessionId: string;
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  clarityScore: number;
  relevanceScore: number;
  problemSolvingScore: number;
  communicationFingerprint: {
    clarity: number;
    conciseness: number;
    structure: number;
    pace: number;
    fillerControl: number;
  };
  topWeakness: string;
  topStrength: string;
  recommendation: string;
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
  submitTranscript(id: string, message: string): Promise<void>;
  generateNextQuestion(id: string, candidateTranscript: string): Promise<{
    question_text: string;
    state: string;
    is_demo: boolean;
    source: "real" | "simulated";
    degraded: boolean;
  }>;
  endInterview(id: string): Promise<void>;
  getReport(id: string): Promise<InterviewReport | null>;
  getHistory(): Promise<InterviewConfig[]>;
  getPerformanceHistory(days?: number): Promise<PerformanceHistory[]>;
  analyzeJobDescription(text: string): Promise<JobDescription>;
  getFingerprint(interviewId: string): Promise<CommunicationFingerprint>;
  getCoachingPlan(interviewId: string): Promise<CoachingPlan>;
  generateBlueprint(candidateId: string, jobId: string, sessionId?: string): Promise<InterviewBlueprint>;
  generateEvaluation(sessionId: string): Promise<EvaluationReport>;
}
