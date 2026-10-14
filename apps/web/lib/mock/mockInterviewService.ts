import type { InterviewService } from "@/lib/services/interviewService";
import type {
  InterviewConfig,
  InterviewReport,
  PerformanceHistory,
  CoachingPlan,
  JobDescription,
  CommunicationFingerprint,
  InterviewBlueprint,
  EvaluationReport,
  InterviewQuestion,
} from "@/types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MOCK_USER: InterviewConfig["resume"] = {
  id: "resume-1",
  filename: "Rohit_Resume_FullStack.pdf",
  uploadedAt: "2026-08-20T10:00:00Z",
  skills: ["React", "Node.js", "MongoDB", "JavaScript", "Express", "JWT", "TypeScript", "REST APIs"],
  experience: "3 years as Full Stack Developer at TechCorp",
  education: "B.Tech Computer Science, 2021",
};

const MOCK_HISTORY: InterviewConfig[] = [
  {
    id: "int-001",
    role: "Full Stack Developer",
    experienceLevel: "mid",
    interviewType: "technical",
    persona: "technical_lead",
    difficulty: "medium",
    pressureMode: false,
    duration: 30,
    resume: MOCK_USER,
    createdAt: "2026-08-08T14:30:00Z",
  },
  {
    id: "int-002",
    role: "Frontend Developer",
    experienceLevel: "mid",
    interviewType: "technical",
    persona: "hr_recruiter",
    difficulty: "medium",
    pressureMode: false,
    duration: 30,
    resume: MOCK_USER,
    createdAt: "2026-08-05T11:00:00Z",
  },
  {
    id: "int-003",
    role: "Product Manager",
    experienceLevel: "fresher",
    interviewType: "behavioral",
    persona: "friendly_founder",
    difficulty: "easy",
    pressureMode: false,
    duration: 20,
    resume: MOCK_USER,
    createdAt: "2026-08-02T09:15:00Z",
  },
  {
    id: "int-004",
    role: "Senior Backend Engineer",
    experienceLevel: "senior",
    interviewType: "system_design",
    persona: "stress_interviewer",
    difficulty: "hard",
    pressureMode: true,
    duration: 45,
    resume: MOCK_USER,
    createdAt: "2026-07-28T16:00:00Z",
  },
];

export class MockInterviewService implements InterviewService {
  private interviews: Map<string, InterviewConfig> = new Map();

  constructor() {
    MOCK_HISTORY.forEach((i) => this.interviews.set(i.id, i));
  }

  async createInterview(config: Partial<InterviewConfig>): Promise<InterviewConfig> {
    await sleep(400);
    const interview: InterviewConfig = {
      id: `int-${Date.now()}`,
      role: config.role || "Software Engineer",
      experienceLevel: config.experienceLevel || "mid",
      interviewType: config.interviewType || "technical",
      persona: config.persona || "technical_lead",
      difficulty: config.difficulty || "medium",
      pressureMode: config.pressureMode || false,
      duration: config.duration || 30,
      company: config.company,
      interviewerType: config.interviewerType,
      resume: config.resume || MOCK_USER,
      jobDescription: config.jobDescription,
      metadata: config.metadata,
      createdAt: new Date().toISOString(),
    };
    this.interviews.set(interview.id, interview);
    return interview;
  }

  async getInterview(id: string): Promise<InterviewConfig | null> {
    await sleep(200);
    return this.interviews.get(id) || null;
  }

  async startInterview(id: string): Promise<{ sessionId: string; questions: InterviewQuestion[]; question_text?: string }> {
    await sleep(600);
    const sessionId = `session-${id}-${Date.now()}`;
    const questions = [
      { id: "q1", question: "Tell me about yourself and your experience with React.", category: "Introduction", difficulty: "easy" },
      { id: "q2", question: "How does the virtual DOM work in React?", category: "Technical", difficulty: "medium" },
      { id: "q3", question: "Explain the difference between REST and GraphQL.", category: "Technical", difficulty: "medium" },
      { id: "q4", question: "How would you design a real-time chat application?", category: "System Design", difficulty: "hard" },
    ];
    return { sessionId, questions, question_text: questions[0].question };
  }

  async submitTranscript(): Promise<void> {
    await sleep(100);
  }

  async endInterview(): Promise<void> {
    await sleep(300);
  }

  async getReport(id: string): Promise<InterviewReport | null> {
    await sleep(800);
    return this.generateMockReport(id);
  }

