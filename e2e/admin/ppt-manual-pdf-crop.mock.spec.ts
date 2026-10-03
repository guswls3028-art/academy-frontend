import path from "node:path";
import { expect, test, type Page, type Route } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const pdf = path.resolve("e2e/fixtures/test-invert-3p.pdf");
const adminReadFixtures: Record<string, unknown> = {
  "/api/v1/staffs/me/": { is_authenticated: true, is_staff: true, is_superuser: true, is_payroll_manager: false },
  "/api/v1/staffs/currently-working/": [],
  "/api/v1/clinic/participants/": { count: 0, next: null, previous: null, results: [] },
  "/api/v1/community/admin/posts/": { count: 0, next: null, previous: null, results: [] },
  "/api/v1/students/registration_requests/": { count: 0, next: null, previous: null, results: [] },
  "/api/v1/submissions/submissions/pending/": [],
  "/api/v1/results/admin/teacher-dashboard-counts/": { video_failed: 0 },
  "/api/v1/community/admin/reports/pending-count/": { count: 0 },
  "/api/v1/community/notifications/unread-count/": { count: 0 },
  "/api/v1/lectures/attendance/arrival-overview/": {
    generated_at: "2026-10-03T00:00:00Z", today: "2026-10-03", tomorrow: "2026-10-04",
    range_end: "2026-10-10", range_days: 7, soon_window_minutes: 60,
    summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 }, items: [],
  },
};

function jwt(lifetimeSeconds = 3600) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp: Math.floor(Date.now() / 1000) + lifetimeSeconds, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
}

async function setup(page: Page, holdSubmission = false) {
  const captured: Array<{ names: string[]; mode: string; order: number[]; dimensions: Array<[number, number]>; aspectRatio: string }> = [];
  let releaseSubmission: () => void = () => undefined;
  const submissionGate = holdSubmission ? new Promise<void>((resolve) => { releaseSubmission = resolve; }) : Promise.resolve();
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, jwt());
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && adminReadFixtures[url.pathname] !== undefined) {
      await route.fulfill({ json: adminReadFixtures[url.pathname] });
      return;
    }
    if (url.pathname === "/api/v1/tools/omr/preview/" && request.method() === "POST") {
      await route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body>OMR preview</body></html>" });
      return;
    }
    if (url.pathname === "/api/v1/tools/ppt/generate/" && request.method() === "POST") {
      const buffer = request.postDataBuffer() ?? Buffer.alloc(0);
      const body = buffer.toString("latin1");
      const order = body.match(/name="order"\r\n\r\n([^\r]+)/)?.[1] ?? "[]";
      const dimensions: Array<[number, number]> = [];
      const signature = Buffer.from("89504e470d0a1a0a", "hex");
      for (let offset = buffer.indexOf(signature); offset >= 0; offset = buffer.indexOf(signature, offset + signature.length)) {
        dimensions.push([buffer.readUInt32BE(offset + 16), buffer.readUInt32BE(offset + 20)]);
      }
      captured.push({
        names: Array.from(body.matchAll(/name="images"; filename="([^"]+)"/g), (match) => match[1]),
        mode: body.includes('name="pdf"') ? "pdf" : "images",
        order: JSON.parse(order) as number[],
        dimensions,
        aspectRatio: JSON.parse(body.match(/name="settings"\r\n\r\n([^\r]+)/)?.[1] ?? "{}").aspect_ratio,
      });
      await submissionGate;
      await route.fulfill({ json: { job_id: "manual-ppt-job", status: "PENDING" } });
      return;
    }
    if (["/api/v1/jobs/manual-ppt-job/progress/", "/api/v1/jobs/manual-ppt-job/"].includes(url.pathname)) {
      await route.fulfill({ json: {
        job_id: "manual-ppt-job", job_type: "ppt_generation", status: "DONE",
        result: { download_url: "data:application/octet-stream;base64,UEs=", filename: "manual.pptx", slide_count: 2, size_bytes: 2 },
      } });
      return;
    }
    await route.fallback();
  });
  await page.goto(`${getBaseUrl("admin")}/workspace/tools/ppt`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await page.locator('input[type="file"][accept="application/pdf"]').setInputFiles(pdf);
  await page.getByRole("button", { name: "직접 자르기" }).click();
  await expect(page.getByText("1 / 3쪽")).toBeVisible();
  return { captured, releaseSubmission };
}

