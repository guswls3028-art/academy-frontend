import path from "node:path";
import { expect, test, type Page, type Route } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const pdf = path.resolve("e2e/fixtures/test-invert-3p.pdf");
const storageKey = "hakwonplus:ppt-job-recovery:v1";

function jwt() {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
}

async function setup(page: Page, jobId: string, missingAfterReload = false) {
  let postCount = 0;
  let statusGetCount = 0;
  let submittedMode = "";
  let reloaded = false;
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, jwt());
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/v1/tools/ppt/generate/" && request.method() === "POST") {
      postCount += 1;
      submittedMode = request.postDataBuffer()?.toString("latin1").includes('name="pdf"') ? "pdf" : "images";
      await route.fulfill({ json: { job_id: jobId, status: "PENDING" } });
      return;
    }
    if (pathname === `/api/v1/jobs/${jobId}/progress/`) {
      await route.fulfill({ json: { job_id: jobId, job_type: "ppt_generation", status: "PENDING" } });
      return;
    }
    if (pathname === `/api/v1/jobs/${jobId}/`) {
      statusGetCount += 1;
      if (reloaded && missingAfterReload) {
        await route.fulfill({ json: { status: "UNKNOWN" } });
        return;
      }
      await route.fulfill({ json: {
        job_id: jobId, job_type: "ppt_generation", status: reloaded ? "DONE" : "PENDING",
        result: reloaded ? {
          download_url: "data:application/octet-stream;base64,UEs=",
          filename: "recovered.pptx", slide_count: 2, size_bytes: 2,
        } : null,
      } });
      return;
    }
    await route.fallback();
  });
  await page.goto(`${getBaseUrl("admin")}/workspace/tools/ppt`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await page.locator('input[type="file"][accept="application/pdf"]').setInputFiles(pdf);
  return {
    get postCount() { return postCount; },
    get statusGetCount() { return statusGetCount; },
    get submittedMode() { return submittedMode; },
    markReloaded() { reloaded = true; },
  };
}

test("없는 PPT 작업은 새로고침 후 결과를 숨긴다", async ({ page }) => {
  const jobId = "ppt-denied-recover";
  const state = await setup(page, jobId, true);
  await page.getByRole("button", { name: "PPT 생성 및 다운로드" }).click();
  await expect.poll(() => state.postCount).toBe(1);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey)).not.toBeNull();
  state.markReloaded();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("이 작업에 접근할 수 없습니다. 현재 계정과 학원을 확인해 주세요.")).toBeVisible();
  await expect(page.getByRole("button", { name: /완료된 PPT 다운로드/ })).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
  expect(state.postCount).toBe(1);
});

test("다른 사용자 작업 기록은 조회하지 않고 지운다", async ({ page }) => {
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript(({ token, key }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
    localStorage.setItem(key, JSON.stringify([{
      jobId: "other-users-ppt", tenantScope: "hakwonplus", userId: "999",
      label: "PPT 생성 (PDF)", createdAt: Date.now(),
    }]));
  }, { token: jwt(), key: storageKey });
  let jobGets = 0;
  await page.route("**/api/v1/jobs/other-users-ppt/**", async (route) => {
    jobGets += 1;
    await route.fulfill({ status: 500, body: "unexpected job GET" });
  });
  await page.goto(`${getBaseUrl("admin")}/workspace/tools/ppt`, { waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
  await expect(page.getByText("이전 작업은 현재 계정이나 학원에서 복구할 수 없습니다.")).toBeVisible();
  expect(jobGets).toBe(0);
});

test("만료된 PPT 작업 기록은 조회하지 않고 안내한다", async ({ page }) => {
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript(({ token, key }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
    localStorage.setItem(key, JSON.stringify([{
      jobId: "stale-ppt-job", tenantScope: "hakwonplus", userId: "12",
      label: "PPT 생성 (PDF)", createdAt: Date.now() - 25 * 60 * 60 * 1000,
    }]));
  }, { token: jwt(), key: storageKey });
  let jobGets = 0;
  await page.route("**/api/v1/jobs/stale-ppt-job/**", async (route) => {
    jobGets += 1;
    await route.fulfill({ status: 500, body: "unexpected job GET" });
  });
  await page.goto(`${getBaseUrl("admin")}/workspace/tools/ppt`, { waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
  await expect(page.getByText("오래된 작업 기록은 만료되었습니다. 원본 파일을 다시 선택해 주세요.")).toBeVisible();
  expect(jobGets).toBe(0);
});

for (const { workflow, width, expectedMode } of [
  { workflow: "auto", width: 1366, expectedMode: "pdf" },
  { workflow: "manual", width: 390, expectedMode: "images" },
] as const) {
  test(`PPT ${workflow} 작업은 새로고침 후 GET으로 복구한다 (${width}px)`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 850 });
    const jobId = `ppt-${workflow}-recover`;
    const state = await setup(page, jobId);
    if (workflow === "manual") {
      await page.getByRole("button", { name: "직접 자르기" }).click();
      await expect(page.getByText("1 / 3쪽")).toBeVisible();
      await page.getByRole("button", { name: "현재 쪽 전체 추가" }).click();
    }
    await page.getByRole("button", { name: "PPT 생성 및 다운로드" }).click();
    await expect.poll(() => state.postCount).toBe(1);
    expect(state.submittedMode).toBe(expectedMode);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey)).not.toBeNull();
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), storageKey);
    expect(stored).toHaveLength(1);
    expect(Object.keys(stored[0]).sort()).toEqual(["createdAt", "jobId", "label", "tenantScope", "userId"]);
    expect(stored[0]).toMatchObject({ jobId, tenantScope: "hakwonplus", userId: "12" });
    expect(JSON.stringify(stored)).not.toContain("download_url");

    state.markReloaded();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /완료된 PPT 다운로드/ })).toBeVisible();
    const previousGetCount = state.statusGetCount;
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /완료된 PPT 다운로드/ }).click();
    expect((await download).suggestedFilename()).toBe("recovered.pptx");
    expect(state.statusGetCount).toBeGreaterThan(previousGetCount);
    expect(state.postCount).toBe(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}
