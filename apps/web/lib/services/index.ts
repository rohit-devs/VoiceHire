import { apiInterviewService, setAuthToken, setAuthTokenProvider } from "@/lib/services/apiInterviewService";

export { setAuthToken, setAuthTokenProvider };
export const interviewService = apiInterviewService;

export type { InterviewService } from "@/lib/services/interviewService";
