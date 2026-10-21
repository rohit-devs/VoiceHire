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

const inputClass =
  "w-full rounded-lg border border-neutral-700 bg-[#141414] px-3 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8321e]";

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

  useEffect(() => {
    void load();
  }, [load]);

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
      <main className="min-h-screen bg-[#0a0a0a] px-4 py-8 text-neutral-200 sm:px-8 sm:py-10">
        <section className="mx-auto max-w-3xl">
          <header className="mb-8">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Settings</h1>
            <p className="mt-1.5 text-sm text-neutral-400">
              Manage profile and interview defaults saved to your account.
            </p>
          </header>

          {loading ? (
            <div
              role="status"
              className="h-80 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/50"
              aria-label="Loading settings"
            />
          ) : error && !profile ? (
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
          ) : (
            <form
              onSubmit={(event) => void save(event)}
              className="space-y-6 rounded-xl border border-neutral-800 bg-[#0d0d0d] p-5 sm:p-7"
            >
              <section className="space-y-4" aria-labelledby="profile-heading">
                <h2 id="profile-heading" className="text-lg font-semibold text-white">
                  Profile
                </h2>
                <p className="text-sm text-neutral-400">Account email: {profile?.email}</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="text-neutral-300">First name</span>
                    <input
                      value={values.first_name ?? ""}
                      onChange={(e) => setValues({ ...values, first_name: e.target.value })}
                      maxLength={100}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-neutral-300">Last name</span>
                    <input
                      value={values.last_name ?? ""}
                      onChange={(e) => setValues({ ...values, last_name: e.target.value })}
                      maxLength={100}
                      className={inputClass}
                    />
                  </label>
                </div>

                <label className="block space-y-2 text-sm">
                  <span className="text-neutral-300">Target role</span>
                  <input
                    value={values.target_role ?? ""}
                    onChange={(e) => setValues({ ...values, target_role: e.target.value })}
                    maxLength={100}
                    className={inputClass}
                  />
                </label>

                <label className="block space-y-2 text-sm">
                  <span className="text-neutral-300">Professional background</span>
                  <textarea
                    value={values.background ?? ""}
                    onChange={(e) => setValues({ ...values, background: e.target.value })}
                    maxLength={20000}
                    rows={5}
                    className={inputClass}
                  />
                </label>
              </section>

              <section
                className="space-y-4 border-t border-neutral-800 pt-5"
                aria-labelledby="preferences-heading"
              >
                <h2 id="preferences-heading" className="text-lg font-semibold text-white">
                  Default interview preferences
                </h2>

                <label className="block space-y-2 text-sm">
                  <span className="text-neutral-300">Interviewer style</span>
                  <select
                    value={values.default_interview_persona}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        default_interview_persona: e.target.value as UserProfile["default_interview_persona"],
                      })
                    }
                    className={inputClass}
                  >
                    <option value="technical_lead">Technical lead</option>
                    <option value="friendly_founder">Friendly founder</option>
                    <option value="hr_recruiter">HR recruiter</option>
                    <option value="stress_interviewer">Challenging interviewer</option>
                  </select>
                </label>

                <label className="block space-y-2 text-sm">
                  <span className="text-neutral-300">Default difficulty</span>
                  <select
                    value={values.default_interview_difficulty}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        default_interview_difficulty: e.target
                          .value as UserProfile["default_interview_difficulty"],
                      })
                    }
                    className={inputClass}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              </section>

              {error && (
                <p role="alert" className="text-sm text-rose-300">
                  {error}
                </p>
              )}
              {saved && (
                <p role="status" className="text-sm text-emerald-400">
                  Settings saved.
                </p>
              )}

              <div className="flex justify-end border-t border-neutral-800 pt-5">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#e8321e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ff3b2d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8321e] disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save settings"}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </AppShell>
  );
}