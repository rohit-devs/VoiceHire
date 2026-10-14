"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useUserStore } from "@/stores/userStore";
import {
  User,
  Mic,
  Settings2,
  Bell,
  Palette,
  Shield,
  Save,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

type Tab = "profile" | "interview" | "voice" | "notifications" | "appearance" | "privacy" | "account";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "interview", label: "Interview Preferences", icon: MessageSquare },
  { id: "voice", label: "Voice Settings", icon: Mic },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "account", label: "Account", icon: Settings2 },
];

export default function SettingsPage() {
  const user = useUserStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="mx-auto max-w-5xl px-8 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your preferences and account settings</p>
          </div>

          <div className="flex gap-8">
            {/* Tabs */}
            <div className="w-64 flex-shrink-0">
              <nav className="space-y-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "bg-white/[0.08] text-foreground border border-white/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
              {activeTab === "profile" && (
                <div className="space-y-5">
                  <h2 className="text-base font-semibold text-white">Profile</h2>
                  <div className="flex items-center gap-4">
                    <img src={user.avatar} alt={user.name} className="h-16 w-16 rounded-full bg-slate-800" />
                    <button className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
                      Change Avatar
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Name</label>
                    <input
                      type="text"
                      defaultValue={user.name}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Email</label>
                    <input
                      type="email"
                      defaultValue={user.email}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    />
                  </div>
                </div>
              )}

              {activeTab === "interview" && (
                <div className="space-y-5">
                  <h2 className="text-base font-semibold text-white">Interview Preferences</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-4">
                      <div>
                        <p className="text-sm font-medium text-white">Default Persona</p>
                        <p className="text-xs text-muted-foreground mt-0.5">AI interviewer personality</p>
                      </div>
                      <select className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white focus:border-violet-500/50 focus:outline-none">
                        <option value="technical_lead">Deep Technical Lead</option>
                        <option value="friendly_founder">Friendly Startup Founder</option>
                        <option value="hr_recruiter">HR Recruiter</option>
                        <option value="stress_interviewer">Stress Interviewer</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-4">
                      <div>
                        <p className="text-sm font-medium text-white">Default Difficulty</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Question difficulty level</p>
                      </div>
                      <select className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white focus:border-violet-500/50 focus:outline-none">
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-4">
                      <div>
                        <p className="text-sm font-medium text-white">Pressure Mode</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Enable adaptive pressure by default</p>
                      </div>
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-white/10 transition-colors">
                        <span className="inline-block h-4 w-4 rounded-full bg-white translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "voice" && (
                <div className="space-y-5">
                  <h2 className="text-base font-semibold text-white">Voice Settings</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">AI Voice</label>
                      <select className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-violet-500/50 focus:outline-none">
                        <option value="alloy">Alloy (Neutral)</option>
                        <option value="echo">Echo (Male)</option>
                        <option value="fable">Fable (British)</option>
                        <option value="onyx">Onyx (Deep)</option>
                        <option value="nova">Nova (Female)</option>
                        <option value="shimmer">Shimmer (Warm)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Speaking Speed</label>
                      <input type="range" min="0.5" max="2" step="0.1" defaultValue="1" className="w-full accent-violet-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Volume</label>
                      <input type="range" min="0" max="1" step="0.1" defaultValue="0.8" className="w-full accent-violet-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Language</label>
                      <select className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-violet-500/50 focus:outline-none">
                        <option value="en-US">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="en-IN">English (India)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "notifications" && (
                <div className="space-y-5">
                  <h2 className="text-base font-semibold text-white">Notifications</h2>
                  <div className="space-y-3">
                    {["Email notifications", "Push notifications", "Weekly progress reports", "New feature announcements", "Coaching reminders"].map((item) => (
                      <div key={item} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-4">
                        <p className="text-sm text-slate-300">{item}</p>
                        <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-violet-600 transition-colors">
                          <span className="inline-block h-4 w-4 rounded-full bg-white translate-x-6 transition-transform" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "appearance" && (
                <div className="space-y-5">
                  <h2 className="text-base font-semibold text-white">Appearance</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-4">
                      <div>
                        <p className="text-sm font-medium text-white">Dark Mode</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Currently enabled</p>
                      </div>
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-violet-600 transition-colors">
                        <span className="inline-block h-4 w-4 rounded-full bg-white translate-x-6 transition-transform" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Accent Color</label>
                      <div className="flex gap-3">
                        {["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"].map((color) => (
                          <button key={color} className="h-10 w-10 rounded-lg border-2 border-white/20 hover:border-white/40 transition-colors" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "privacy" && (
                <div className="space-y-5">
                  <h2 className="text-base font-semibold text-white">Privacy</h2>
                  <div className="space-y-3">
                    {["Share performance data for improvement", "Allow interview recording", "Show profile in leaderboards"].map((item) => (
                      <div key={item} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-4">
                        <p className="text-sm text-slate-300">{item}</p>
                        <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-violet-600 transition-colors">
                          <span className="inline-block h-4 w-4 rounded-full bg-white translate-x-6 transition-transform" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "account" && (
                <div className="space-y-5">
                  <h2 className="text-base font-semibold text-white">Account</h2>
                  <div className="space-y-4">
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                      <p className="text-sm font-medium text-white mb-1">Current Plan</p>
                      <p className="text-xs text-muted-foreground">You are on the <span className="text-violet-400 capitalize">{user.plan}</span> plan</p>
                    </div>
                    <button className="w-full rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300 hover:bg-rose-500/20 transition-colors">
                      Delete Account
                    </button>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="mt-6 pt-5 border-t border-white/10 flex justify-end">
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
                >
                  {saved ? "Saved!" : <><Save className="h-4 w-4" /> Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
