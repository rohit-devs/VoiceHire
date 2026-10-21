"use client";

import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className={cn("min-h-screen pb-16 transition-all duration-300 sm:ml-[200px] sm:pb-0", className)}>
        {children}
      </main>
    </div>
  );
}
