import { expect, test, type Page } from "@playwright/test";

const apiUrl = "http://127.0.0.1:8100";

async function enterLocalDemo(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Continue as local demo user" }).click();
  await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel("Target role").fill("Backend Engineer");
  await page.getByLabel("Professional background").fill("Built asynchronous Python APIs and PostgreSQL services.");
  const profileUpdate = page.waitForResponse(
    (response) => response.url().endsWith("/api/users/me") && response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save profile" }).click();
  expect((await profileUpdate).status()).toBe(200);
  await page.goto("/settings");
  await expect(page.getByLabel("Target role")).toHaveValue("Backend Engineer");
}

test("landing page explains the product and links to account creation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /prepare to perform/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /create an account/i })).toHaveAttribute("href", "/sign-up");
});

test("local demo sign-in saves onboarding details", async ({ page }) => {
  await enterLocalDemo(page);
  await page.goto("/settings");
  await expect(page.getByLabel("Target role")).toHaveValue("Backend Engineer");
});

test("creates, completes, and reloads a clearly labeled simulated interview", async ({ page }) => {
  await enterLocalDemo(page);
  await page.goto("/interview/new");

  await page.getByLabel("Job Role").fill("Backend Engineer");
  await page.getByLabel("Experience Level").selectOption("Mid (3-5 years)");
  await page.getByRole("button", { name: /technical.*coding.*architecture/i }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Resume text").fill("Built Python APIs with PostgreSQL and asynchronous workers.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Paste Job Description").fill("Build and operate reliable Python services.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /technical lead/i }).click();
  await page.getByRole("checkbox", { name: "Simulated demo" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start Interview" }).click();
  await page.getByRole("button", { name: "Enter Interview" }).click();
  await expect(page.getByText("Simulated demo", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Voice mode: On" }).click();
  await page.getByRole("button", { name: "Start Interview" }).click();
  await page.getByPlaceholder("Type your answer").fill(
    "I reduced database latency by adding a PostgreSQL index and measured the improvement in production.",
  );
  await page.getByRole("button", { name: "Submit Answer" }).click();
  await expect(page.getByText(/I reduced database latency/)).toBeVisible();

  const sessionId = new URL(page.url()).pathname.split("/").pop();
  expect(sessionId).toBeTruthy();
  const transcriptResponse = await page.request.get(
    `${apiUrl}/api/interviews/sessions/${sessionId}/transcript`,
  );
  expect(transcriptResponse.ok()).toBeTruthy();
  const transcript = await transcriptResponse.json();
  expect(transcript.some((entry: { text: string }) =>
    entry.text.includes("I reduced database latency"),
  )).toBeTruthy();

  await page.reload();
  await expect(page.getByText("Simulated demo", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "End Interview" }).click();
  await expect(page.getByText(/real evaluations are not generated from simulated sessions/i)).toBeVisible();

  await page.goto(`/reports/${sessionId}`);
  await expect(page.getByText(/simulated demo sessions do not have real evaluations/i)).toBeVisible();
  await page.goto("/coach");
  await expect(page.getByText(/completed evaluation/i)).toBeVisible();
});
