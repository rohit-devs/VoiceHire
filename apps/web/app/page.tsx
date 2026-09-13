import type { Metadata } from "next";
import Link from "next/link";
import { Mic, Sparkles, BarChart3, MessageSquare, Zap, ArrowRight, Play } from "lucide-react";

export const metadata: Metadata = {
  title: "VoiceHire - AI Interviewer & Communication Coach",
  description: "Real-time AI voice interviews, adaptive follow-ups, and personalized coaching to help you perform better.",
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-blue-600/10 to-transparent" />
        <div className="mx-auto max-w-6xl px-6 py-24 relative">
          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 opacity-80 blur-sm" />
              <div className="relative rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 p-2">
                <Mic className="h-5 w-5 text-white" />
              </div>
            </div>
            <span className="text-2xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Voice</span>
              <span className="text-white">Hire</span>
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Don&apos;t just prepare answers.
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              Prepare to perform.
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
            Real-time AI voice interviews with adaptive follow-ups, pressure mode, technical analysis, and personalized coaching.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
            >
              <Sparkles className="h-5 w-5" />
              Launch Dashboard
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/interview/new"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-8 py-3.5 text-base font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all"
            >
              <Play className="h-5 w-5" />
              Start Interview
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Mic,
              title: "Real-Time Voice",
              desc: "Natural voice conversations with AI interviewer that adapts to your responses.",
              color: "from-violet-500 to-purple-600",
            },
            {
              icon: MessageSquare,
              title: "Adaptive Follow-Ups",
              desc: "AI asks contextual follow-up questions based on your answers, just like real interviews.",
              color: "from-blue-500 to-cyan-600",
            },
            {
              icon: Zap,
              title: "Pressure Mode",
              desc: "Simulate high-pressure interview scenarios with interruptions and challenges.",
              color: "from-amber-500 to-orange-600",
            },
            {
              icon: BarChart3,
              title: "Technical Analysis",
              desc: "Deep analysis of your technical knowledge, code quality, and problem-solving.",
              color: "from-emerald-500 to-green-600",
            },
            {
              icon: Activity,
              title: "Communication Fingerprint",
              desc: "Unique profile of your speaking patterns, pace, filler words, and clarity.",
              color: "from-pink-500 to-rose-600",
            },
            {
              icon: Sparkles,
              title: "AI Coaching",
              desc: "Personalized 7-day improvement plans based on your performance data.",
              color: "from-indigo-500 to-violet-600",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.05]"
            >
              <div className={`inline-flex rounded-lg bg-gradient-to-br ${feature.color} p-2.5 shadow-lg mb-4`}>
                <feature.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

import { Activity } from "lucide-react";
