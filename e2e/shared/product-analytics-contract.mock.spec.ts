import { expect, test, type Page, type Route } from "../fixtures/strictTest";
import { waitForCondition } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";

type AnalyticsBatch = {
  schema_version: number;
  events: Array<Record<string, unknown>>;
};

function isLocalBase(value: string): boolean {
  try {
    return ["127.0.0.1", "localhost"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
  })).toString("base64url");
  return `e30.${payload}.student`;
}

async function installApi(
  page: Page,
  enabled: boolean,
): Promise<AnalyticsBatch[]> {
  const batches: AnalyticsBatch[] = [];
  await page.addInitScript(({ token }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", "student-refresh");
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { token: fakeJwt() });

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith("/core/program/")) {
      return json({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        is_active: true,
        ui_config: {},
        feature_flags: {
          product_usage_analytics_enabled: enabled,
        },
      });
    }
    if (path.endsWith("/core/me/")) {
      return json({
        id: 11,
        username: "analytics-student",
        name: "분석 학생",
        is_staff: false,
        is_superuser: false,
        tenantRole: "student",
      });
    }
    if (path.endsWith("/student/me/")) {
      return json({ id: 11, name: "분석 학생", is_student: true });
    }
    if (path.endsWith("/student/exams/901/questions/")) {
      return json([{ id: 1001, number: 1, score: 5, answer_format: "text" }]);
    }
    if (path.endsWith("/student/exams/901/")) {
      return json({
        id: 901,
        title: "분석 수집 계약 검증",
        open_at: null,
        close_at: null,
        allow_retake: false,
        max_attempts: 1,
        pass_score: 60,
        max_score: 100,
        status: "open",
        has_result: false,
        attempt_count: 0,
      });
    }
    if (
      path.endsWith("/core/product-analytics/events/batch/")
      && request.method() === "POST"
    ) {
      batches.push(request.postDataJSON() as AnalyticsBatch);
      return json({ accepted: batches.at(-1)?.events.length ?? 0 }, 202);
    }
    return json({ count: 0, results: [], items: [] });
  });
  return batches;
}

test.describe("product usage analytics collection contract", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock contract spec.");
  test.use({ serviceWorkers: "block" });

  test("tenant flag OFF creates neither analytics events nor a session id", async ({ page }) => {
    const batches = await installApi(page, false);
    await page.goto(`${BASE}/student/exams/901/submit`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByLabel("1번 답", { exact: true })).toBeVisible();

    const flushWindowEnd = Date.now() + 5_500;
    await waitForCondition(
      async () => Date.now() >= flushWindowEnd,
      {
        timeoutMs: 6_000,
        intervalMs: 250,
        description: "analytics flush interval elapsed while tenant flag stayed OFF",
      },
    );
    expect(batches).toHaveLength(0);
    await expect.poll(() => page.evaluate(
      () => sessionStorage.getItem("product_analytics_session_id"),
    )).toBeNull();
  });

  test("tenant flag ON batches the canonical screen view without raw identity", async ({ page }) => {
    const batches = await installApi(page, true);
    await page.goto(`${BASE}/student/exams/901/submit`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByLabel("1번 답", { exact: true })).toBeVisible();
    await expect.poll(() => batches.length, { timeout: 8_000 }).toBeGreaterThan(0);

    const event = batches.flatMap((batch) => batch.events).find(
      (candidate) => candidate.event_type === "screen_view",
    );
    expect(event).toMatchObject({
      event_type: "screen_view",
      feature_id: "exams.manage",
      screen_id: "student.exams.workspace",
      surface: "student",
      route_template: "/student/exams/*",
      synthetic: false,
    });
    expect(event).not.toHaveProperty("user_id");
    expect(event).not.toHaveProperty("username");
    expect(event).not.toHaveProperty("tenant_id");
    expect(batches[0]).toMatchObject({ schema_version: 1 });
  });
});