async function selectRegions(page: Page) {
  const layer = page.getByTestId("ppt-pdf-selection-layer");
  const box = await layer.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.1, box!.y + box!.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height * 0.6);
  await page.mouse.up();
  await expect(page.getByTestId("ppt-crop-region")).toHaveCount(1);
  expect(Number(await page.getByTestId("ppt-crop-region").first().getByLabel("너비 (%)").inputValue())).toBeLessThan(100);
  await page.getByRole("button", { name: "다음 쪽" }).click();
  await expect(page.getByText("2 / 3쪽")).toBeVisible();
  await page.getByRole("button", { name: "현재 쪽 전체 추가" }).click();
  await page.getByRole("button", { name: "2번 슬라이드 앞으로" }).click();
  await expect(page.getByText("1. 2쪽")).toBeVisible();
}

for (const width of [1366, 390]) {
  test(`PDF 수동 영역을 순서대로 PPT로 제출한다 (${width}px)`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 850 });
    const { captured } = await setup(page);
    await selectRegions(page);
    await page.getByRole("button", { name: "PPT 생성 및 다운로드" }).click();
    await expect.poll(() => captured).toHaveLength(1);
    expect(captured[0]).toEqual(expect.objectContaining({
      names: ["slide-001-page-2.png", "slide-002-page-1.png"],
      mode: "images",
      order: [0, 1],
    }));
    expect(captured[0].dimensions).toHaveLength(2);
    expect(captured[0].dimensions[1][0]).toBeLessThan(captured[0].dimensions[0][0]);
    expect(captured[0].dimensions[1][1]).toBeLessThan(captured[0].dimensions[0][1]);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}

