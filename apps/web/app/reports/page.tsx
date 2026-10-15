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
      setRows(reports.flatMap((report) => {
        const interview = byId.get(report.session_id);
        return interview && !interview.isDemo ? [{ report, interview }] : [];
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load saved reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <AppShell>
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Reports</h1>
            <p className="text-muted-foreground mt-2">View your interview reports and analysis</p>
          </div>

          {loading ? (
            <p role="status" className="animate-pulse rounded-xl bg-white/5 p-6 text-sm text-slate-300">Loading saved reports…</p>
          ) : error ? (
            <div><p role="alert" className="text-sm text-rose-300">{error}</p><button onClick={() => void load()} className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">Retry</button></div>
          ) : rows.length === 0 ? (
            <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">No real interview reports are saved yet. Simulated sessions are excluded.</p>
          ) : (
          <div className="space-y-4">
            {rows.map(({ report, interview }) => (
              <Link
                key={report.id}
                href={`/reports/${report.session_id}`}
                className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 transition-all duration-200 hover:border-white/15 hover:bg-white/[0.05] group"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/20">
                    <FileText className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-white group-hover:text-violet-300 transition-colors">
                      {interview.role}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {interview.interviewType.replace("_", " ")} · {report.status} · {report.created_at ? new Date(report.created_at).toLocaleDateString() : "date unavailable"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {report.ai_assessments ? <div className="text-right"><p className="text-xl font-bold text-emerald-300">{report.ai_assessments.overall_score.toFixed(2)}</p><p className="text-xs text-muted-foreground">AI judgment / 5</p></div> : <p className="text-xs text-muted-foreground">No score saved</p>}
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
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
