"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { interviewService } from "@/lib/services";
import { useInterviewStore } from "@/stores/interviewStore";
import {
  ArrowRight,
  ArrowLeft,
  Briefcase,
  Upload,
  FileText,
  Settings2,
  Check,
} from "lucide-react";
import type { InterviewConfig } from "@/types";

type Step = "role" | "profile" | "jd" | "preferences" | "review";

const INTERVIEW_TYPES: { value: InterviewConfig["interviewType"]; label: string; desc: string }[] = [
  { value: "technical", label: "Technical", desc: "Coding, architecture, and system design" },
  { value: "hr", label: "HR", desc: "Culture fit, experience, and soft skills" },
  { value: "behavioral", label: "Behavioral", desc: "Past experiences and situational questions" },
  { value: "mixed", label: "Mixed", desc: "Combination of technical and behavioral" },
  { value: "system_design", label: "System Design", desc: "Large-scale distributed systems" },
];

const PERSONAS: { value: InterviewConfig["persona"]; label: string; desc: string }[] = [
  { value: "friendly_founder", label: "Friendly Startup Founder", desc: "Warm, encouraging, startup-focused" },
  { value: "technical_lead", label: "Deep Technical Lead", desc: "Rigorous, detail-oriented, technical" },
  { value: "hr_recruiter", label: "HR Recruiter", desc: "Professional, structured, people-focused" },
  { value: "stress_interviewer", label: "Stress Interviewer", desc: "Challenging, high-pressure, adaptive" },
];

const DIFFICULTIES: { value: InterviewConfig["difficulty"]; label: string; desc: string }[] = [
  { value: "easy", label: "Easy", desc: "Foundational concepts" },
  { value: "medium", label: "Medium", desc: "Practical application" },
  { value: "hard", label: "Hard", desc: "Advanced scenarios" },
];

const DURATIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
];

const EXPERIENCE_LEVELS = [
  "Fresher (0-1 year)",
  "Junior (1-3 years)",
  "Mid (3-5 years)",
  "Senior (5-8 years)",
  "Lead (8+ years)",
];

