import type { DashboardData } from "@/types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getDashboardData(): Promise<DashboardData> {
  await sleep(500);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return {
    greeting,
    subtitle: "Verified interview performance metrics are not available yet.",
    overallReadiness: null,
    technicalKnowledge: null,
    communication: null,
    clarity: null,
    answerRelevance: null,
    recentInterviews: [],
    performanceHistory: [],
    insights: [],
    recommendations: [],
  };
}
