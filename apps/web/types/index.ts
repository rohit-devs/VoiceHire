export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  plan: "free" | "pro" | "enterprise";
  overallReadiness: number;
  technicalKnowledge: number;
  communication: number;
  confidence: number;
  clarity: number;
  answerRelevance: number;
}

export interface Resume {
  id: string;
  filename: string;
  uploadedAt: string;
  skills: string[];
  experience: string;
  education: string;
}

export interface JobDescription {
  id: string;
  title: string;
  company: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: string;
  jobFitScore: number;
  matchedSkills: string[];
  missingSkills: string[];
}

export interface InterviewConfig {
  id: string;
  role: string;
  experienceLevel: string;
  interviewType: "technical" | "hr" | "behavioral" | "mixed" | "system_design";
  persona: "friendly_founder" | "technical_lead" | "hr_recruiter" | "stress_interviewer";
  difficulty: "easy" | "medium" | "hard";
  pressureMode: boolean;
  duration: number;
  company?: string;
  interviewerType?: string;
  resume?: Resume;
  jobDescription?: JobDescription;
  metadata?: Record<string, unknown>;
  agoraChannel?: string;
  createdAt: string;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  category: string;
  difficulty: string;
  followUp?: string;
  expectedPoints?: string[];
  whyAsked?: string;
  resumeConnection?: string;
  skillEvaluated?: string;
  strongAnswerCriteria?: string;
}

export interface TranscriptMessage {
  id: string;
  speaker: "candidate" | "interviewer";
  text: string;
  timestamp: number;
  metrics?: {
    wpm: number;
    pauseMs: number;
    fillerWords: string[];
  };
}

export interface InterviewMetrics {
  clarity: number;
  confidence: number;
  relevance: number;
  fillerWordsCount: number;
  avgWpm: number;
  longPauses: number;
  avgResponseTime: number;
  answerStructure: number;
}

export interface InterviewReport {
  id: string;
  interviewId: string;
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  clarityScore: number;
  problemSolvingScore: number;
  answerRelevanceScore: number;
  strengths: string[];
  improvements: string[];
  summary: string;
  communicationFingerprint: CommunicationFingerprint;
  detailedMetrics: InterviewMetrics;
  questions: InterviewQuestion[];
  transcripts: TranscriptMessage[];
  createdAt: string;
}

export interface CommunicationFingerprint {
  clarity: number;
  conciseness: number;
  speakingPace: number;
  confidence: number;
  fillerControl: number;
  answerStructure: number;
}

export interface CoachingPlanDay {
  day: number;
  title: string;
  description: string;
  duration: string;
  completed: boolean;
}

export interface CoachingPlan {
  id: string;
  interviewId: string;
  days: CoachingPlanDay[];
  totalDays: number;
  createdAt: string;
}

export interface PracticeSession {
  id: string;
  question: string;
  category: string;
  firstScore: number;
  secondScore?: number;
  improvement?: {
    clarity: number;
    conciseness: number;
    fillerWords: number;
  };
  createdAt: string;
}

export interface PerformanceHistory {
  date: string;
  overallScore: number;
  technical: number;
  communication: number;
  confidence: number;
  clarity: number;
  conciseness: number;
  fillerWords: number;
  speakingPace: number;
}

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

export interface DashboardData {
  greeting: string;
  subtitle: string;
  overallReadiness: number;
  technicalKnowledge: number;
  communication: number;
  confidence: number;
  clarity: number;
  answerRelevance: number;
  recentInterviews: InterviewConfig[];
  performanceHistory: PerformanceHistory[];
  insights: string[];
  recommendations: string[];
}
