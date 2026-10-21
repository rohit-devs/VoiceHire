"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { interviewService } from "@/lib/services";
import { Button, Card, Input, Textarea } from "@/components/ui/primitives";

export default function OnboardingPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [background, setBackground] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void interviewService.getProfile().then((profile) => {
      if (!active) return;
      setFirstName(profile.first_name ?? "");
      setLastName(profile.last_name ?? "");
      setTargetRole(profile.target_role ?? "");
      setBackground(profile.background ?? "");
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load your profile.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!targetRole.trim()) {
      setError("Enter a target role to continue.");
      return;
    }
    setSaving(true);
    try {
      await interviewService.updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        target_role: targetRole.trim(),
        background: background.trim(),
      });
      router.replace("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-10 text-white">
      <Card className="w-full max-w-xl p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Set up your interview profile</h1>
        <p className="mt-2 text-sm text-slate-300">This information helps tailor questions to your experience and target role.</p>
        {loading ? (
          <p role="status" className="mt-6 text-sm text-slate-300">Loading profile…</p>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span>First name</span>
                <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={100} />
              </label>
              <label className="space-y-2 text-sm">
                <span>Last name</span>
                <Input value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={100} />
              </label>
            </div>
            <label className="block space-y-2 text-sm">
              <span>Target role</span>
              <Input required value={targetRole} onChange={(event) => setTargetRole(event.target.value)} maxLength={100} />
            </label>
            <label className="block space-y-2 text-sm">
              <span>Professional background</span>
              <Textarea value={background} onChange={(event) => setBackground(event.target.value)} maxLength={20000} rows={5} />
            </label>
            {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
            <Button disabled={saving} className="w-full">
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
