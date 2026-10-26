"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { apiInterviewService } from "@/lib/services/apiInterviewService";
import type { EvaluationReport, PersistedTranscriptEntry } from "@/lib/services/interviewService";
import type { CoachingPlan } from "@/types";
import { Button, ButtonLink, Card } from "@/components/ui/primitives";

function MetricCard({ label, metric }: {
  label: string;
  metric: { value: number | null; unit: string; reason: string | null };
}) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium text-foreground">{label}</h3>
      {metric.value === null ? (
        <p className="mt-2 text-sm text-muted-foreground">{metric.reason || "Insufficient data."}</p>
      ) : (
        <p className="mt-2 text-xl font-semibold text-foreground">
          {metric.value} <span className="text-sm font-normal text-muted-foreground">{metric.unit}</span>
        </p>
      )}
    </Card>
  );
}

export default function ReportPage() {
  const params = useParams();
  const interviewId = params.id as string;
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [transcript, setTranscript] = useState<PersistedTranscriptEntry[]>([]);
  const [coachingPlan, setCoachingPlan] = useState<CoachingPlan | null>(null);
  const [error, setError] = useState("");
  const [progressError, setProgressError] = useState("");
  const [checkedDays, setCheckedDays] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const loadRequestId = useRef(0);

  const loadReport = useCallback(async () => {
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setError("");
    setProgressError("");
    try {
      const [data, entries] = await Promise.all([
        apiInterviewService.getReport(interviewId),
        apiInterviewService.getTranscript(interviewId),
      ]);
      if (requestId !== loadRequestId.current) return;
      setReport(data);
      setTranscript(entries);
      if (data.ai_assessments) {
        try {
          const plan = await apiInterviewService.getCoachingPlan(interviewId);
          if (requestId !== loadRequestId.current) return;
          setCoachingPlan(plan);
          setCheckedDays(new Set(plan.days.filter((day) => day.completed).map((day) => day.day)));
        } catch (cause: unknown) {
          if (requestId !== loadRequestId.current) return;
          setProgressError(cause instanceof Error ? cause.message : "Could not load coaching progress.");
          setCoachingPlan(null);
        }
      } else {
        setCoachingPlan(null);
      }
    } catch (cause: unknown) {
      if (requestId !== loadRequestId.current) return;
      setError(cause instanceof Error ? cause.message : "Could not load this report.");
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    void loadReport();
    return () => {
      loadRequestId.current += 1;
    };
  }, [loadReport]);

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
      <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
        <section className="mx-auto max-w-5xl space-y-7">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
            <h1 className="text-3xl font-bold text-foreground">
              Interview evaluation
              {report?.provider === "demo" && (
                <span className="text-[10px] font-semibold text-warning bg-warning/10 px-2 py-0.5 rounded border border-warning/20 ml-2">
                  Demo / Simulated
                </span>
              )}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {report?.provider === "demo"
                ? "Demo scores are heuristic simulations, not AI-generated assessments."
                : "AI scores are guidance for practice, not proof of competence."}
            </p>
            </div>
            {!loading && !error && report?.ai_assessments && (
              <Button variant="secondary" onClick={() => void loadReport()}>
                Refresh report
              </Button>
            )}
          </header>

          {loading ? (
            <div role="status" className="space-y-4" aria-label="Loading persisted report">
              <p className="text-sm text-muted-foreground">Loading persisted report…</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-xl border border-border bg-background/5" />
                ))}
              </div>
            </div>
          ) : error ? (
            <Card className="space-y-4 p-5">
              <p role="alert" className="text-sm text-error">{error}</p>
              <Button onClick={() => void loadReport()}>Retry loading report</Button>
            </Card>
          ) : report?.status === "failed" ? (
            <Card className="space-y-4 p-5">
              <p role="alert" className="text-sm text-warning">
                Evaluation failed: {report.error || "No assessment was stored."}
              </p>
              <p className="text-sm text-secondary">
                This report is persisted and idempotent; a new evaluation cannot be generated for this same session.
              </p>
              <ButtonLink href="/interview/new">Start a new interview</ButtonLink>
            </Card>
          ) : report?.status === "processing" ? (
            <Card role="status" className="p-5 text-sm text-secondary">Evaluation is still processing. Refresh this report to check again.</Card>
          ) : report ? (
            <>
              <p className="text-xs text-muted-foreground">Rubric version {report.rubric_version}</p>
              <section aria-labelledby="measured-heading" className="space-y-4">
                <div>
                  <h2 id="measured-heading" className="text-xl font-semibold text-foreground">
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
                  <Card className="p-4">
                    <h3 className="text-sm font-medium text-foreground">Answer length by question</h3>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {report.measured_metrics.answer_lengths_by_question.value.map((answer) => (
                        <li key={answer.question_id}>Question {answer.question_id}: {answer.words} words</li>
                      ))}
                    </ul>
                  </Card>
                )}
              </section>

              {report.ai_assessments ? (
                <section aria-labelledby="ai-heading" className="space-y-5">
                  <div>
                    <h2 id="ai-heading" className="text-xl font-semibold text-foreground">
                      {report.provider === "demo" ? "Demo evaluation" : "AI judgments"}
                    </h2>
                    <p className="mt-1 text-sm text-warning">{report.guidance_note}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Generated by {report.provider ?? "an unreported provider"}
                      {report.model ? ` · ${report.model}` : ""}
                    </p>
                  </div>
                  <Card className="border-primary/20 bg-primary/[0.05] p-5 sm:p-6">
                    <p className="text-sm font-medium text-secondary">Score summary ·
                    {report.provider === "demo" ? "Demo heuristic" : "AI judgment"} · 0–5</p>
                    <p className="mt-2 text-4xl font-bold tabular-nums text-foreground">
                      {report.ai_assessments.overall_score.toFixed(2)} <span className="text-2xl text-secondary">/ 5</span>
                    </p>
                    <p className="mt-2 text-sm text-secondary">
                      {report.provider === "demo"
                        ? "Heuristic score from the simulated demo evaluation."
                        : "Weighted rubric score from the persisted assessment."}
                    </p>
                  </Card>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(report.ai_assessments.category_scores).map(([category, assessment]) => (
                      <article key={category} className="rounded-xl border border-border bg-background/5 p-4">
                        <h3 className="font-medium capitalize text-foreground">{category.replace(/_/g, " ")}</h3>
                        <p className="mt-1 text-sm text-primary">
                          {assessment.score} / 5 ·
                          {report.provider === "demo" ? "Demo heuristic" : "AI judgment"}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">{assessment.rationale}</p>
                      </article>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground">Per-question evidence</h3>
                    {report.ai_assessments.per_question_analysis.map((item, index) => (
                      <article key={item.question_id} className="space-y-3 rounded-xl border border-border bg-background/5 p-5">
                        <h4 className="font-medium text-foreground">{item.question}</h4>
                        <div className="rounded-lg border border-border bg-black/10 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Saved candidate answer</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">
                            {transcript.filter((entry) => entry.speaker === "candidate")[index]?.text ?? "No matching saved answer is available."}
                          </p>
                        </div>
                        <blockquote className="border-l-2 border-primary pl-3 text-sm text-primary">
                          “{item.evidence_quote}”
                        </blockquote>
                        <p className="text-sm text-muted-foreground">{item.rationale}</p>
                      </article>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="p-5">
                      <h3 className="font-semibold text-foreground">Strengths</h3>
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                        {report.ai_assessments.strengths.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </Card>
                    <Card className="p-5">
                      <h3 className="font-semibold text-foreground">Weaknesses and areas to work on</h3>
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                        {report.ai_assessments.missing_elements.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </Card>
                  </div>
                  <Card className="p-5">
                    <h3 className="font-semibold text-foreground">Improved-answer structure</h3>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                      {report.ai_assessments.improved_answer_structure.map((item) => <li key={item}>{item}</li>)}
                    </ol>
                  </Card>
                  <section aria-labelledby="coaching-heading" className="space-y-4">
                    <div>
                      <h3 id="coaching-heading" className="text-xl font-semibold text-foreground">
                        {report.provider === "demo" ? "Demo coaching plan" : "7-day coaching plan"}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Saved practice tasks are shown on their assigned days. Days without a persisted task are left intentionally blank.
                      </p>
                    </div>
                    {progressError && <p role="alert" className="text-sm text-warning">{progressError}</p>}
                    {coachingPlan ? (
                      <ol className="grid gap-3 md:grid-cols-2">
                        {Array.from({ length: 7 }, (_, index) => {
                          const dayNumber = index + 1;
                          const day = coachingPlan.days.find((item) => item.day === dayNumber);
                          return (
                            <li key={dayNumber}>
                              {day ? (
                                <Card className="flex h-full items-start gap-3 p-4">
                                  <input
                                    type="checkbox"
                                    aria-label={`Mark day ${dayNumber}: ${day.title} complete`}
                                    checked={checkedDays.has(dayNumber)}
                                    onChange={(event) => void updateDay(dayNumber, event.target.checked)}
                                    className="mt-1 h-4 w-4 accent-primary focus-visible:outline focus-visible:outline-2"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Day {dayNumber} · {day.duration}</p>
                                    <h4 className="mt-1 font-semibold text-foreground">{day.title}</h4>
                                    <p className="mt-2 text-sm leading-relaxed text-secondary">{day.description}</p>
                                  </div>
                                </Card>
                              ) : (
                                <Card className="h-full p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Day {dayNumber}</p>
                                  <p className="mt-2 text-sm text-muted-foreground">No practice task was returned for this day.</p>
                                </Card>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <Card role="status" className="p-4 text-sm text-muted-foreground">
                        No persisted coaching plan is available for this report.
                      </Card>
                    )}
                  </section>
                </section>
              ) : (
                <p role="status" className="text-muted-foreground">
                  {report.error || "Insufficient answer data is available for AI assessment. Measured values above remain separate."}
                </p>
              )}
            </>
          ) : null}

          <ButtonLink href={`/interview/complete/${interviewId}`} variant="secondary">
            Return to interview summary
          </ButtonLink>
        </section>
      </main>
    </AppShell>
  );
}
