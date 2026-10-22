import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  Mic,
  Play,
  ShieldCheck,
} from "lucide-react";
import { getAuthMode } from "@/lib/auth-mode";

export const metadata: Metadata = {
  title: "VoiceHire — AI Interviewer & Communication Coach",
  description:
    "Practice role-specific interviews, review evidence-backed AI guidance, and track verified metrics.",
};

/* -------------------------------------------------------------------------- */
/*  Data                                                                      */
/* -------------------------------------------------------------------------- */

const CAPABILITIES = [
  {
    n: "01",
    title: "Voice or text",
    desc: "Practice out loud or type — same questions, same rigor.",
  },
  {
    n: "02",
    title: "Context-aware questions",
    desc: "Built from your resume and the role you're targeting.",
  },
  {
    n: "03",
    title: "Evidence-backed review",
    desc: "AI rubric judgments quote your own answers. Guidance, not proof.",
  },
  {
    n: "04",
    title: "Measured metrics",
    desc: "Pace, pauses and fillers — only when transcript data supports them.",
  },
  {
    n: "05",
    title: "Targeted drills",
    desc: "Saved exercises aimed at your weakest moments.",
  },
] as const;

const SKILLS = [
  "Behavioral interviews",
  "Technical deep-dives",
  "Case & role-play",
  "Executive presence",
  "Salary conversations",
] as const;

const MARQUEE_ITEMS = [
  "Voice practice",
  "Measured metrics",
  "Evidence-backed feedback",
  "Role-specific questions",
  "Honest AI guidance",
] as const;

const METHOD_CARDS = [
  {
    img: "/mic-detail.jpg",
    alt: "Studio microphone under a spotlight",
    n: "01",
    title: "Speak or type",
    tag: "Voice & text modes",
    desc: "Use voice features when supported, or answer by text. The same session either way.",
  },
  {
    img: "/singer-tall.jpg",
    alt: "Performer silhouette at a vintage microphone",
    n: "02",
    title: "Context-driven questions",
    tag: "Resume + role aware",
    desc: "Questions are tailored from your resume and job description, with follow-ups that reference your answers.",
  },
  {
    img: "/hero-speaker.jpg",
    alt: "Candidate silhouette in a studio booth",
    n: "03",
    title: "Evidence-backed review",
    tag: "Quotes, not vibes",
    desc: "AI rubric judgments cite your own transcript. Guidance — clearly labeled, never proof of competence.",
  },
] as const;