export default function NewInterviewPage() {
  const router = useRouter();
  const { setCurrentInterview, setSessionId, setInterviewPhase, setBlueprint } = useInterviewStore();
  const [step, setStep] = useState<Step>("role");
  const [loading, setLoading] = useState(false);

  const [config, setConfig] = useState({
    role: "",
    experienceLevel: "",
    interviewType: undefined as "technical" | "hr" | "behavioral" | "mixed" | "system_design" | undefined,
    persona: undefined as "friendly_founder" | "technical_lead" | "hr_recruiter" | "stress_interviewer" | undefined,
    difficulty: "medium" as "easy" | "medium" | "hard",
    pressureMode: false,
    duration: 30,
    company: "",
    resumeUploaded: false,
    resumeFilename: "",
    jdText: "",
  });

  const stepOrder: Step[] = ["role", "profile", "jd", "preferences", "review"];
  const currentStepIndex = stepOrder.indexOf(step);

  const updateConfig = (updates: Partial<typeof config>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const canProceed = () => {
    switch (step) {
      case "role":
        return config.role && config.experienceLevel && config.interviewType && config.company;
      case "profile":
        return config.resumeUploaded;
      case "jd":
        return true;
      case "preferences":
        return config.persona && config.difficulty;
      case "review":
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (!canProceed()) return;
    if (step === "review") {
      setLoading(true);
      try {
        const interview = await interviewService.createInterview({
          role: config.role,
          experienceLevel: config.experienceLevel,
          interviewType: config.interviewType,
          persona: config.persona,
          difficulty: config.difficulty,
          pressureMode: config.pressureMode,
          duration: config.duration,
          company: config.company,
          interviewerType: config.persona,
        });
        setCurrentInterview(interview);
        
        const blueprint = await interviewService.generateBlueprint(
          `candidate-${interview.id}`,
          `job-${interview.id}`,
          interview.id
        );
        setBlueprint(blueprint);
        
        const session = await interviewService.startInterview(interview.id);
        setSessionId(session.sessionId);
        setInterviewPhase("preparing");
        router.push(`/interview/prepare/${interview.id}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex < stepOrder.length - 1) {
      setStep(stepOrder[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1]);
    }
  };

  const steps = [
    { id: "role", label: "Role & Type", icon: Briefcase },
    { id: "profile", label: "Profile", icon: Upload },
    { id: "jd", label: "Job Description", icon: FileText },
    { id: "preferences", label: "Preferences", icon: Settings2 },
    { id: "review", label: "Review", icon: Check },
  ];

  return (
    <AppShell>
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="mx-auto max-w-3xl px-8 py-10">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-white">New Interview</h1>
            <p className="text-muted-foreground mt-2">Configure your AI interview session</p>
          </div>

          {/* Progress Steps */}
          <div className="mb-10">
            <div className="flex items-center justify-between">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                        i <= currentStepIndex
                          ? "border-violet-500/50 bg-violet-500/20 text-violet-300"
                          : "border-white/10 bg-white/5 text-muted-foreground"
                      }`}
                    >
                      <s.icon className="h-4 w-4" />
                    </div>
                    <span
                      className={`text-sm font-medium hidden sm:inline ${
                        i <= currentStepIndex ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`hidden sm:block h-px w-8 mx-2 ${i < currentStepIndex ? "bg-violet-500/50" : "bg-white/10"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8">
            {step === "role" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">Role & Interview Type</h2>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Job Role</label>
                  <input
                    type="text"
                    value={config.role}
                    onChange={(e) => updateConfig({ role: e.target.value })}
                    placeholder="e.g. Full Stack Developer"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Experience Level</label>
                  <select
                    value={config.experienceLevel}
                    onChange={(e) => updateConfig({ experienceLevel: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  >
                    <option value="" className="bg-[#1a1a2e]">Select experience level</option>
                    {EXPERIENCE_LEVELS.map((level) => (
                      <option key={level} value={level} className="bg-[#1a1a2e]">{level}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Company</label>
                  <input
                    type="text"
                    value={config.company}
                    onChange={(e) => updateConfig({ company: e.target.value })}
                    placeholder="e.g. Amazon, Google, Startup"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300">Interview Type</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {INTERVIEW_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => updateConfig({ interviewType: type.value })}
                        className={`rounded-lg border p-4 text-left transition-all ${
                          config.interviewType === type.value
                            ? "border-violet-500/50 bg-violet-500/10"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20"
                        }`}
                      >
                        <p className="text-sm font-medium text-white">{type.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{type.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === "profile" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">Candidate Profile</h2>
                <div
                  className={`rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                    config.resumeUploaded
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  {config.resumeUploaded ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="h-8 w-8 text-emerald-400" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-white">{config.resumeFilename || "Rohit_Resume_FullStack.pdf"}</p>
                        <p className="text-xs text-emerald-400 mt-0.5">Uploaded successfully</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-white">Upload your resume</p>
                        <p className="text-xs text-muted-foreground mt-1">PDF format, max 5MB</p>
                      </div>
                    </div>
                  )}
                </div>

                {config.resumeUploaded && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-300">Extracted Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {["React", "Node.js", "MongoDB", "JavaScript", "Express", "JWT"].map((skill) => (
                        <span key={skill} className="rounded-full bg-violet-500/10 border border-violet-500/20 px-3 py-1 text-xs font-medium text-violet-300">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!config.resumeUploaded && (
                  <button
                    onClick={() => updateConfig({ resumeUploaded: true, resumeFilename: "Rohit_Resume_FullStack.pdf" })}
                    className="w-full rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-300 hover:bg-violet-500/20 transition-colors"
                  >
                    Simulate Resume Upload
                  </button>
                )}
              </div>
            )}

            {step === "jd" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">Job Description</h2>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Paste Job Description (Optional)</label>
                  <textarea
                    value={config.jdText}
                    onChange={(e) => updateConfig({ jdText: e.target.value })}
                    placeholder="Paste the job description here to get a personalized interview..."
                    rows={6}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
                  />
                </div>

                {config.jdText && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">Job Fit Analysis</p>
                      <span className="text-2xl font-bold text-emerald-400">84%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400" style={{ width: "84%" }} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Matched</p>
                        <div className="flex flex-wrap gap-1.5">
                          {["React", "Node.js", "MongoDB"].map((s) => (
                            <span key={s} className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Missing</p>
                        <div className="flex flex-wrap gap-1.5">
                          {["Docker", "AWS", "Redis"].map((s) => (
                            <span key={s} className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === "preferences" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">Interview Preferences</h2>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300">AI Persona</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PERSONAS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => updateConfig({ persona: p.value })}
                        className={`rounded-lg border p-4 text-left transition-all ${
                          config.persona === p.value
                            ? "border-violet-500/50 bg-violet-500/10"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20"
                        }`}
                      >
                        <p className="text-sm font-medium text-white">{p.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300">Difficulty</label>
                  <div className="grid grid-cols-3 gap-3">
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d.value}
                        onClick={() => updateConfig({ difficulty: d.value })}
                        className={`rounded-lg border p-3 text-center transition-all ${
                          config.difficulty === d.value
                            ? "border-violet-500/50 bg-violet-500/10"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20"
                        }`}
                      >
                        <p className="text-sm font-medium text-white">{d.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div>
                    <p className="text-sm font-medium text-white">Pressure Mode</p>
                    <p className="text-xs text-muted-foreground mt-0.5">AI interrupts and challenges your answers</p>
                  </div>
                  <button
                    onClick={() => updateConfig({ pressureMode: !config.pressureMode })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.pressureMode ? "bg-violet-600" : "bg-white/10"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      config.pressureMode ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300">Duration</label>
                  <div className="grid grid-cols-3 gap-3">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.value}
                        onClick={() => updateConfig({ duration: d.value })}
                        className={`rounded-lg border p-3 text-center transition-all ${
                          config.duration === d.value
                            ? "border-violet-500/50 bg-violet-500/10"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20"
                        }`}
                      >
                        <p className="text-sm font-medium text-white">{d.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === "review" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">Review Configuration</h2>
                <div className="space-y-4">
                  <ReviewRow label="Company" value={config.company || ""} />
                  <ReviewRow label="Role" value={config.role} />
                  <ReviewRow label="Experience" value={config.experienceLevel} />
                  <ReviewRow label="Type" value={config.interviewType?.replace("_", " ") || ""} />
                  <ReviewRow label="Persona" value={PERSONAS.find(p => p.value === config.persona)?.label || ""} />
                  <ReviewRow label="Difficulty" value={config.difficulty} />
                  <ReviewRow label="Pressure Mode" value={config.pressureMode ? "Enabled" : "Disabled"} />
                  <ReviewRow label="Duration" value={`${config.duration} min`} />
                  <ReviewRow label="Resume" value={config.resumeFilename || "Uploaded"} />
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 flex items-center justify-between pt-6 border-t border-white/10">
              <button
                onClick={handleBack}
                disabled={currentStepIndex === 0}
                className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${
                  currentStepIndex === 0
                    ? "invisible"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={handleNext}
                disabled={!canProceed() || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : step === "review" ? "Start Interview" : "Continue"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-white capitalize">{value}</span>
    </div>
  );
}
