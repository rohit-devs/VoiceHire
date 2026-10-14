import type { PerformanceHistory, InterviewConfig } from "@/types";

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getDashboardData(): Promise<DashboardData> {
  await sleep(500);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return {
    greeting: `${greeting}, Rohit 👋`,
    subtitle: "Ready to improve your interview performance?",
    overallReadiness: 82,
    technicalKnowledge: 86,
    communication: 74,
    confidence: 79,
    clarity: 88,
    answerRelevance: 91,
    recentInterviews: [
      {
        id: "int-001",
        role: "Full Stack Developer",
        experienceLevel: "mid",
        interviewType: "technical",
        persona: "technical_lead",
        difficulty: "medium",
        pressureMode: false,
        duration: 30,
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
        createdAt: "2026-07-28T16:00:00Z",
      },
    ],
    performanceHistory: generateHistory(),
    insights: [
      "Your technical knowledge is strong, but your answers can be more concise.",
      "You tend to use 5 filler words per interview on average.",
      "Your confidence score improved by 12% over the last 5 interviews.",
    ],
    recommendations: [
      "Practice PREP method to structure answers better.",
      "Work on reducing long pauses before responding.",
      "Try the pressure mode to improve composure.",
    ],
  };
}

function generateHistory(): PerformanceHistory[] {
  const history: PerformanceHistory[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
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