  async getHistory(): Promise<InterviewConfig[]> {
    await sleep(300);
    return Array.from(this.interviews.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getPerformanceHistory(days = 30): Promise<PerformanceHistory[]> {
    await sleep(400);
    const history: PerformanceHistory[] = [];
    const now = new Date();
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      history.push({
        date: date.toISOString().split("T")[0],
        overallScore: 65 + Math.floor(Math.random() * 30),
        technical: 70 + Math.floor(Math.random() * 25),
        communication: 60 + Math.floor(Math.random() * 30),
        confidence: 65 + Math.floor(Math.random() * 25),
        clarity: 70 + Math.floor(Math.random() * 25),
        conciseness: 60 + Math.floor(Math.random() * 30),
        fillerWords: Math.floor(Math.random() * 12),
        speakingPace: 120 + Math.floor(Math.random() * 40),
      });
    }
    return history;
  }

  async analyzeJobDescription(text: string): Promise<JobDescription> {
    await sleep(1200);
    return {
      id: `jd-${Date.now()}`,
      title: "Full Stack Developer",
      company: "TechCorp Inc.",
      description: text,
      requiredSkills: ["React", "Node.js", "MongoDB", "TypeScript", "Express", "JWT"],
      preferredSkills: ["Docker", "AWS", "Redis", "GraphQL", "Kubernetes"],
      experienceLevel: "2-4 years",
      jobFitScore: 84,
      matchedSkills: ["React", "Node.js", "MongoDB", "TypeScript", "Express", "JWT"],
      missingSkills: ["Docker", "AWS", "Redis"],
    };
  }

  async getFingerprint(): Promise<CommunicationFingerprint> {
    await sleep(500);
    return {
      clarity: 82,
      conciseness: 72,
      speakingPace: 132,
      confidence: 78,
      fillerControl: 65,
      answerStructure: 85,
    };
  }

  async getCoachingPlan(interviewId: string): Promise<CoachingPlan> {
    await sleep(600);
    return {
      id: `plan-${Date.now()}`,
      interviewId,
      totalDays: 7,
      createdAt: new Date().toISOString(),
      days: [
        { day: 1, title: "Answer Structure", description: "Practice PREP method for structured answers", duration: "15 min", completed: true },
        { day: 2, title: "Filler Words", description: "Reduce fillers and speak clearly", duration: "15 min", completed: true },
        { day: 3, title: "Conciseness", description: "Answer in 60 seconds with precision", duration: "15 min", completed: false },
        { day: 4, title: "System Design", description: "Basics of scalable systems", duration: "20 min", completed: false },
        { day: 5, title: "Problem Solving", description: "DSA problem explanation practice", duration: "20 min", completed: false },
        { day: 6, title: "Mock Interview", description: "Full-length mock interview", duration: "30 min", completed: false },
        { day: 7, title: "Review & Improve", description: "Analyze progress and set goals", duration: "20 min", completed: false },
      ],
    };
  }

  async generateBlueprint(candidateId: string, jobId: string, sessionId?: string): Promise<InterviewBlueprint> {
    await sleep(800);
    return {
      sessionId: sessionId || `session-${candidateId}-${jobId}`,
      candidateName: "Rohit",
      targetRole: "Full Stack Developer",
      company: "TechCorp",
      overallFitScore: 0.84,
      estimatedDifficultyLevel: 2,
      interviewFocusAreas: ["React", "Node.js", "System Design", "Behavioral"],
      skillGaps: ["Docker", "AWS", "Redis"],
      skillStrengths: ["React", "Node.js", "MongoDB", "TypeScript"],
      expectedDurationSeconds: 1800,
      message: "Interview blueprint generated successfully. Focus on system design and behavioral questions.",
    };
  }

  async generateEvaluation(sessionId: string): Promise<EvaluationReport> {
    await sleep(1200);
    return {
      sessionId,
      overallScore: 82,
      technicalScore: 86,
      communicationScore: 74,
      confidenceScore: 79,
      clarityScore: 88,
      relevanceScore: 91,
      problemSolvingScore: 83,
      communicationFingerprint: {
        clarity: 82,
        conciseness: 72,
        structure: 85,
        pace: 132,
        fillerControl: 65,
      },
      topWeakness: "Filler words and long pauses",
      topStrength: "Strong technical fundamentals",
      recommendation: "Practice PREP method to structure answers and reduce filler words.",
    };
  }

  private generateMockReport(id: string): InterviewReport {
    return {
      id: `report-${Date.now()}`,
      interviewId: id,
      overallScore: 82,
      technicalScore: 86,
      communicationScore: 74,
      confidenceScore: 79,
      clarityScore: 88,
      problemSolvingScore: 83,
      answerRelevanceScore: 91,
      strengths: [
        "Strong technical fundamentals",
        "Good project explanation",
        "Relevant examples provided",
        "Good problem-solving approach",
      ],
      improvements: [
        "Reduce filler words (5 detected)",
        "Improve conciseness",
        "Avoid long pauses before answering",
        "Structure answers using PREP method",
      ],
      summary: "Your technical knowledge is strong, but your answers can be more concise. Focus on reducing filler words and structuring responses.",
      communicationFingerprint: {
        clarity: 82,
        conciseness: 72,
        speakingPace: 132,
        confidence: 78,
        fillerControl: 65,
        answerStructure: 85,
      },
      detailedMetrics: {
        clarity: 82,
        confidence: 78,
        relevance: 91,
        fillerWordsCount: 5,
        avgWpm: 132,
        longPauses: 6,
        avgResponseTime: 4.2,
        answerStructure: 85,
      },
      questions: [],
      transcripts: [],
      createdAt: new Date().toISOString(),
    };
  }
}

export const mockInterviewService = new MockInterviewService();
