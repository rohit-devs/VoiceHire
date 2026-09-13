"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { FileText, ChevronRight } from "lucide-react";

export default function ReportsPage() {
  return (
    <AppShell>
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="mx-auto max-w-5xl px-8 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Reports</h1>
            <p className="text-muted-foreground mt-2">View your interview reports and analysis</p>
          </div>

          <div className="space-y-4">
            {[
              { id: "int-001", role: "Full Stack Developer", type: "Technical", score: 82, date: "Aug 8, 2026" },
              { id: "int-002", role: "Frontend Developer", type: "Technical", score: 68, date: "Aug 5, 2026" },
              { id: "int-003", role: "Product Manager", type: "Behavioral", score: 75, date: "Aug 2, 2026" },
            ].map((report) => (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 transition-all duration-200 hover:border-white/15 hover:bg-white/[0.05] group"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/20">
                    <FileText className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-white group-hover:text-violet-300 transition-colors">
                      {report.role}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{report.type} • {report.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xl font-bold text-emerald-400">{report.score}</p>
                    <p className="text-xs text-muted-foreground">/100</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
