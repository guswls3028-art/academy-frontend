import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
async function api(page: any, method: string, path: string, data?: any) {
  const token = await page.evaluate(() => localStorage.getItem("access"));
  const opts: any = { headers: { "X-Tenant-Code": "hakwonplus", "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } };
  if (data) opts.data = data;
  const fn = method === "GET" ? page.request.get : method === "POST" ? page.request.post : method === "PATCH" ? page.request.patch : page.request.delete;
  const r = await fn.call(page.request, `${API}/api/v1${path}`, opts);
  return { s: r.status(), b: await r.json().catch(() => null) };
}

test.describe("배포 후 전체 검증", () => {
  test.beforeEach(async ({ page }) => { await loginViaUI(page, "admin"); });

  test("01 API 헬스체크", async ({ page }) => {
    const r = await page.request.get(`${API}/healthz`);
    expect(r.status()).toBe(200);
    console.log("healthz OK");
  });

  test("02 직원 API 정상", async ({ page }) => {
    const r = await api(page, "GET", "/staffs/");
    expect(r.s).toBe(200);
    console.log("Staffs:", (r.b?.results || []).length, "명");
  });

  test("03 비용 등록 (tenant_id 버그 수정 확인)", async ({ page }) => {
    const r = await api(page, "POST", "/staffs/expense-records/", {
      staff: 20, date: "2026-04-01", title: "[DEPLOY-CHECK]", amount: 100
    });
    console.log("Expense create:", r.s);
    expect(r.s).toBe(201);
    // cleanup
    if (r.b?.id) await api(page, "DELETE", `/staffs/expense-records/${r.b.id}/`);
  });

  test("04 메시지 설정 페이지", async ({ page }) => {
    await page.goto(`${B}/admin/message/settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await expect(page.locator("text=메시징 공급자").first()).toBeVisible({ timeout: 10000 });
  });

  test("05 직원 근태 KPI", async ({ page }) => {
    await page.goto(`${B}/admin/staff/attendance?staffId=20&year=2026&month=3`, { waitUntil: "load" });
    await page.waitForTimeout(4000);
    await expect(page.locator("text=총 근무시간").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=실지급액").first()).toBeVisible({ timeout: 5000 });
  });

  test("06 클리닉 메시지 알림톡/SMS 분리", async ({ page }) => {
    await page.goto(`${B}/admin/clinic/msg-settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await expect(page.locator("text=알림톡 자동발송").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=SMS 자동발송").first()).toBeVisible({ timeout: 5000 });
  });

  test("07 자동발송 (both 제거 확인)", async ({ page }) => {
    await page.goto(`${B}/admin/message/auto-send`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    // "모두" 옵션이 없어야 함
    const allOption = page.locator("option[value=both]");
    expect(await allOption.count()).toBe(0);
  });

  test("08 날짜 클릭 크래시 수정 확인", async ({ page }) => {
    const errs: string[] = [];
    page.on("console", (m: any) => { if (m.type() === "error") errs.push(m.text()); });
    await page.goto(`${B}/admin/staff/attendance?staffId=20&year=2026&month=3`, { waitUntil: "load" });
    await page.waitForTimeout(4000);
    const cell = page.locator("button").filter({ hasText: /^29/ }).first();
    if (await cell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cell.click();
      await page.waitForTimeout(2000);
    }
    expect(await page.locator("text=일시적인 오류").isVisible({ timeout: 1000 }).catch(() => false)).toBe(false);
    const fatal = errs.filter(e => e.includes("TypeError") || e.includes("ReferenceError"));
    expect(fatal).toHaveLength(0);
  });

  test("09 성적 페이지", async ({ page }) => {
    await page.goto(`${B}/admin/results`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await expect(page.locator("text=성적").first()).toBeVisible({ timeout: 10000 });
  });

  test("10 대시보드 정상", async ({ page }) => {
    await page.goto(`${B}/admin/dashboard`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await expect(page.locator("text=대시보드").first()).toBeVisible({ timeout: 10000 });
  });
});
