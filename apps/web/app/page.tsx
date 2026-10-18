import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Card } from "@/components/ui/primitives";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  MessageSquare,
  Mic,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "VoiceHire - AI Interviewer & Communication Coach",
  description:
    "Practice role-specific interviews, review evidence-backed AI guidance, and track verified metrics.",
};

const features = [
  {
    icon: Mic,
    title: "Practice by voice or text",
    description:
      "Use supported voice features when available, or complete the same interview with typed answers.",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: MessageSquare,
    title: "Questions with context",
    description:
      "Interview questions use the resume and role information you provide. Follow-ups can reference your answers.",
    color: "from-blue-500 to-cyan-600",
  },
  {
    icon: BarChart3,
    title: "Evidence-backed review",
    description:
      "Completed real sessions can include AI rubric judgments with answer quotes. They are guidance, not proof of competence.",
    color: "from-emerald-500 to-green-600",
  },
  {
    icon: Activity,
    title: "Measured transcript metrics",
    description:
      "See speaking metrics only when finalized transcript segments contain enough timestamped data to calculate them.",
    color: "from-pink-500 to-rose-600",
  },
  {
    icon: Sparkles,
    title: "Practice suggestions",
    description:
      "Review saved exercises based on the areas identified in a completed evaluation.",
    color: "from-indigo-500 to-violet-600",
  },
  {
    icon: Check,
    title: "Clear demo labeling",
    description:
      "Simulated sessions are explicitly labeled and kept separate from real evaluations.",
    color: "from-amber-500 to-orange-600",
  },
];

const steps = [
  {
    number: "01",
    title: "Add your context",
    description:
      "Provide resume text and a job description or role category to tailor the session.",
  },
  {
    number: "02",
    title: "Practice your interview",
    description:
      "Respond by text or use voice features when they are configured and supported.",
  },
  {
    number: "03",
    title: "Review what was captured",
    description:
      "Return to your transcript, measured metrics, and clearly labeled AI guidance.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0f] text-white">
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-600/20 via-blue-600/[0.07] to-transparent" />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-5 pb-24 pt-20 text-center sm:px-8 sm:pt-28">
          <Link href="/" className="mb-9 inline-flex items-center gap-3">
            <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 shadow-lg shadow-violet-900/40">
              <Mic aria-hidden="true" className="h-5 w-5 text-white" />
            </span>
            <span className="text-2xl font-bold tracking-tight">
              <span className="gradient-text">Voice</span>
              <span>Hire</span>
            </span>
          </Link>

          <p className="mb-5 rounded-full border border-violet-300/20 bg-violet-300/[0.07] px-4 py-1.5 text-sm font-medium text-violet-200">
            Interview practice, grounded in your experience
          </p>
          <h1 className="max-w-5xl text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Don&apos;t just prepare answers.
            <span className="mt-2 block gradient-text">Prepare to perform.</span>
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-relaxed text-slate-300 sm:text-xl">
            Practice role-specific interviews with your resume and job context.
            Review saved transcripts, measured speaking metrics, and clearly
            labeled AI feedback.
          </p>
          <div className="mt-9 flex justify-center">
            <ButtonLink
              href="/sign-in"
              className="min-h-12 rounded-xl px-7 text-base shadow-lg shadow-violet-500/25"
            >
              <Sparkles aria-hidden="true" className="h-5 w-5" />
              Try demo interview
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </ButtonLink>
          </div>
          <p className="mt-5 max-w-xl text-sm text-slate-400">
            No paid credentials needed. Simulated sessions are labeled and
            separate from real evaluations; never enter real candidate data.
          </p>

          <Card className="mt-16 w-full max-w-5xl rounded-3xl border-white/10 bg-slate-950/80 p-3 text-left shadow-2xl shadow-violet-950/40 sm:p-5">
            <div className="rounded-2xl border border-white/10 bg-[#10111b] p-5 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Interview workspace
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    An illustrative preview — no candidate data or scores
                  </p>
                </Card>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  Ready to practice
                </span>
              </div>
              <div className="grid gap-4 pt-5 md:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">
                    Interview question
                  </p>
                  <p className="mt-3 text-base leading-relaxed text-slate-100">
                    Questions are tailored from your provided resume and role
                    context.
                  </p>
                  <div className="mt-6 flex h-12 items-center gap-1.5" aria-hidden="true">
                    {[3, 5, 4, 8, 5, 10, 6, 4, 9, 5, 7, 3, 6, 9, 4, 7].map(
                      (height, index) => (
                        <span
                          key={index}
                          className="w-1.5 rounded-full bg-gradient-to-t from-violet-600 to-blue-400"
                          style={{ height: `${height * 4}px` }}
                        />
                      ),
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Voice availability depends on browser support and
                    configuration. Text input remains available.
                  </p>
                </div>
                <div className="grid gap-3">
                  {[
                    "Saved transcript",
                    "Measured metrics when data is sufficient",
                    "AI guidance with answer evidence",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4"
                    >
                      <Check
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
                      />
                      <span className="text-sm leading-relaxed text-slate-200">
                        {item}
                      </span>
                    </div>
                  ))}
                  <p className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-relaxed text-amber-100">
                    AI assessments are guidance, not proof of competence.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="features-heading"
        className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20"
      >
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-300">
            Practice with purpose
          </p>
          <h2 id="features-heading" className="mt-3 text-3xl font-bold sm:text-4xl">
            A clearer way to prepare
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 transition hover:border-violet-300/25 hover:bg-white/[0.055]"
            >
              <span
                className={`mb-4 inline-flex rounded-lg bg-gradient-to-br ${feature.color} p-2.5`}
              >
                <feature.icon
                  aria-hidden="true"
                  className="h-5 w-5 text-white"
                />
              </span>
              <h3 className="text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-300">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="steps-heading"
        className="border-y border-white/[0.07] bg-white/[0.02]"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-300">
              How it works
            </p>
            <h2 id="steps-heading" className="mt-3 text-3xl font-bold sm:text-4xl">
              Three steps to a focused practice
            </h2>
          </div>
          <ol className="grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <li
                key={step.number}
                className="rounded-2xl border border-white/10 bg-[#0d0e16] p-6"
              >
                <span className="text-sm font-bold tracking-widest text-violet-300">
                  {step.number}
                </span>
                <h3 className="mt-4 text-xl font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-300">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-center sm:flex-row sm:px-8 sm:text-left">
        <p className="text-sm text-slate-400">
          VoiceHire — deliberate practice, honest feedback.
        </p>
        <nav aria-label="Footer" className="flex gap-5 text-sm">
          <Link
            href="/sign-in"
            className="text-slate-300 underline-offset-4 hover:text-white hover:underline"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-slate-300 underline-offset-4 hover:text-white hover:underline"
          >
            Create an account
          </Link>
        </nav>
      </footer>
    </main>
  );
}
