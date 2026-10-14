import { mockInterviewService } from "@/lib/mock/mockInterviewService";
import { apiInterviewService, setAuthToken } from "@/lib/services/apiInterviewService";

const USE_REAL_API = process.env.NEXT_PUBLIC_USE_REAL_API === "true";

export { setAuthToken };
export const interviewService = USE_REAL_API ? apiInterviewService : mockInterviewService;

export type { InterviewService } from "@/lib/services/interviewService";
