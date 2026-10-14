import type { InterviewService, InterviewBlueprint, EvaluationReport } from "./interviewService";
import type {
  CoachingPlan,
  CommunicationFingerprint,
  EvaluationReport as ApiEvaluationReport,
  InterviewConfig,
  InterviewQuestion,
  InterviewReport,
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

  async createInterview(config: Partial<InterviewConfig>): Promise<InterviewConfig> {
    return this.request<InterviewConfig>("/api/interviews/sessions", {
      method: "POST",
      body: JSON.stringify({
        role: config.role,
        difficulty: config.difficulty,
        persona: config.persona,
        company: config.company,
        interviewer_type: config.interviewerType,
        job_description: config.jobDescription?.description,
        resume_text: config.resume?.experience,
      }),
    });
  }

  async getInterview(id: string): Promise<InterviewConfig | null> {
    return this.request<InterviewConfig | null>(`/api/interviews/sessions/${id}`);
  }

  async startInterview(id: string): Promise<{ sessionId: string; questions: InterviewQuestion[]; question_text?: string }> {
    const response = await this.request<{ question_text?: string }>(`/api/interviews/sessions/${id}/start`, {
      method: "POST",
    });
    return { sessionId: id, questions: [], question_text: response.question_text };
  }

  async submitTranscript(id: string, message: string): Promise<void> {
    await this.request(`/api/interviews/sessions/${id}/transcript`, {
      method: "POST",
      body: JSON.stringify({ speaker: "candidate", message }),
    });
  }

  async endInterview(id: string): Promise<void> {
    await this.request(`/api/interviews/sessions/${id}/end`, {
      method: "POST",
    });
  }

  async getReport(id: string): Promise<InterviewReport | null> {
    return this.request<InterviewReport | null>(`/api/evaluations/sessions/${id}/report`);
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

  async getFingerprint(interviewId: string): Promise<CommunicationFingerprint> {
    const report = await this.getReport(interviewId);
    if (!report) {
      throw new Error(`No report found for interview ${interviewId}`);
    }
    return report.communicationFingerprint;
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

  async generateEvaluation(sessionId: string): Promise<EvaluationReport> {
    return this.request<ApiEvaluationReport>(`/api/evaluations/sessions/${sessionId}/report/generate`, {
      method: "POST",
    }).then((report) => ({
      sessionId: report.sessionId,
      overallScore: report.overallScore,
      technicalScore: report.technicalScore,
      communicationScore: report.communicationScore,
      confidenceScore: report.confidenceScore,
      clarityScore: report.clarityScore,
      relevanceScore: report.relevanceScore,
      problemSolvingScore: report.problemSolvingScore,
      communicationFingerprint: report.communicationFingerprint,
      topWeakness: report.topWeakness,
      topStrength: report.topStrength,
      recommendation: report.recommendation,
    }));
  }
}

export const apiInterviewService = new ApiInterviewService();
