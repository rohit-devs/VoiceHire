import { expect, test, type Page } from "@playwright/test";

const responsiveViewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

async function captureResponsiveScreenshots(page: Page, screen: string) {
  for (const viewport of responsiveViewports) {
    await page.setViewportSize(viewport);
    await expect.poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/ui-audit/${screen}-${viewport.width}.png`,
      fullPage: true,
    });
  }
}

async function enterLocalDemo(page: Page) {
  await page.goto("/sign-in");
  await captureResponsiveScreenshots(page, "sign-in");
  await page.getByRole("link", { name: "Continue as local demo user" }).click();
  await expect(page).toHaveURL(/onboarding/, { timeout: 30_000 });
  await captureResponsiveScreenshots(page, "onboarding");
  await page.getByLabel("Target role").fill("Backend Engineer");
  await page.getByLabel("Professional background").fill("Built asynchronous Python APIs and PostgreSQL services.");
  const profileUpdate = page.waitForResponse(
    (response) => response.url().endsWith("/api/users/me") && response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save profile" }).click();
  expect((await profileUpdate).status()).toBe(200);
  await expect(page).toHaveURL(/dashboard/, { timeout: 60_000 });
  await captureResponsiveScreenshots(page, "dashboard");
  await page.goto("/settings");
  await expect(page.getByLabel("Target role")).toHaveValue("Backend Engineer");
}

test("landing page explains the product and offers the demo interview", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /prepare to perform/i })).toBeVisible();
  const tryDemo = page.getByRole("link", { name: "Try demo interview" });
  await expect(tryDemo).toHaveAttribute("href", "/sign-in");
  await expect(tryDemo).toHaveCount(1);
  await captureResponsiveScreenshots(page, "landing");
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
  await captureResponsiveScreenshots(page, "sign-in-no-clerk");
});

test("local demo sign-in saves onboarding details", async ({ page }) => {
  test.setTimeout(120_000);
  await enterLocalDemo(page);
  await page.goto("/settings");
  await expect(page.getByLabel("Target role")).toHaveValue("Backend Engineer");
});

test("creates, completes, and reloads a clearly labeled simulated interview", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
  });
  await enterLocalDemo(page);
  const readinessResponse = await page.request.get("/api/health/ready");
  expect(readinessResponse.ok()).toBeTruthy();
  expect((await readinessResponse.json()).demo_mode).toBe(true);
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
  await expect(
    page.getByText(/Microphone needs HTTPS or localhost\. You can continue with typed answers/),
  ).toBeVisible();
  await captureResponsiveScreenshots(page, "interview-prepare");
  await page.getByRole("button", { name: "Enter Interview" }).click();
  await expect(page).toHaveURL(/\/interview\/live\//, { timeout: 60_000 });
  await expect(page.getByText("Simulated demo", { exact: true })).toBeVisible();

  await expect(
    page.getByText(
      "Microphone needs HTTPS or localhost. Continue by typing your answer below.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Voice unavailable/i })).toBeDisabled();
  const websocketConnected = page.waitForEvent("websocket");
  await page.getByRole("button", { name: "Start Interview" }).click();
  const websocket = await websocketConnected;
  expect(new URL(websocket.url()).host).toBe("127.0.0.1:3101");
  await expect(page.getByRole("textbox", { name: "Type your answer" })).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  await expect(page.getByText("Ready for your answer", { exact: true })).toBeVisible();
  await captureResponsiveScreenshots(page, "interview-live");
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
      `/api/interviews/sessions/${sessionId}/transcript`,
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
  await captureResponsiveScreenshots(page, "report-demo-no-evaluation");
  await page.goto("/coach");
  await expect(page.getByText(/completed evaluation/i)).toBeVisible();
});
