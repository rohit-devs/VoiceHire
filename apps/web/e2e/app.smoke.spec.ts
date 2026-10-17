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
  await expect(page).toHaveURL(/dashboard/, { timeout: 60_000 });
  await page.goto("/settings");
  await expect(page.getByLabel("Target role")).toHaveValue("Backend Engineer");
}

test("landing page explains the product and links to account creation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /prepare to perform/i })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create an account" }).first(),
  ).toHaveAttribute("href", "/sign-up");
});

test("sign-in without Clerk environment variables has no runtime errors", async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });

  await page.goto("/sign-in");

  await expect(
    page.getByRole("heading", { name: "Sign in to VoiceHire" }),
  ).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("local demo sign-in saves onboarding details", async ({ page }) => {
  test.setTimeout(120_000);
  await enterLocalDemo(page);
  await page.goto("/settings");
  await expect(page.getByLabel("Target role")).toHaveValue("Backend Engineer");
});

test("creates, completes, and reloads a clearly labeled simulated interview", async ({ page }) => {
  test.setTimeout(120_000);
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
  const createSessionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/interviews/sessions") &&
      response.request().method() === "POST",
  );
  const startSessionResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/interviews/sessions/") &&
      response.url().endsWith("/start") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Start Interview" }).click();
  expect((await createSessionResponse).ok()).toBeTruthy();
  expect((await startSessionResponse).ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/interview\/prepare\//, { timeout: 60_000 });
  await page.getByRole("button", { name: "Enter Interview" }).click();
  await expect(page).toHaveURL(/\/interview\/live\//, { timeout: 60_000 });
  await expect(page.getByText("Simulated demo", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Voice mode: On" }).click();
  await page.getByRole("button", { name: "Start Interview" }).click();
  await page.getByPlaceholder("Type your answer").fill(
    "I reduced database latency by adding a PostgreSQL index and measured the improvement in production.",
  );
  const nextQuestionResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/generate-question") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Submit Answer" }).click();
  await expect(page.getByText(/I reduced database latency/)).toBeVisible();
  expect((await nextQuestionResponse).ok()).toBeTruthy();

  const sessionId = new URL(page.url()).pathname.split("/").pop();
  expect(sessionId).toBeTruthy();
  await expect.poll(async () => {
    const transcriptResponse = await page.request.get(
      `${apiUrl}/api/interviews/sessions/${sessionId}/transcript`,
    );
    if (!transcriptResponse.ok()) return false;
    const transcript = await transcriptResponse.json();
    return transcript.some((entry: { text: string }) =>
      entry.text.includes("I reduced database latency"),
    );
  }).toBeTruthy();

  await page.reload();
  await expect(page.getByText("Simulated demo", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  const endSessionResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/interviews/sessions/${sessionId}/end`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "End Interview" }).click();
  expect((await endSessionResponse).ok()).toBeTruthy();
  await expect(page).toHaveURL(
    new RegExp(`/interview/complete/${sessionId}$`),
    { timeout: 60_000 },
  );
  await expect(page.getByText(/real evaluations are not generated from simulated sessions/i)).toBeVisible();

  await page.goto(`/reports/${sessionId}`);
  await expect(page.getByText(/simulated demo sessions do not have real evaluations/i)).toBeVisible();
  await page.goto("/coach");
  await expect(page.getByText(/completed evaluation/i)).toBeVisible();
});
