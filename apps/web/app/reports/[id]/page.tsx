"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { apiInterviewService } from "@/lib/services/apiInterviewService";
import type { EvaluationReport, PersistedTranscriptEntry } from "@/lib/services/interviewService";

function MetricCard({ label, metric }: {
  label: string;
  metric: { value: number | null; unit: string; reason: string | null };
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-medium text-white">{label}</h3>
      {metric.value === null ? (
        <p className="mt-2 text-sm text-muted-foreground">{metric.reason || "Insufficient data."}</p>
      ) : (
        <p className="mt-2 text-xl font-semibold text-white">
          {metric.value} <span className="text-sm font-normal text-muted-foreground">{metric.unit}</span>
        </p>
      )}
    </div>
  );
}

export default function ReportPage() {
  const params = useParams();
  const interviewId = params.id as string;
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [transcript, setTranscript] = useState<PersistedTranscriptEntry[]>([]);
  const [error, setError] = useState("");
  const [progressError, setProgressError] = useState("");
  const [checkedDays, setCheckedDays] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiInterviewService.getReport(interviewId),
      apiInterviewService.getTranscript(interviewId),
    ]).then(([data, entries]) => {
      if (active) {
        setReport(data);
        setTranscript(entries);
      }
      if (data.ai_assessments) {
        void apiInterviewService.getCoachingPlan(interviewId).then((plan) => {
          if (active) {
            setCheckedDays(new Set(plan.days.filter((day) => day.completed).map((day) => day.day)));
          }
        }).catch((cause: unknown) => {
          if (active) setProgressError(cause instanceof Error ? cause.message : "Could not load coaching progress.");
        });
      }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load this report.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [interviewId]);

  async function updateDay(day: number, checked: boolean) {
    setProgressError("");
    try {
      await apiInterviewService.updateCoachingProgress(interviewId, day, checked);
      setCheckedDays((previous) => {
        const next = new Set(previous);
        if (checked) next.add(day);
        else next.delete(day);
        return next;
      });
    } catch (cause) {
      setProgressError(cause instanceof Error ? cause.message : "Could not save coaching progress.");
    }
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-[#0a0a0f] px-6 py-12">
        <section className="mx-auto max-w-5xl space-y-8">
          <header>
            <h1 className="text-3xl font-bold text-white">Interview evaluation</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              AI scores are guidance for practice, not proof of competence.
            </p>
          </header>

          {loading ? (
            <p role="status" className="text-muted-foreground">Loading persisted report…</p>
          ) : error ? (
            <div><p role="alert" className="text-rose-300">{error}</p><button onClick={() => window.location.reload()} className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">Retry</button></div>
          ) : report?.status === "failed" ? (
            <p role="alert" className="text-amber-300">
              Evaluation failed: {report.error || "No assessment was stored."}
            </p>
          ) : report?.status === "processing" ? (
            <p role="status" className="text-muted-foreground">Evaluation is still processing.</p>
          ) : report ? (
            <>
              <p className="text-xs text-muted-foreground">Rubric version {report.rubric_version}</p>
              <section aria-labelledby="measured-heading" className="space-y-4">
                <div>
                  <h2 id="measured-heading" className="text-xl font-semibold text-white">
                    Measured metrics
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Computed in code from finalized transcript segments and timestamps.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <MetricCard label="Speaking time" metric={report.measured_metrics.speaking_duration_seconds} />
                  <MetricCard label="Speaking rate" metric={report.measured_metrics.words_per_minute} />
                  <MetricCard label="Filler-word rate" metric={report.measured_metrics.filler_word_rate} />
                  <MetricCard label="Average answer length" metric={report.measured_metrics.answer_length_words} />
                  <MetricCard label="Questions answered" metric={report.measured_metrics.questions_answered} />
                  <MetricCard label="Time remaining" metric={report.measured_metrics.time_remaining_seconds} />
                </div>
                {report.measured_metrics.answer_lengths_by_question.value && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <h3 className="text-sm font-medium text-white">Answer length by question</h3>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {report.measured_metrics.answer_lengths_by_question.value.map((answer) => (
                        <li key={answer.question_id}>Question {answer.question_id}: {answer.words} words</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {report.ai_assessments ? (
                <section aria-labelledby="ai-heading" className="space-y-5">
                  <div>
                    <h2 id="ai-heading" className="text-xl font-semibold text-white">
                      AI judgments
                    </h2>
                    <p className="mt-1 text-sm text-amber-200">{report.guidance_note}</p>
                  </div>
                  <div className="rounded-xl border border-violet-400/20 bg-violet-400/[0.05] p-5">
                    <p className="text-sm text-muted-foreground">Overall AI judgment · weighted rubric score · 0–5</p>
                    <p className="mt-1 text-3xl font-bold text-white">
                      {report.ai_assessments.overall_score.toFixed(2)} / 5
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(report.ai_assessments.category_scores).map(([category, assessment]) => (
                      <article key={category} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <h3 className="font-medium capitalize text-white">{category.replace(/_/g, " ")}</h3>
                        <p className="mt-1 text-sm text-violet-200">{assessment.score} / 5 · AI judgment</p>
                        <p className="mt-2 text-sm text-muted-foreground">{assessment.rationale}</p>
                      </article>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white">Per-question evidence</h3>
                    {report.ai_assessments.per_question_analysis.map((item, index) => (
                      <article key={item.question_id} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                        <h4 className="font-medium text-white">{item.question}</h4>
                        <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Saved candidate answer</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">
                            {transcript.filter((entry) => entry.speaker === "candidate")[index]?.text ?? "No matching saved answer is available."}
                          </p>
                        </div>
                        <blockquote className="border-l-2 border-violet-400 pl-3 text-sm text-violet-100">
                          “{item.evidence_quote}”
                        </blockquote>
                        <p className="text-sm text-muted-foreground">{item.rationale}</p>
                      </article>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                      <h3 className="font-semibold text-white">Strengths</h3>
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                        {report.ai_assessments.strengths.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                      <h3 className="font-semibold text-white">Missing elements</h3>
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                        {report.ai_assessments.missing_elements.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                    <h3 className="font-semibold text-white">Improved-answer structure</h3>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                      {report.ai_assessments.improved_answer_structure.map((item) => <li key={item}>{item}</li>)}
                    </ol>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                    <h3 className="font-semibold text-white">Practice exercises</h3>
                    <ul className="mt-3 space-y-3">
                      {report.ai_assessments.practice_exercises.map((item, index) => (
                        <li key={`${item.category}-${index}`} className="flex items-start gap-3 text-sm">
                          <input
                            type="checkbox"
                            aria-label={`Mark ${item.title} complete`}
                            checked={checkedDays.has(index + 1)}
                            onChange={(event) => void updateDay(index + 1, event.target.checked)}
                            className="mt-1 accent-violet-500"
                          />
                          <div>
                            <span className="font-medium text-white">{item.title}</span>
                            <span className="ml-2 text-xs text-violet-200">
                              {item.category.replace(/_/g, " ")} · {item.target_role}
                            </span>
                            <p className="mt-1 text-muted-foreground">{item.task}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {progressError && <p role="alert" className="mt-3 text-sm text-amber-300">{progressError}</p>}
                  </div>
                </section>
              ) : (
                <p role="status" className="text-muted-foreground">
                  {report.error || "Insufficient answer data is available for AI assessment. Measured values above remain separate."}
                </p>
              )}
            </>
          ) : null}

          <Link
            href={`/interview/complete/${interviewId}`}
            className="inline-flex rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
          >
            Return to interview summary
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