const FEATURE_LIST = [
  { icon: Mic, label: "Voice or text sessions" },
  { icon: BarChart3, label: "Evidence-backed AI review" },
  { icon: Activity, label: "Measured transcript metrics" },
  { icon: ShieldCheck, label: "Demo sessions clearly labeled" },
] as const;

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function HomePage() {
  const authMode = getAuthMode();
  const isDemo = authMode === "local-demo";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0a0a0a] text-neutral-200 antialiased">
      {/* Page-local styles — system fonts only, reduced-motion safe */}
      <style>{`
        .vh-display {
          font-family: Impact, "Haettenschweiler", "Arial Narrow Bold", "Arial Narrow", sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.01em;
          line-height: 0.88;
          font-weight: 400;
        }
        .vh-label {
          letter-spacing: 0.28em;
          text-transform: uppercase;
        }
        @keyframes vh-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .vh-marquee-track {
          animation: vh-marquee 28s linear infinite;
          width: max-content;
        }
        @keyframes vh-rise {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .vh-rise {
          animation: vh-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .vh-d1 { animation-delay: 0.08s; }
        .vh-d2 { animation-delay: 0.16s; }
        .vh-d3 { animation-delay: 0.24s; }
        .vh-d4 { animation-delay: 0.32s; }
        .vh-dots {
          background-image: radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px);
          background-size: 22px 22px;
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .vh-marquee-track,
          .vh-rise {
            animation: none !important;
          }
          .vh-rise {
            opacity: 1;
            transform: none;
          }
        }

        /* Focus ring utility */
        .vh-focus:focus-visible {
          outline: 2px solid #e8321e;
          outline-offset: 3px;
        }
      `}</style>

      {/* ===================== NAV ===================== */}
      <header className="sticky top-0 z-50 border-b border-neutral-800 bg-[#0a0a0a]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-10">
          <Link
            href="/"
            className="vh-focus flex items-center gap-2.5 rounded-sm"
            aria-label="VoiceHire home"
          >
            <span className="flex h-9 w-9 items-center justify-center bg-[#e8321e]" aria-hidden>
              <Mic className="h-4 w-4 text-white" />
            </span>
            <span className="vh-display text-xl tracking-wide text-white">
              Voice<span className="text-[#e8321e]">Hire</span>
            </span>
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-8 text-xs vh-label text-neutral-400 lg:flex"
          >
            <a href="#method" className="vh-focus rounded-sm transition hover:text-white">
              Method
            </a>
            <a href="#skills" className="vh-focus rounded-sm transition hover:text-white">
              Capabilities
            </a>
            <a href="#process" className="vh-focus rounded-sm transition hover:text-white">
              Process
            </a>
            <a href="#voices" className="vh-focus rounded-sm transition hover:text-white">
              Voices
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="vh-focus hidden text-xs font-bold vh-label text-neutral-400 transition hover:text-white sm:inline-block"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="vh-focus group inline-flex items-center gap-1.5 sm:gap-2 border border-[#e8321e] px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold vh-label text-[#e8321e] transition hover:bg-[#e8321e] hover:text-white"
            >
              Create account
              <ArrowUpRight
                aria-hidden
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
            {isDemo && (
              <Link
                href="/interview/new?demo=true"
                className="vh-focus hidden md:inline-flex items-center gap-1.5 border border-amber-400/40 bg-amber-400/10 px-3.5 py-2 text-xs font-bold vh-label text-amber-300 transition hover:bg-amber-400 hover:text-black"
              >
                Try demo interview
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden border-b border-neutral-800" aria-labelledby="hero-heading">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 pb-16 pt-14 sm:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pb-24 lg:pt-20">
          <div>
            <p className="vh-rise vh-label text-xs font-bold text-[#e8321e]">
              AI interview coach
            </p>
            <h1
              id="hero-heading"
              className="vh-rise vh-d1 vh-display mt-5 text-[17vw] text-white sm:text-8xl lg:text-[7.5rem]"
            >
              Answers
              <span className="block">that</span>
              <span className="block text-[#e8321e]">move.</span>
            </h1>
            <p className="vh-rise vh-d2 mt-7 max-w-md text-base leading-relaxed text-neutral-400">
              Role-specific interview practice grounded in your own resume and
              job context — with transcripts, measured speaking metrics, and
              clearly labeled AI feedback.
            </p>
            <div className="vh-rise vh-d3 mt-9 flex flex-wrap items-center gap-5">
              <Link
                href="/sign-up"
                className="vh-focus group inline-flex items-center gap-3 bg-[#e8321e] px-7 py-4 text-xs font-bold vh-label text-white transition hover:bg-[#ff3b2d]"
              >
                <Play aria-hidden className="h-4 w-4 fill-current" />
                Start practicing
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                />
              </Link>
              <Link
                href="/sign-in"
                className="vh-focus vh-label border-b border-neutral-600 pb-1 text-xs text-neutral-300 transition hover:border-[#e8321e] hover:text-white"
              >
                Sign in
              </Link>
              {isDemo && (
                <Link
                  href="/interview/new?demo=true"
                  className="vh-focus group inline-flex items-center gap-2 border border-amber-400/50 bg-amber-400/10 px-5 py-3.5 text-xs font-bold vh-label text-amber-300 transition hover:bg-amber-400 hover:text-black"
                >
                  Try demo interview
                  <ArrowRight
                    aria-hidden
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              )}
              <a
                href="#method"
                className="vh-focus vh-label border-b border-neutral-600 pb-1 text-xs text-neutral-300 transition hover:border-[#e8321e] hover:text-white"
              >
                Explore the method
              </a>
            </div>
            <p className="vh-rise vh-d4 mt-8 max-w-sm text-xs leading-relaxed text-neutral-500">
              No paid credentials needed. Simulated sessions are labeled and
              separate from real evaluations — never enter real candidate data.
            </p>
          </div>

          {/* Portrait with red disc */}
          <div className="vh-rise vh-d2 relative mx-auto w-full max-w-md lg:max-w-none">
            <div
              aria-hidden
              className="absolute -right-10 top-1/2 aspect-square w-[85%] -translate-y-1/2 rounded-full bg-[#e8321e]"
            />
            <div className="relative ml-auto aspect-[3/4] w-[78%] overflow-hidden border border-neutral-800 grayscale">
              <Image
                src="/hero-speaker.jpg"
                alt="Candidate practicing a response in a recording studio"
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 40vw"
                className="object-cover"
              />
            </div>
            <div className="absolute -left-2 bottom-8 border border-neutral-800 bg-[#0a0a0a] px-5 py-4 sm:left-6">
              <p className="vh-display text-3xl text-[#e8321e]">Voice + text</p>
              <p className="vh-label mt-1 text-[10px] text-neutral-400">
                Practice your way
              </p>
            </div>
            <div
              aria-hidden
              className="vh-dots absolute -left-6 -top-6 -z-0 h-32 w-32 opacity-60"
            />
          </div>
        </div>
      </section>

      {/* ===================== MARQUEE ===================== */}
      <div
        className="overflow-hidden border-b border-neutral-800 bg-[#0d0d0d] py-4"
        aria-hidden
      >
        <div className="vh-marquee-track flex items-center gap-8">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map(
            (item, i) => (
              <span key={i} className="flex items-center gap-8 whitespace-nowrap">
                <span className="vh-display text-2xl text-neutral-600">{item}</span>
                <Mic className="h-4 w-4 text-[#e8321e]" />
              </span>
            )
          )}
        </div>
      </div>

      {/* ===================== METHOD CARDS ===================== */}
      <section
        id="method"
        aria-labelledby="method-heading"
        className="border-b border-neutral-800"
      >
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-10 lg:py-24">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="vh-label text-xs font-bold text-[#e8321e]">
                Selected capabilities
              </p>
              <h2
                id="method-heading"
                className="vh-display mt-3 text-5xl text-white sm:text-7xl"
              >
                The practice<span className="text-[#e8321e]">.</span>
              </h2>
            </div>
            <a
              href="#skills"
              className="vh-focus group inline-flex items-center gap-2 text-xs font-bold vh-label text-neutral-400 transition hover:text-white"
            >
              Explore capabilities
              <ArrowUpRight
                aria-hidden
                className="h-4 w-4 text-[#e8321e] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </a>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {METHOD_CARDS.map((card) => (
              <article
                key={card.n}
                className="group border border-neutral-800 bg-[#0d0d0d] transition hover:border-[#e8321e]"
              >
                <div className="relative aspect-[4/3] overflow-hidden border-b border-neutral-800 grayscale">
                  <Image
                    src={card.img}
                    alt={card.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-4 top-4 bg-[#e8321e] px-2.5 py-1 text-xs font-bold text-white">
                    {card.n}
                  </span>
                </div>
                <div className="p-6">
                  <p className="vh-label text-[10px] text-[#e8321e]">{card.tag}</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <h3 className="vh-display text-3xl text-white">{card.title}</h3>
                    <ArrowUpRight
                      aria-hidden
                      className="h-5 w-5 shrink-0 text-neutral-600 transition group-hover:text-[#e8321e]"
                    />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                    {card.desc}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== SKILLS SPLIT ===================== */}
      <section
        id="skills"
        aria-labelledby="skills-heading"
        className="border-b border-neutral-800"
      >
        <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-16 sm:px-10 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="vh-label text-xs font-bold text-[#e8321e]">
              What you can train
            </p>
            <h2
              id="skills-heading"
              className="vh-display mt-4 text-5xl text-white sm:text-7xl"
            >
              Precision practice<span className="text-[#e8321e]">.</span>
              <span className="mt-1 block text-[#e8321e]">
                Measurable progress.
              </span>
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-neutral-400">
              Sessions adapt to the interview formats you actually face — and
              every metric comes from your finalized transcript, never from
              guesswork.
            </p>
            <ul className="mt-8 space-y-3">
              {FEATURE_LIST.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-3 text-sm text-neutral-300"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center border border-neutral-800 text-[#e8321e]"
                    aria-hidden
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col justify-center">
            <p className="vh-label text-xs font-bold text-[#e8321e]">Practice formats</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2" role="list">
              {SKILLS.map((skill) => (
                <div
                  key={skill}
                  role="listitem"
                  className="border border-neutral-800 bg-[#0d0d0d] px-4 py-5 text-sm font-medium text-neutral-200"
                >
                  {skill}
                </div>
              ))}
            </div>
            <p className="mt-8 text-xs leading-relaxed text-neutral-500">
              Choose a format that fits your next conversation. Metrics are
              computed only when timestamped transcript data is sufficient.
            </p>
          </div>
        </div>
      </section>

      {/* ===================== PROCESS SEQUENCE ===================== */}
      <section
        id="process"
        aria-labelledby="process-heading"
        className="border-b border-neutral-800 bg-[#0d0d0d]"
      >
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-10 lg:py-24">
          <p className="vh-label text-xs font-bold text-[#e8321e]">The sequence</p>
          <h2
            id="process-heading"
            className="vh-display mt-4 text-5xl text-white sm:text-7xl"
          >
            Five moves to a sharper you
            <span className="text-[#e8321e]">.</span>
          </h2>
          <ol className="mt-14 grid gap-px border border-neutral-800 bg-neutral-800 sm:grid-cols-2 lg:grid-cols-5">
            {CAPABILITIES.map((step) => (
              <li
                key={step.n}
                className="group bg-[#0a0a0a] p-6 transition hover:bg-[#e8321e]"
              >
                <span className="vh-display text-4xl text-[#e8321e] transition group-hover:text-white">
                  {step.n}
                </span>
                <h3 className="vh-display mt-5 text-xl text-white">
                  {step.title}
                </h3>
                <p className="mt-3 text-xs leading-relaxed text-neutral-400 transition group-hover:text-white/90">
                  {step.desc}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===================== TESTIMONIAL ===================== */}
      <section
        id="voices"
        aria-labelledby="voices-heading"
        className="border-b border-neutral-800"
      >
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-16 sm:px-10 lg:grid-cols-[auto_1fr] lg:py-24">
          <span
            aria-hidden
            className="vh-display select-none text-[10rem] leading-none text-[#e8321e] sm:text-[14rem]"
          >
            &ldquo;
          </span>
          <div className="flex flex-col justify-center">
            <h2 id="voices-heading" className="sr-only">
              What candidates say
            </h2>
            <p className="vh-label text-xs font-bold text-[#e8321e]">Practice with purpose</p>
            <p className="mt-4 max-w-3xl text-2xl font-medium leading-snug text-white sm:text-4xl">
              Get follow-up questions grounded in your answers, then review
              transcript evidence and measured speaking metrics.
            </p>
          </div>
        </div>
      </section>

      {/* ===================== CTA ===================== */}
      <section className="relative overflow-hidden" aria-labelledby="cta-heading">
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-16 sm:px-10 lg:grid-cols-2 lg:py-28">
          <div>
            <p className="vh-label text-xs font-bold text-[#e8321e]">
              Ready when you are
            </p>
            <h2
              id="cta-heading"
              className="vh-display mt-4 text-6xl text-white sm:text-8xl"
            >
              Let&apos;s make you
              <span className="block text-[#e8321e]">unforgettable.</span>
            </h2>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Link
                href="/sign-up"
                className="vh-focus group inline-flex items-center gap-3 bg-[#e8321e] px-8 py-4 text-xs font-bold vh-label text-white transition hover:bg-[#ff3b2d]"
              >
                Start practicing
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                />
              </Link>
              <Link
                href="/sign-in"
                className="vh-focus vh-label border-b border-neutral-600 pb-1 text-xs text-neutral-300 transition hover:border-[#e8321e] hover:text-white"
              >
                Sign in
              </Link>
              {isDemo && (
                <Link
                  href="/interview/new?demo=true"
                  className="vh-focus group inline-flex items-center gap-2 border border-amber-400/50 bg-amber-400/10 px-6 py-4 text-xs font-bold vh-label text-amber-300 transition hover:bg-amber-400 hover:text-black"
                >
                  Try demo interview
                  <ArrowRight
                    aria-hidden
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              )}
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs text-neutral-500">
              <Check aria-hidden className="h-4 w-4 text-[#e8321e]" />
              Simulated sessions are labeled and kept separate from real
              evaluations.
            </p>
          </div>
          <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
            <div
              aria-hidden
              className="absolute -left-8 -top-8 h-full w-full border border-[#e8321e]"
            />
            <div className="relative aspect-square overflow-hidden grayscale">
              <Image
                src="/mic-detail.jpg"
                alt="Hand gripping a vintage microphone in a spotlight"
                fill
                sizes="(max-width: 1024px) 90vw, 30vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="border-t border-neutral-800">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-5 py-8 text-center sm:flex-row sm:px-10 sm:text-left">
          <p className="vh-label text-[10px] text-neutral-500">
            VoiceHire — deliberate practice, honest feedback.
          </p>
          <nav
            aria-label="Footer"
            className="flex gap-6 text-xs vh-label text-neutral-400"
          >
            <Link href="/sign-in" className="vh-focus rounded-sm transition hover:text-white">
              Sign in
            </Link>
            <Link href="/sign-up" className="vh-focus rounded-sm transition hover:text-white">
              Create an account
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
