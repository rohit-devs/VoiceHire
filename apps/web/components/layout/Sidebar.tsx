"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { interviewService } from "@/lib/services";
import {
  LayoutDashboard,
  Mic,
  History,
  BarChart3,
  Sparkles,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/interview/new", label: "New Interview", icon: Mic },
  { href: "/interviews", label: "Interviews", icon: History },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/coach", label: "AI Coach", icon: Sparkles },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [profile, setProfile] = useState<{ name: string; email: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    void interviewService.getProfile().then((data) => {
      if (active) {
        setProfile({
          name: [data.first_name, data.last_name].filter(Boolean).join(" ") || "Complete your profile",
          email: data.email,
        });
      }
    }).catch(() => {
      if (active) setProfile(null);
    });
    return () => { active = false; };
  }, []);

  return (
    <>
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 hidden h-screen border-r border-white/[0.08] bg-[#0a0a0f] transition-all duration-300 sm:block",
        collapsed ? "w-[72px]" : "w-[200px]"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-white/[0.08]">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center flex-shrink-0">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 opacity-80 blur-sm" />
              <div className="relative rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 p-1.5">
                <Mic className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <span className="text-sm font-bold tracking-tight text-white block">VoiceHire</span>
                <span className="text-[10px] text-muted-foreground block leading-tight">AI Interviewer & Communication Coach</span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-200",
                  isActive
                    ? "bg-white/[0.06] text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
                )}
              >
                <item.icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-violet-400" : "")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Profile Card */}
        <div className="p-3 border-t border-white/[0.08]">
          <div className={cn("flex items-center gap-2.5 rounded-lg p-2 bg-white/[0.02] border border-white/[0.06]", collapsed && "justify-center")}>
            <div className="relative flex-shrink-0">
              <div aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20 text-xs font-semibold text-violet-100">
                {profile?.name?.slice(0, 1).toUpperCase() ?? "?"}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-gradient-to-r from-violet-500 to-blue-600 p-[1.5px]">
                <div className="h-2 w-2 rounded-full bg-[#0a0a0f]" />
              </div>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate">{profile?.name ?? "Profile unavailable"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{profile?.email ?? "Account data unavailable"}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
    <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-white/10 bg-[#0a0a0f] px-1 py-2 sm:hidden">
      {navItems.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={cn("flex min-w-0 flex-col items-center gap-1 rounded px-2 py-1 text-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300", active ? "text-violet-200" : "text-slate-300")}
          >
            <item.icon aria-hidden="true" className="h-4 w-4" />
            <span className="max-w-14 truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
    </>
  );
}
