import { create } from "zustand";
import type { InterviewConfig, InterviewBlueprint } from "@/types";

interface InterviewStore {
  currentInterview: InterviewConfig | null;
  interviewSessionId: string | null;
  isInterviewActive: boolean;
  interviewPhase: "idle" | "configuring" | "preparing" | "live" | "processing" | "completed";
  blueprint: InterviewBlueprint | null;
  setCurrentInterview: (interview: InterviewConfig | null) => void;
  setSessionId: (id: string | null) => void;
  setInterviewActive: (active: boolean) => void;
  setInterviewPhase: (phase: InterviewStore["interviewPhase"]) => void;
  setBlueprint: (blueprint: InterviewBlueprint | null) => void;
  resetInterview: () => void;
}

export const useInterviewStore = create<InterviewStore>((set) => ({
  currentInterview: null,
  interviewSessionId: null,
  isInterviewActive: false,
  interviewPhase: "idle",
  blueprint: null,
  setCurrentInterview: (interview) => set({ currentInterview: interview }),
  setSessionId: (id) => set({ interviewSessionId: id }),
  setInterviewActive: (active) => set({ isInterviewActive: active }),
  setInterviewPhase: (phase) => set({ interviewPhase: phase }),
  setBlueprint: (blueprint) => set({ blueprint }),
  resetInterview: () => set({
    currentInterview: null,
    interviewSessionId: null,
    isInterviewActive: false,
    interviewPhase: "idle",
    blueprint: null,
  }),
}));
