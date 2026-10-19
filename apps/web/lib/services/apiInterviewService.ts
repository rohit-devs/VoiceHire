import type {
  InterviewService,
  InterviewBlueprint,
  EvaluationReport,
  PersistedTranscriptEntry,
  TranscriptAck,
  UserProfile,
} from "./interviewService";
import type {
  CoachingPlan,
  DashboardData,
  InterviewConfig,
  InterviewQuestion,
  JobDescription,
  PerformanceHistory,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

let _authToken: string | null = null;
let _authTokenProvider: (() => Promise<string | null>) | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

export function setAuthTokenProvider(provider: (() => Promise<string | null>) | null) {
  _authTokenProvider = provider;
}

export async function getAuthToken(): Promise<string | null> {
  return _authTokenProvider ? _authTokenProvider() : _authToken;
}

class ApiInterviewService implements InterviewService {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = await getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string>),
      },
    });

    if (!res.ok) {
      const error: { detail?: unknown } | null = await res.json().catch(() => null);
      const detail = typeof error?.detail === "string" ? error.detail : res.statusText;
      throw new Error(detail || `API error: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  async createInterview(config: Partial<InterviewConfig> & {
    resumeText?: string;
    jobDescriptionText?: string;
    jobCategory?: string;
    isDemo?: boolean;
  }): Promise<InterviewConfig> {
    const response = await this.request<{
      id: string;
      role: string;
      difficulty: InterviewConfig["difficulty"];
      status: string;
      current_state: string;
      agora_channel: string;
      is_demo: boolean;
      persona: InterviewConfig["persona"];
      interview_type: InterviewConfig["interviewType"];
      duration_seconds: number;
      company?: string;
      experience_level?: string;
      created_at: string;
    }>("/api/interviews/sessions", {
      method: "POST",
      body: JSON.stringify({
        role: config.role,
        difficulty: config.difficulty,
        experience_level: config.experienceLevel,
        persona: config.persona,
        company: config.company,
        interviewer_type: config.interviewerType,
        interview_type: config.interviewType,
        duration_seconds: (config.duration ?? 30) * 60,
        job_description: config.jobDescriptionText ?? config.jobDescription?.description,
        job_category: config.jobCategory,
        resume_text: config.resumeText ?? config.resume?.experience,
        is_demo: config.isDemo ?? false,
      }),
    });
    return {
      id: response.id,
      role: response.role,
      experienceLevel: response.experience_level ?? "",
      interviewType: response.interview_type,
      persona: response.persona,
      difficulty: response.difficulty,
      pressureMode: config.pressureMode ?? false,
      duration: response.duration_seconds / 60,
      company: response.company,
      interviewerType: config.interviewerType,
      agoraChannel: response.agora_channel,
      isDemo: response.is_demo,
      createdAt: response.created_at,
      status: response.status,
      currentState: response.current_state,
    };
  }

  async getInterview(id: string): Promise<InterviewConfig | null> {
    const response = await this.request<{
      id: string;
      role: string;
      difficulty: InterviewConfig["difficulty"];
      agora_channel: string;
      is_demo: boolean;
      persona?: InterviewConfig["persona"];
      interview_type?: InterviewConfig["interviewType"];
      duration_seconds: number;
      company?: string;
      experience_level?: string;
      created_at: string;
      status: string;
      current_state: string;
    } | null>(`/api/interviews/sessions/${id}`);
    if (!response) return null;
    return {
      id: response.id,
      role: response.role,
      experienceLevel: response.experience_level ?? "",
      interviewType: response.interview_type!,
      persona: response.persona!,
      difficulty: response.difficulty,
      pressureMode: false,
      duration: response.duration_seconds / 60,
      company: response.company,
      agoraChannel: response.agora_channel,
      isDemo: response.is_demo,
      createdAt: response.created_at,
      status: response.status,
      currentState: response.current_state,
    };
  }

  async startInterview(id: string): Promise<{
    sessionId: string;
    questions: InterviewQuestion[];
    question_text?: string;
    message_id?: string;
    sequence_number?: number;
    timestamp_ms?: number;
  }> {
    const response = await this.request<{
      question_text?: string;
      message_id?: string;
      sequence_number?: number;
      timestamp_ms?: number;
    }>(`/api/interviews/sessions/${id}/start`, {
      method: "POST",
    });
    return { sessionId: id, questions: [], ...response };
  }

  async submitTranscript(
    id: string,
    message: string,
    metadata: {
      messageId?: string;
      durationMs?: number | null;
      language?: "en" | "es" | "fr";
    } = {},
  ): Promise<TranscriptAck> {
    return this.request<TranscriptAck>(`/api/interviews/sessions/${id}/transcript`, {
      method: "POST",
      body: JSON.stringify({
        speaker: "candidate",
        message,
        message_id: metadata.messageId,
        duration_ms: metadata.durationMs ?? null,
        language: metadata.language ?? "en",
      }),
    });
  }

  async generateNextQuestion(id: string, candidateTranscript: string) {
    return this.request<{
      question_text: string;
      state: string;
      is_demo: boolean;
      source: "real" | "simulated";
      degraded: boolean;
      message_id: string;
      sequence_number: number;
      timestamp_ms: number;
    }>(`/api/interviews/sessions/${id}/generate-question`, {
      method: "POST",
      body: JSON.stringify({ candidate_transcript: candidateTranscript }),
    });
  }

  async endInterview(id: string): Promise<void> {
    await this.request(`/api/interviews/sessions/${id}/end`, {
      method: "POST",
    });
  }

  async getReport(id: string): Promise<EvaluationReport> {
    return this.request<EvaluationReport>(`/api/evaluations/sessions/${id}/report`);
  }

  async getTranscript(id: string): Promise<PersistedTranscriptEntry[]> {
    return this.request<PersistedTranscriptEntry[]>(
      `/api/interviews/sessions/${id}/transcript?limit=500`,
    );
  }

  async getHistory(): Promise<InterviewConfig[]> {
    const sessions = await this.request<Array<{
      id: string;
      role: string;
      difficulty: InterviewConfig["difficulty"];
      is_demo: boolean;
      persona?: InterviewConfig["persona"];
      interview_type?: InterviewConfig["interviewType"];
      duration_seconds: number;
      company?: string;
      experience_level?: string;
      created_at: string;
      status: string;
      current_state: string;
      agora_channel: string;
    }>>("/api/interviews/sessions?limit=100");
    return sessions.map((session) => ({
      id: session.id,
      role: session.role,
      difficulty: session.difficulty,
      experienceLevel: session.experience_level ?? "",
      interviewType: session.interview_type!,
      persona: session.persona!,
      pressureMode: false,
      duration: session.duration_seconds / 60,
      company: session.company,
      agoraChannel: session.agora_channel,
      isDemo: session.is_demo,
      createdAt: session.created_at,
      status: session.status,
      currentState: session.current_state,
    }));
  }

  async getPerformanceHistory(days?: number): Promise<PerformanceHistory[]> {
    const reports = await this.getUserReports();
    const sessions = await this.getHistory();
    const sessionsById = new Map(sessions.map((session) => [session.id, session]));
    const cutoff = days
      ? Date.now() - days * 24 * 60 * 60 * 1000
      : Number.NEGATIVE_INFINITY;
    return reports
      .filter((report) => {
        const session = sessionsById.get(report.session_id);
        return report.status === "completed" &&
          Boolean(report.ai_assessments) &&
          session?.currentState === "completed" &&
          !session.isDemo &&
          Date.parse(report.created_at ?? "") >= cutoff;
      })
      .map((report) => {
        const session = sessionsById.get(report.session_id);
        return {
          date: report.created_at ?? "",
          sessionId: report.session_id,
          role: session?.role ?? "",
          overallScore: report.ai_assessments!.overall_score,
          categoryScores: Object.fromEntries(
            Object.entries(report.ai_assessments!.category_scores).map(([key, value]) => [
              key,
              value.score,
            ]),
          ),
        };
      })
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  async getUserReports(): Promise<EvaluationReport[]> {
    const response = await this.request<{ reports: EvaluationReport[] }>(
      "/api/evaluations/user/reports?limit=100",
    );
    return response.reports;
  }

  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>("/api/users/me");
  }

  async updateProfile(
    update: Partial<Omit<UserProfile, "id" | "email">>,
  ): Promise<UserProfile> {
    return this.request<UserProfile>("/api/users/me", {
      method: "PUT",
      body: JSON.stringify(update),
    });
  }

  async getDashboardData(): Promise<DashboardData> {
    const [sessions, reports] = await Promise.all([
      this.getHistory(),
      this.getUserReports(),
    ]);
    const completed = reports
      .map((report) => ({
        report,
        session: sessions.find((session) => session.id === report.session_id),
      }))
      .filter(
        (entry) =>
          entry.report.status === "completed" &&
          entry.report.ai_assessments !== null &&
          entry.session?.currentState === "completed" &&
          !entry.session.isDemo,
      )
      .sort((left, right) =>
        (left.report.created_at ?? "").localeCompare(right.report.created_at ?? ""),
      );
    const averageCategory = (category: string): number | null => {
      const values = completed.flatMap(({ report }) => {
        const value = report.ai_assessments?.category_scores[category]?.score;
        return typeof value === "number" ? [value] : [];
      });
      return values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null;
    };
    const latest = completed.at(-1)?.report.ai_assessments;
    const hour = new Date().getHours();
    return {
      greeting: hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
      subtitle: completed.length
        ? `${completed.length} completed real interview${completed.length === 1 ? "" : "s"} with a saved evaluation.`
        : "Complete a real interview to build your verified evaluation history.",
      overallReadiness: completed.length
        ? completed.reduce((sum, { report }) => sum + report.ai_assessments!.overall_score, 0) /
          completed.length
        : null,
      technicalKnowledge: averageCategory("technical_correctness"),
      communication: averageCategory("communication"),
      clarity: averageCategory("structure_and_clarity"),
      answerRelevance: averageCategory("relevance"),
      recentInterviews: sessions.slice(0, 5),
      performanceHistory: completed.map(({ report, session }) => ({
        date: report.created_at ?? "",
        sessionId: report.session_id,
        role: session?.role ?? "",
        overallScore: report.ai_assessments!.overall_score,
        categoryScores: Object.fromEntries(
          Object.entries(report.ai_assessments!.category_scores).map(([key, value]) => [
            key,
            value.score,
          ]),
        ),
      })),
      strengths: latest?.strengths ?? [],
      insights: latest?.missing_elements ?? [],
      recommendations: latest?.practice_exercises.map((exercise) => exercise.task) ?? [],
    };
  }

  async analyzeJobDescription(text: string): Promise<JobDescription> {
    const jobId = `jd-${Date.now()}`;
    return this.request<JobDescription>(`/api/candidates/jobs/${jobId}/description`, {
      method: "POST",
      body: JSON.stringify({
        job_id: jobId,
        jd_text: text,
        job_title: "Unknown",
        company: "Unknown",
      }),
    });
  }

  async getFingerprint(interviewId: string): Promise<EvaluationReport> {
    return this.getReport(interviewId);
  }

  async getCoachingPlan(interviewId: string): Promise<CoachingPlan> {
    const response = await this.request<{
      id: string;
      interview_id: string;
      days: CoachingPlan["days"];
      total_days: number;
      created_at: string;
    }>(`/api/evaluations/sessions/${interviewId}/coaching-plan`);
    return {
      id: response.id,
      interviewId: response.interview_id,
      days: response.days,
      totalDays: response.total_days,
      createdAt: response.created_at,
    };
  }

  async updateCoachingProgress(
    interviewId: string,
    day: number,
    checked: boolean,
    notes?: string,
  ): Promise<{ completed_days: number }> {
    return this.request<{ completed_days: number }>(
      `/api/evaluations/sessions/${interviewId}/coaching-plan/update?day=${day}`,
      {
        method: "POST",
        body: JSON.stringify({ checked, notes }),
      },
    );
  }

  async generateBlueprint(candidateId: string, jobId: string, sessionId?: string): Promise<InterviewBlueprint> {
    return this.request<InterviewBlueprint>(`/api/candidates/blueprint/generate`, {
      method: "POST",
      body: JSON.stringify({
        candidate_id: candidateId,
        job_id: jobId,
        session_id: sessionId,
      }),
    });
  }

  async generateEvaluation(sessionId: string): Promise<EvaluationReport> {
    return this.request<EvaluationReport>(`/api/evaluations/sessions/${sessionId}/report/generate`, {
      method: "POST",
    });
  }
}

export const apiInterviewService = new ApiInterviewService();
