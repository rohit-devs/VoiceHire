"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { interviewService } from "@/lib/services";
import type { UserProfile } from "@/lib/services/interviewService";

const EMPTY_PROFILE: Omit<UserProfile, "id" | "email"> = {
  first_name: null,
  last_name: null,
  target_role: null,
  background: null,
  default_interview_persona: "technical_lead",
  default_interview_difficulty: "medium",
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [values, setValues] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await interviewService.getProfile();
      setProfile(result);
      setValues({
        first_name: result.first_name,
        last_name: result.last_name,
        target_role: result.target_role,
        background: result.background,
        default_interview_persona: result.default_interview_persona,
        default_interview_difficulty: result.default_interview_difficulty,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const updated = await interviewService.updateProfile(values);
      setProfile(updated);
      setValues({
        first_name: updated.first_name,
        last_name: updated.last_name,
        target_role: updated.target_role,
        background: updated.background,
        default_interview_persona: updated.default_interview_persona,
        default_interview_difficulty: updated.default_interview_difficulty,
      });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-[#0a0a0f] px-4 py-8 text-white sm:px-8 sm:py-10">
        <section className="mx-auto max-w-3xl">
          <header className="mb-7">
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="mt-1 text-sm text-slate-300">Manage profile and interview defaults saved to your account.</p>
          </header>
          {loading ? (
            <div role="status" className="h-80 animate-pulse rounded-xl bg-white/5" aria-label="Loading settings" />
          ) : error && !profile ? (
            <div><p role="alert" className="text-sm text-rose-300">{error}</p><button onClick={() => void load()} className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">Retry</button></div>
          ) : (
            <form onSubmit={(event) => void save(event)} className="space-y-6 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
              <section className="space-y-4" aria-labelledby="profile-heading">
                <h2 id="profile-heading" className="text-lg font-semibold">Profile</h2>
                <p className="text-sm text-slate-300">Account email: {profile?.email}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span>First name</span>
                    <input value={values.first_name ?? ""} onChange={(event) => setValues({ ...values, first_name: event.target.value })} maxLength={100} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300" />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span>Last name</span>
                    <input value={values.last_name ?? ""} onChange={(event) => setValues({ ...values, last_name: event.target.value })} maxLength={100} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300" />
                  </label>
                </div>
                <label className="block space-y-2 text-sm">
                  <span>Target role</span>
                  <input value={values.target_role ?? ""} onChange={(event) => setValues({ ...values, target_role: event.target.value })} maxLength={100} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300" />
                </label>
                <label className="block space-y-2 text-sm">
                  <span>Professional background</span>
                  <textarea value={values.background ?? ""} onChange={(event) => setValues({ ...values, background: event.target.value })} maxLength={20000} rows={5} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300" />
                </label>
              </section>
              <section className="space-y-4 border-t border-white/10 pt-5" aria-labelledby="preferences-heading">
                <h2 id="preferences-heading" className="text-lg font-semibold">Default interview preferences</h2>
                <label className="block space-y-2 text-sm">
                  <span>Interviewer style</span>
                  <select value={values.default_interview_persona} onChange={(event) => setValues({ ...values, default_interview_persona: event.target.value as UserProfile["default_interview_persona"] })} className="w-full rounded-lg border border-white/15 bg-[#14141d] px-3 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300">
                    <option value="technical_lead">Technical lead</option>
                    <option value="friendly_founder">Friendly founder</option>
                    <option value="hr_recruiter">HR recruiter</option>
                    <option value="stress_interviewer">Challenging interviewer</option>
                  </select>
                </label>
                <label className="block space-y-2 text-sm">
                  <span>Default difficulty</span>
                  <select value={values.default_interview_difficulty} onChange={(event) => setValues({ ...values, default_interview_difficulty: event.target.value as UserProfile["default_interview_difficulty"] })} className="w-full rounded-lg border border-white/15 bg-[#14141d] px-3 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              </section>
              {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
              {saved && <p role="status" className="text-sm text-emerald-300">Settings saved.</p>}
              <div className="flex justify-end border-t border-white/10 pt-5">
                <button disabled={saving} className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:opacity-60">{saving ? "Saving…" : "Save settings"}</button>
              </div>
            </form>
          )}
        </section>
      </main>
    </AppShell>
  );
}
