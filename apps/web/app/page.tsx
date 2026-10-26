export const metadata = {
  title: "VoiceHire — AI Interviewer & Communication Coach",
  description:
    "Practice role-specific interviews, review evidence-backed AI guidance, and track verified metrics.",
};

import { ButtonLink, Card } from "@/components/ui/primitives";

function Hero() {
  return (
    <section className="relative border border-border bg-card p-6 sm:p-12 rounded-2xl overflow-hidden">
      <div className="relative z-10 max-w-5xl mx-auto text-center">
        <p className="vh-label text-primary font-bold uppercase tracking-wider text-xs mb-3">
          Deliberate practice. Honest feedback.
        </p>
        <h1 className="vh-display text-4xl sm:text-6xl font-bold text-foreground leading-tight mb-6">
          AI-powered mock interviews.
          <span className="block">Built for your target role.</span>
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Practise spoken interviews tailored to your role, get adaptive follow-up questions,
          and receive an honest evaluation with a personalised 7-day coaching plan.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <ButtonLink
            href="/interview/new"
            className="bg-primary text-primary-foreground hover:bg-accent-hover hover:text-primary-foreground px-8 py-3 text-base font-semibold shadow-[0_0_30px_rgba(232,50,30,0.35)]"
          >
            Start Interview
          </ButtonLink>
          <ButtonLink
            href="/dashboard"
            variant="secondary"
            className="px-8 py-3 text-base font-semibold"
          >
            View dashboard
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Set up your interview",
      description:
        "Choose your target role, experience level, interview type, and paste your resume and job description.",
    },
    {
      number: "02",
      title: "Practise by voice or text",
      description:
        "Answer live questions in real time. Transcript is saved as you speak; typed answers are always available as a fallback.",
    },
    {
      number: "03",
      title: "Get verified feedback",
      description:
        "Receive an evidence-backed evaluation, communication metrics, strengths, weaknesses, and a 7-day coaching plan.",
    },
  ];

  return (
    <section className="mt-16">
      <div className="max-w-5xl mx-auto px-6 sm:px-12">
        <div className="text-center mb-12">
          <h2 className="vh-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            How it works
          </h2>
          <p className="text-secondary">
            Three steps from setup to coaching plan.
          </p>
        </div>
        <ol className="grid gap-8 sm:grid-cols-3">
          {steps.map((step) => (
            <li key={step.number} className="space-y-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/30 text-primary font-mono font-bold text-sm">
                {step.number}
              </div>
              <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="text-sm text-secondary leading-relaxed">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      title: "Role-specific questions",
      description: "Interviewer adapts to your target role, experience level, and job description.",
    },
    {
      title: "Voice or text answers",
      description: "Speak naturally or type your answers. Transcript persists across refresh.",
    },
    {
      title: "Evidence-backed evaluation",
      description: "AI judgments cite exact quotes from your answers — no fabricated scores.",
    },
    {
      title: "7-day coaching plan",
      description: "Actionable practice tasks tied to your weakest rubric categories.",
    },
  ];

  return (
    <section className="mt-16 border-t border-border pt-12">
      <div className="max-w-5xl mx-auto px-6 sm:px-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="p-6 border-border/60 hover:border-primary/40 transition-colors"
            >
              <h3 className="font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm text-secondary leading-relaxed">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Hero />
      <HowItWorks />
      <Features />
    </main>
  );
}
