"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiInterviewService as interviewService } from "@/lib/services/apiInterviewService";
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
  const { setCurrentInterview, setSessionId, setInterviewPhase } = useInterviewStore();
  const [step, setStep] = useState<Step>("role");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [config, setConfig] = useState({
    role: "",
    experienceLevel: "",
    interviewType: undefined as "technical" | "hr" | "behavioral" | "mixed" | "system_design" | undefined,
    persona: undefined as "friendly_founder" | "technical_lead" | "hr_recruiter" | "stress_interviewer" | undefined,
    difficulty: "medium" as "easy" | "medium" | "hard",
    pressureMode: false,
    duration: 30,
    company: "",
    resumeText: "",
    jdText: "",
    jobCategory: "",
    isDemo: false,
  });

  useEffect(() => {
    let active = true;
    void interviewService.getProfile().then((profile) => {
      if (!active) return;
      setConfig((current) => ({
        ...current,
        persona: profile.default_interview_persona,
        difficulty: profile.default_interview_difficulty,
      }));
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load saved interview preferences.");
    });
    return () => { active = false; };
  }, []);

  const stepOrder: Step[] = ["role", "profile", "jd", "preferences", "review"];
  const currentStepIndex = stepOrder.indexOf(step);

  const updateConfig = (updates: Partial<typeof config>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const canProceed = () => {
    switch (step) {
      case "role":
        return Boolean(config.role.trim() && config.experienceLevel && config.interviewType);
      case "profile":
        return Boolean(config.resumeText.trim());
      case "jd":
        return Boolean(config.jdText.trim() || config.jobCategory.trim());
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
          resumeText: config.resumeText,
          jobDescriptionText: config.jdText,
          jobCategory: config.jobCategory,
          isDemo: config.isDemo,
        });
        setCurrentInterview(interview);
        const session = await interviewService.startInterview(interview.id);
        setSessionId(session.sessionId);
        setInterviewPhase("preparing");
        router.push(`/interview/prepare/${interview.id}`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to create the interview.");
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

  const inputClass =
    "w-full border border-neutral-800 bg-[#0a0a0a] px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#e8321e] focus:outline-none transition-colors";

  return (
    <AppShell>
      {/* Editorial theme (self-contained, no external CSS file needed) */}
      <style>{`
        .vh-display {
          font-family: Impact, "Haettenschweiler", "Arial Narrow Bold", "Arial Narrow", sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.01em;
          line-height: 0.9;
          font-weight: 400;
        }
        .vh-label {
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }
      `}</style>

      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
          {/* Header */}
          <div className="mb-10">
            <p className="vh-label text-[10px] font-bold text-[#e8321e]">
              Step {String(currentStepIndex + 1).padStart(2, "0")} / 05
            </p>
            <h1 className="vh-display mt-3 text-5xl text-white sm:text-7xl">
              New interview<span className="text-[#e8321e]">.</span>
            </h1>
            <p className="mt-3 text-sm text-neutral-500">
              Configure your AI interview session
            </p>
          </div>

          {/* Progress Steps — numbered editorial sequence */}
          <div className="mb-8">
            <div className="flex items-center">
              {steps.map((s, i) => (
                <div key={s.id} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`vh-display flex h-11 w-11 items-center justify-center border text-lg transition-colors duration-200 ${
                        i < currentStepIndex
                          ? "border-[#e8321e] bg-[#e8321e] text-white"
                          : i === currentStepIndex
                            ? "border-[#e8321e] bg-[#e8321e]/10 text-[#e8321e]"
                            : "border-neutral-800 bg-[#0d0d0d] text-neutral-600"
                      }`}
                    >
                      {i < currentStepIndex ? <Check className="h-4 w-4" /> : String(i + 1).padStart(2, "0")}
                    </div>
                    <span
                      className={`vh-label hidden text-[9px] font-bold sm:block ${
                        i <= currentStepIndex ? "text-neutral-300" : "text-neutral-600"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`mx-2 mb-0 h-px flex-1 sm:mb-5 ${
                        i < currentStepIndex ? "bg-[#e8321e]" : "bg-neutral-800"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="relative border border-neutral-800 bg-[#0d0d0d] p-6 sm:p-10">
            <span aria-hidden="true" className="absolute left-0 top-0 h-2 w-2 bg-[#e8321e]" />

            {step === "role" && (
              <div className="space-y-7">
                <div>
                  <p className="vh-label text-[10px] font-bold text-[#e8321e]">01 — Target</p>
                  <h2 className="vh-display mt-2 text-3xl text-white sm:text-4xl">Role & type</h2>
                </div>
                <div className="space-y-2">
                  <label htmlFor="interview-role" className="vh-label text-[10px] font-bold text-neutral-400">
                    Job role
                  </label>
                  <input
                    id="interview-role"
                    type="text"
                    required
                    value={config.role}
                    onChange={(e) => updateConfig({ role: e.target.value })}
                    placeholder="e.g. Full Stack Developer"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="experience-level" className="vh-label text-[10px] font-bold text-neutral-400">
                    Experience level
                  </label>
                  <select
                    id="experience-level"
                    value={config.experienceLevel}
                    onChange={(e) => updateConfig({ experienceLevel: e.target.value })}
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="" className="bg-[#0a0a0a]">Select experience level</option>
                    {EXPERIENCE_LEVELS.map((level) => (
                      <option key={level} value={level} className="bg-[#0a0a0a]">{level}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="interview-company" className="vh-label text-[10px] font-bold text-neutral-400">
                    Company
                  </label>
                  <input
                    id="interview-company"
                    type="text"
                    value={config.company}
                    onChange={(e) => updateConfig({ company: e.target.value })}
                    placeholder="e.g. Amazon, Google, Startup"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-3">
                  <label className="vh-label text-[10px] font-bold text-neutral-400">Interview type</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {INTERVIEW_TYPES.map((type) => (
                      <button
                        type="button"
                        aria-pressed={config.interviewType === type.value}
                        key={type.value}
                        onClick={() => updateConfig({ interviewType: type.value })}
                        className={`relative border p-4 text-left transition-colors duration-200 ${
                          config.interviewType === type.value
                            ? "border-[#e8321e] bg-[#e8321e]/10"
                            : "border-neutral-800 bg-[#0a0a0a] hover:border-neutral-600"
                        }`}
                      >
                        {config.interviewType === type.value && (
                          <span aria-hidden="true" className="absolute right-0 top-0 h-2 w-2 bg-[#e8321e]" />
                        )}
                        <p className="vh-display text-lg text-white">{type.label}</p>
                        <p className="mt-1 text-xs text-neutral-500">{type.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === "profile" && (
              <div className="space-y-7">
                <div>
                  <p className="vh-label text-[10px] font-bold text-[#e8321e]">02 — Background</p>
                  <h2 className="vh-display mt-2 text-3xl text-white sm:text-4xl">Candidate profile</h2>
                </div>
                <label htmlFor="resume-text" className="block space-y-2">
                  <span className="vh-label text-[10px] font-bold text-neutral-400">Resume text</span>
                  <textarea
                    id="resume-text"
                    value={config.resumeText}
                    onChange={(event) => updateConfig({ resumeText: event.target.value })}
                    placeholder="Paste your resume text here. It will be used to tailor interview questions."
                    rows={9}
                    maxLength={20000}
                    className={`${inputClass} resize-y`}
                  />
                  <span className="block text-xs text-neutral-600">
                    {config.resumeText.length}/20,000 characters
                  </span>
                </label>
                <label className="block space-y-2">
                  <span className="vh-label text-[10px] font-bold text-neutral-400">
                    Or upload a plain-text resume
                  </span>
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    aria-label="Upload a plain text resume"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (file.size > 20000) {
                        setError("Resume text files must be 20,000 bytes or smaller.");
                        event.target.value = "";
                        return;
                      }
                      try {
                        updateConfig({ resumeText: await file.text() });
                        setError("");
                      } catch {
                        setError("Unable to read this resume file. Paste the text instead.");
                      }
                    }}
                    className={`${inputClass} file:mr-4 file:border-0 file:bg-[#e8321e] file:px-4 file:py-1.5 file:text-xs file:font-bold file:uppercase file:tracking-widest file:text-white hover:file:bg-[#ff3b2d]`}
                  />
                </label>
              </div>
            )}

            {step === "jd" && (
              <div className="space-y-7">
                <div>
                  <p className="vh-label text-[10px] font-bold text-[#e8321e]">03 — Context</p>
                  <h2 className="vh-display mt-2 text-3xl text-white sm:text-4xl">Job description</h2>
                </div>
                <div className="space-y-2">
                  <label htmlFor="job-description" className="vh-label text-[10px] font-bold text-neutral-400">
                    Paste job description
                  </label>
                  <textarea
                    id="job-description"
                    value={config.jdText}
                    onChange={(e) => updateConfig({ jdText: e.target.value })}
                    placeholder="Paste the job description, or provide a job category below."
                    rows={6}
                    maxLength={20000}
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <label className="block space-y-2">
                  <span className="vh-label text-[10px] font-bold text-neutral-400">
                    Job category (used if no description is pasted)
                  </span>
                  <input
                    value={config.jobCategory}
                    onChange={(event) => updateConfig({ jobCategory: event.target.value })}
                    placeholder="e.g. backend engineering"
                    maxLength={100}
                    className={inputClass}
                  />
                </label>
              </div>
            )}

            {step === "preferences" && (
              <div className="space-y-7">
                <div>
                  <p className="vh-label text-[10px] font-bold text-[#e8321e]">04 — Style</p>
                  <h2 className="vh-display mt-2 text-3xl text-white sm:text-4xl">Preferences</h2>
                </div>

                <div className="space-y-3">
                  <label className="vh-label text-[10px] font-bold text-neutral-400">AI persona</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {PERSONAS.map((p) => (
                      <button
                        type="button"
                        aria-pressed={config.persona === p.value}
                        key={p.value}
                        onClick={() => updateConfig({ persona: p.value })}
                        className={`relative border p-4 text-left transition-colors duration-200 ${
                          config.persona === p.value
                            ? "border-[#e8321e] bg-[#e8321e]/10"
                            : "border-neutral-800 bg-[#0a0a0a] hover:border-neutral-600"
                        }`}
                      >
                        {config.persona === p.value && (
                          <span aria-hidden="true" className="absolute right-0 top-0 h-2 w-2 bg-[#e8321e]" />
                        )}
                        <p className="vh-display text-lg text-white">{p.label}</p>
                        <p className="mt-1 text-xs text-neutral-500">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-3 border border-[#e8321e]/30 bg-[#e8321e]/[0.06] p-4">
                  <input
                    aria-label="Simulated demo"
                    type="checkbox"
                    checked={config.isDemo}
                    onChange={(event) => updateConfig({ isDemo: event.target.checked })}
                    className="mt-1 accent-[#e8321e]"
                  />
                  <span>
                    <span className="vh-label block text-[10px] font-bold text-[#e8321e]">Simulated demo</span>
                    <span className="mt-2 block text-xs leading-relaxed text-neutral-400">
                      Uses a deterministic simulated interviewer. This session and its transcript
                      are marked as simulated and are excluded from evaluations.
                    </span>
                  </span>
                </label>

                <div className="space-y-3">
                  <label className="vh-label text-[10px] font-bold text-neutral-400">Difficulty</label>
                  <div className="grid grid-cols-3 gap-3">
                    {DIFFICULTIES.map((d) => (
                      <button
                        type="button"
                        aria-pressed={config.difficulty === d.value}
                        key={d.value}
                        onClick={() => updateConfig({ difficulty: d.value })}
                        className={`border p-3 text-center transition-colors duration-200 ${
                          config.difficulty === d.value
                            ? "border-[#e8321e] bg-[#e8321e]/10"
                            : "border-neutral-800 bg-[#0a0a0a] hover:border-neutral-600"
                        }`}
                      >
                        <p className="vh-display text-lg text-white">{d.label}</p>
                        <p className="mt-1 hidden text-[10px] text-neutral-500 sm:block">{d.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="vh-label text-[10px] font-bold text-neutral-400">Duration</label>
                  <div className="grid grid-cols-3 gap-3">
                    {DURATIONS.map((d) => (
                      <button
                        type="button"
                        aria-pressed={config.duration === d.value}
                        key={d.value}
                        onClick={() => updateConfig({ duration: d.value })}
                        className={`border p-3 text-center transition-colors duration-200 ${
                          config.duration === d.value
                            ? "border-[#e8321e] bg-[#e8321e]/10"
                            : "border-neutral-800 bg-[#0a0a0a] hover:border-neutral-600"
                        }`}
                      >
                        <p className="vh-display text-lg text-white">{d.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === "review" && (
              <div className="space-y-7">
                <div>
                  <p className="vh-label text-[10px] font-bold text-[#e8321e]">05 — Confirm</p>
                  <h2 className="vh-display mt-2 text-3xl text-white sm:text-4xl">Review configuration</h2>
                </div>
                <div className="border border-neutral-800">
                  <ReviewRow label="Company" value={config.company || ""} />
                  <ReviewRow label="Role" value={config.role} />
                  <ReviewRow label="Experience" value={config.experienceLevel} />
                  <ReviewRow label="Type" value={config.interviewType?.replace("_", " ") || ""} />
                  <ReviewRow label="Persona" value={PERSONAS.find(p => p.value === config.persona)?.label || ""} />
                  <ReviewRow label="Difficulty" value={config.difficulty} />
                  <ReviewRow label="Duration" value={`${config.duration} min`} />
                  <ReviewRow label="Resume" value={`${config.resumeText.length} characters provided`} />
                  <ReviewRow label="Job context" value={config.jdText.trim() ? "Job description provided" : config.jobCategory} />
                  <ReviewRow
                    label="Session type"
                    value={config.isDemo ? "Simulated demo" : "Real interview"}
                    highlight={config.isDemo}
                  />
                </div>
              </div>
            )}

            {/* Error + Navigation */}
            {error && (
              <p role="alert" className="mt-6 border border-[#e8321e]/40 bg-[#e8321e]/10 px-4 py-3 text-sm text-[#ff6a5b]">
                {error}
              </p>
            )}
            <div className="mt-10 flex items-center justify-between border-t border-neutral-800 pt-6">
              <button
                onClick={handleBack}
                disabled={currentStepIndex === 0}
                className={`group inline-flex items-center gap-2 border border-neutral-800 px-5 py-3 text-xs font-bold uppercase tracking-widest text-neutral-400 transition-colors hover:border-[#e8321e] hover:text-white ${
                  currentStepIndex === 0 ? "invisible" : ""
                }`}
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                Back
              </button>
              <button
                onClick={handleNext}
                disabled={!canProceed() || loading}
                className="group inline-flex items-center gap-3 bg-[#e8321e] px-7 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#ff3b2d] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Creating..." : step === "review" ? "Start interview" : "Continue"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ReviewRow({ label, value, highlight }: { label: string; value?: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-800 px-5 py-3.5 last:border-0">
      <span className="vh-label text-[10px] font-bold text-neutral-500">{label}</span>
      {highlight ? (
        <span className="bg-[#e8321e] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
          {value}
        </span>
      ) : (
        <span className="text-sm font-medium capitalize text-white">{value}</span>
      )}
    </div>
  );
}