import { redirect } from "next/navigation";

export const metadata = {
  title: "VoiceHire — AI Interviewer & Communication Coach",
  description:
    "Practice role-specific interviews, review evidence-backed AI guidance, and track verified metrics.",
};

export default function HomePage() {
  redirect("/dashboard");
}
