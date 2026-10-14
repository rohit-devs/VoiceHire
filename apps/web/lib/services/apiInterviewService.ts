import type {
  InterviewService,
  InterviewBlueprint,
  TranscriptAck,
} from "./interviewService";
import type {
  CoachingPlan,
  InterviewConfig,
  InterviewQuestion,
  JobDescription,
  PerformanceHistory,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

class ApiInterviewService implements InterviewService {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (_authToken) {
      headers["Authorization"] = `Bearer ${_authToken}`;
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
      created_at?: string;
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
      createdAt: response.created_at ?? new Date().toISOString(),
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
      duration_seconds?: number;
      company?: string;
      experience_level?: string;
      created_at?: string;
    } | null>(`/api/interviews/sessions/${id}`);
    if (!response) return null;
    return {
      id: response.id,
      role: response.role,
      experienceLevel: response.experience_level ?? "",
      interviewType: response.interview_type ?? "mixed",
      persona: response.persona ?? "technical_lead",
      difficulty: response.difficulty,
      pressureMode: false,
      duration: (response.duration_seconds ?? 1800) / 60,
      company: response.company,
      agoraChannel: response.agora_channel,
      isDemo: response.is_demo,
      createdAt: response.created_at ?? new Date().toISOString(),
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

  async getReport(id: string): Promise<never> {
    return this.request<never>(`/api/evaluations/sessions/${id}/report`);
  }

  async getHistory(): Promise<InterviewConfig[]> {
    return this.request<InterviewConfig[]>(`/api/interviews/sessions`);
  }

  async getPerformanceHistory(days?: number): Promise<PerformanceHistory[]> {
    const result = await this.request<{ reports: PerformanceHistory[] }>(`/api/evaluations/user/reports?limit=${days || 30}`);
    return result.reports;
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

  async getFingerprint(interviewId: string): Promise<never> {
    return this.getReport(interviewId);
  }

  async getCoachingPlan(interviewId: string): Promise<CoachingPlan> {
    return this.request<CoachingPlan>(`/api/evaluations/sessions/${interviewId}/coaching-plan`);
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

  async generateEvaluation(sessionId: string): Promise<never> {
    return this.request<never>(`/api/evaluations/sessions/${sessionId}/report/generate`, {
      method: "POST",
    });
  }
}

export const apiInterviewService = new ApiInterviewService();