async function assertDraft(page: Page) {
  await expect(page.getByRole("button", { name: "PDF", exact: true })).toHaveAttribute("data-active", "true");
  await expect(page.getByText("test-invert-3p.pdf")).toBeVisible();
  await expect(page.getByRole("button", { name: "직접 자르기" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("ppt-crop-region")).toHaveCount(2);
  await expect(page.getByText("1. 2쪽")).toBeVisible();
  await expect(page.getByText("2. 1쪽")).toBeVisible();
  await expect(page.getByRole("button", { name: "4:3 표준" })).toHaveClass(/optionButtonSelected/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
}

test("PDF 작업과 설정은 데스크톱·모바일 전환 후에도 유지된다", async ({ page }) => {
  test.setTimeout(90_000);
  const { captured } = await setup(page);
  await selectRegions(page);
  await page.getByRole("button", { name: "4:3 표준" }).click();
  for (const width of [1024, 390, 1366]) {
    await page.setViewportSize({ width, height: 850 });
    await assertDraft(page);
  }
  await page.getByRole("button", { name: "PPT 생성 및 다운로드" }).click();
  await expect.poll(() => captured.length).toBe(1);
  expect(captured[0]).toMatchObject({ names: ["slide-001-page-2.png", "slide-002-page-1.png"], mode: "images", order: [0, 1], aspectRatio: "4:3" });
});

test("생성 중 화면을 전환해도 중복 제출 없이 완료 작업을 복구한다", async ({ page }) => {
  test.setTimeout(90_000);
  const { captured, releaseSubmission } = await setup(page, true);
  await selectRegions(page);
  await page.getByRole("button", { name: "4:3 표준" }).click();
  try {
    await page.getByRole("button", { name: "PPT 생성 및 다운로드" }).click();
    await expect.poll(() => captured.length).toBe(1);
    for (const width of [390, 1366]) {
      await page.setViewportSize({ width, height: 850 });
      await assertDraft(page);
      await expect(page.locator('button[class*="generateButton"]')).toBeDisabled();
    }
    expect(captured).toHaveLength(1);
  } finally { releaseSubmission(); }
  await expect(page.getByRole("button", { name: "PPT 생성 및 다운로드" })).toBeEnabled({ timeout: 30_000 });
  expect(captured).toHaveLength(1);
  await expect(page.getByRole("region", { name: "이전 PPT 작업" })
    .getByRole("button", { name: "완료된 PPT 다운로드 (2장)" })).toBeVisible({ timeout: 30_000 });
});

test("PPT 화면을 떠나면 파일과 선택 영역을 정리한다", async ({ page }) => {
  const { captured } = await setup(page);
  await selectRegions(page);
  await page.getByRole("tab", { name: "OMR 생성" }).click();
  await expect(page).toHaveURL(/\/workspace\/tools\/omr/);
  await expect(page.getByRole("tab", { name: "OMR 생성" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "OMR 답안지 설정" })).toBeVisible();
  await page.getByRole("tab", { name: "PPT 생성" }).click();
  await expect(page).toHaveURL(/\/workspace\/tools\/ppt/);
  await expect(page.getByRole("tab", { name: "PPT 생성" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "이미지", exact: true })).toHaveAttribute("data-active", "true");
  await expect(page.getByText("test-invert-3p.pdf", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("ppt-crop-region")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "PPT 생성 및 다운로드" })).toBeDisabled();
  expect(captured).toHaveLength(0);
});

test("인증 갱신 중 학원이 바뀌면 원래 PDF를 새 학원에 제출하지 않는다", async ({ page }) => {
  test.setTimeout(90_000);
  const { captured } = await setup(page);
  await selectRegions(page);
  let refreshStarted = false;
  let releaseRefresh: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { releaseRefresh = resolve; });
  await page.route("**/api/v1/token/refresh/", async (route) => {
    if (route.request().method() !== "POST") { await route.fallback(); return; }
    refreshStarted = true;
    await gate;
    await route.fulfill({ json: { access: jwt(), refresh: `${jwt()}-refresh` } });
  });
  await page.evaluate((access) => {
    const generation = localStorage.getItem("academy:auth-active-generation:v1");
    if (!generation) throw new Error("Expected an active authentication envelope");
    const key = `academy:auth-tokens:v1:${generation}`;
    const envelope = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key, JSON.stringify({ ...envelope, access }));
  }, jwt(-60));
  try {
    await page.getByRole("button", { name: "PPT 생성 및 다운로드" }).click();
    await expect.poll(() => refreshStarted).toBe(true);
    await expect(page.locator('button[class*="generateButton"]')).toBeDisabled();
    await page.evaluate(() => sessionStorage.setItem("tenantCode", "another-qa-tenant"));
  } finally { releaseRefresh(); }
  await expect(page.getByRole("button", { name: "PPT 생성 및 다운로드" })).toBeEnabled({ timeout: 30_000 });
  expect(captured).toHaveLength(0);
  await page.getByRole("button", { name: "PPT 생성 및 다운로드" }).click();
  await expect(page.getByText("계정이나 학원이 변경되었습니다. 파일을 다시 선택해주세요.")).toBeVisible();
  expect(captured).toHaveLength(0);
});

test("이전 학원의 늦은 접수 응답은 새 학원의 복구 기록을 덮지 않는다", async ({ page }) => {
  test.setTimeout(90_000);
  const { captured, releaseSubmission } = await setup(page, true);
  await selectRegions(page);
  const jobRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/jobs/manual-ppt-job/")) jobRequests.push(request.url());
  });
  const saved = JSON.stringify([{ jobId: "other-tenant-job", tenantScope: "another-qa-tenant", userId: "12", label: "Existing PPT", createdAt: Date.now() }]);
  try {
    await page.getByRole("button", { name: "PPT 생성 및 다운로드" }).click();
    await expect.poll(() => captured.length).toBe(1);
    await page.evaluate((value) => {
      sessionStorage.setItem("tenantCode", "another-qa-tenant");
      localStorage.setItem("hakwonplus:ppt-job-recovery:v1", value);
    }, saved);
  } finally { releaseSubmission(); }
  await expect(page.getByRole("button", { name: "PPT 생성 및 다운로드" })).toBeEnabled({ timeout: 30_000 });
  expect(await page.evaluate(() => localStorage.getItem("hakwonplus:ppt-job-recovery:v1"))).toBe(saved);
  expect(jobRequests).toHaveLength(0);
  expect(captured).toHaveLength(1);
});
