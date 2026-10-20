"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { interviewService } from "@/lib/services";
import type { EvaluationReport } from "@/lib/services/interviewService";
import type { InterviewConfig } from "@/types";
import { FileText, ChevronRight } from "lucide-react";

type ReportRow = { report: EvaluationReport; interview: InterviewConfig };

export default function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reports, interviews] = await Promise.all([
        interviewService.getUserReports(),
        interviewService.getHistory(),
      ]);
      const byId = new Map(interviews.map((interview) => [interview.id, interview]));
      setRows(
        reports.flatMap((report) => {
          const interview = byId.get(report.session_id);
          return interview && !interview.isDemo ? [{ report, interview }] : [];
        })
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load saved reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
          <header className="mb-8">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Reports</h1>
            <p className="mt-1.5 text-sm text-neutral-400">
              View your interview reports and analysis
            </p>
          </header>

          {loading ? (
            <p
              role="status"
              className="animate-pulse rounded-xl border border-neutral-800 bg-[#0d0d0d] p-6 text-sm text-neutral-400"
            >
              Loading saved reports…
            </p>
          ) : error ? (
            <div className="rounded-xl border border-neutral-800 bg-[#0d0d0d] p-6">
              <p role="alert" className="text-sm text-rose-300">
                {error}
              </p>
              <button
                onClick={() => void load()}
                className="mt-4 rounded-lg bg-[#e8321e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ff3b2d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8321e]"
              >
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <p
              role="status"
              className="rounded-xl border border-neutral-800 bg-[#0d0d0d] p-6 text-sm text-neutral-400"
            >
              No real interview reports are saved yet. Simulated sessions are excluded.
            </p>
          ) : (
            <div className="space-y-3">
              {rows.map(({ report, interview }) => (
                <Link
                  key={report.id}
                  href={`/reports/${report.session_id}`}
                  className="group flex items-center justify-between rounded-xl border border-neutral-800 bg-[#0d0d0d] p-5 transition hover:border-[#e8321e]/50 hover:bg-[#111] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8321e]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#e8321e]/20 bg-[#e8321e]/10">
                      <FileText className="h-5 w-5 text-[#e8321e]" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-white transition group-hover:text-[#e8321e]">
                        {interview.role}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {interview.interviewType.replace("_", " ")} · {report.status} ·{" "}
                        {report.created_at
                          ? new Date(report.created_at).toLocaleDateString()
                          : "date unavailable"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {report.ai_assessments ? (
                      <div className="text-right">
                        <p className="text-xl font-bold text-[#e8321e]">
                          {report.ai_assessments.overall_score.toFixed(2)}
                        </p>
                        <p className="text-xs text-neutral-500">AI judgment / 5</p>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500">No score saved</p>
                    )}
                    <ChevronRight className="h-5 w-5 text-neutral-600 transition group-hover:text-[#e8321e]" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}