export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  plan: "free" | "pro" | "enterprise";
  overallReadiness: number;
  technicalKnowledge: number;
  communication: number;
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
  isDemo?: boolean;
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

export interface DashboardData {
  greeting: string;
  subtitle: string;
  overallReadiness: number | null;
  technicalKnowledge: number | null;
  communication: number | null;
  clarity: number | null;
  answerRelevance: number | null;
  recentInterviews: InterviewConfig[];
  performanceHistory: PerformanceHistory[];
  insights: string[];
  recommendations: string[];
}
