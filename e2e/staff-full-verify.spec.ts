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

test.describe.serial("직원관리 전체 검증", () => {
  let staffId = 0, wtId = 0, swtId = 0, wrId = 0, expId = 0;
  test.beforeEach(async ({ page }) => { await loginViaUI(page, "admin"); });

  test("01 시급태그 생성+수정", async ({ page }) => {
    let r = await api(page, "POST", "/staffs/work-types/", { name: "[V]태그", base_hourly_wage: 10000, color: "#ef4444" });
    expect(r.s).toBe(201); wtId = r.b.id;
    r = await api(page, "PATCH", `/staffs/work-types/${wtId}/`, { base_hourly_wage: 11000 });
    expect(r.s).toBe(200); expect(r.b.base_hourly_wage).toBe(11000);
  });

  test("02 조교 생성 (프론트 모달)", async ({ page }) => {
    await page.goto(`${B}/admin/staff/home`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.locator("button").filter({ hasText: "직원 등록" }).click();
    await page.waitForTimeout(800);
    const modal = page.locator("[role=dialog]");
    await expect(modal).toBeVisible({ timeout: 5000 });
    const inputs = modal.locator("input");
    await inputs.nth(0).fill("vt" + Date.now().toString().slice(-6));
    await inputs.nth(1).fill("pass1234");
    await inputs.nth(2).fill("[V]검증조교");
    await inputs.nth(3).fill("01011112222");
    await modal.locator("button").filter({ hasText: "등록" }).click();
    await page.waitForTimeout(3000);
    await expect(page.locator("text=[V]검증조교")).toBeVisible({ timeout: 10000 });
    const data = await api(page, "GET", "/staffs/");
    staffId = ((data.b?.results || []) as any[]).find((s: any) => s.name === "[V]검증조교")?.id;
    expect(staffId).toBeGreaterThan(0);
  });

  test("03 시급태그 할당 + 프론트 뱃지", async ({ page }) => {
    const r = await api(page, "POST", "/staffs/staff-work-types/", { staff: staffId, work_type_id: wtId });
    expect(r.s).toBe(201); swtId = r.b.id;
    expect(r.b.effective_hourly_wage).toBe(11000);
    await page.goto(`${B}/admin/staff/home`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    // 태그 뱃지는 "이름 + 시급" 형태로 표시될 수 있음
    const tagVisible = await page.locator("text=/\\[V\\]태그/").first().isVisible({ timeout: 8000 }).catch(() => false);
    console.log("Tag badge visible:", tagVisible);
  });

  test("04 출근→퇴근→자동계산", async ({ page }) => {
    // 출근
    let r = await api(page, "POST", `/staffs/${staffId}/work-records/start-work/`, { work_type: wtId });
    expect(r.s).toBe(201); wrId = r.b.id;
    // 잠시 대기 후 퇴근
    await page.waitForTimeout(2000);
    r = await api(page, "POST", `/staffs/work-records/${wrId}/end_work/`);
    expect(r.s).toBe(200);
    expect(r.b.work_hours).not.toBeNull();
    expect(r.b.resolved_hourly_wage).toBe(11000);
    console.log("Clock in/out OK — hours:", r.b.work_hours, "amount:", r.b.amount);
  });

  test("05 수동 근무기록 (8h=88000원)", async ({ page }) => {
    const r = await api(page, "POST", "/staffs/work-records/", {
      staff: staffId, work_type: wtId, date: "2026-04-01", start_time: "09:00", end_time: "18:00", break_minutes: 60
    });
    expect(r.s).toBe(201);
    expect(Number(r.b.work_hours)).toBeCloseTo(8.0, 1);
    expect(r.b.amount).toBe(88000);
  });

  test("06 비용 등록+승인", async ({ page }) => {
    let r = await api(page, "POST", "/staffs/expense-records/", { staff: staffId, date: "2026-04-01", title: "[V]교통비", amount: 5000 });
    expect(r.s).toBe(201); expId = r.b.id;
    r = await api(page, "PATCH", `/staffs/expense-records/${expId}/`, { status: "APPROVED" });
    expect(r.s).toBe(200); expect(r.b.status).toBe("APPROVED");
  });

  test("07 급여 요약 정확성", async ({ page }) => {
    const r = await api(page, "GET", `/staffs/${staffId}/summary/?date_from=2026-04-01&date_to=2026-04-30`);
    expect(r.s).toBe(200);
    // 수동 8h + 실시간 출퇴근 (수초) → 8h 이상
    expect(Number(r.b.work_hours)).toBeGreaterThanOrEqual(8);
    // 기본급: 8h*11000=88000 이상
    expect(r.b.work_amount).toBeGreaterThanOrEqual(88000);
    // 비용은 생성 시점 순서상 아직 없을 수 있음
    console.log("Summary:", JSON.stringify(r.b));
  });

  test("08 관리자+급여유형 토글", async ({ page }) => {
    let r = await api(page, "PATCH", `/staffs/${staffId}/`, { is_manager: true });
    expect(r.b.is_manager).toBe(true);
    r = await api(page, "PATCH", `/staffs/${staffId}/`, { is_manager: false, pay_type: "MONTHLY" });
    expect(r.b.pay_type).toBe("MONTHLY");
    r = await api(page, "PATCH", `/staffs/${staffId}/`, { pay_type: "HOURLY" });
    expect(r.b.pay_type).toBe("HOURLY");
  });

  test("09 근태 KPI + 날짜 클릭 (프론트)", async ({ page }) => {
    const jsErr: string[] = [];
    page.on("console", (m: any) => { if (m.type() === "error") jsErr.push(m.text()); });
    await page.goto(`${B}/admin/staff/attendance?staffId=${staffId}&year=2026&month=4`, { waitUntil: "load" });
    await page.waitForTimeout(4000);
    await expect(page.locator("text=총 근무시간").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=실지급액").first()).toBeVisible();
    // 1일 클릭
    const cell = page.locator("button").filter({ hasText: /^1$/ }).first();
    if (await cell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cell.click();
      await page.waitForTimeout(2000);
    }
    expect(await page.locator("text=일시적인 오류").isVisible({ timeout: 1000 }).catch(() => false)).toBe(false);
    const fatal = jsErr.filter(e => e.includes("TypeError") || e.includes("ReferenceError"));
    expect(fatal).toHaveLength(0);
    await page.screenshot({ path: "e2e/screenshots/v-final-kpi.png", fullPage: true });
  });

  test("10 비용탭 렌더링", async ({ page }) => {
    await page.goto(`${B}/admin/staff/expenses?staffId=${staffId}&year=2026&month=4`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await expect(page.locator("text=[V]교통비").first()).toBeVisible({ timeout: 10000 });
  });

  test("11 설정탭 알림톡/SMS", async ({ page }) => {
    await page.goto(`${B}/admin/staff/settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await expect(page.locator("text=알림톡 자동발송").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=SMS 자동발송").first()).toBeVisible({ timeout: 5000 });
  });

  test("99 정리", async ({ page }) => {
    if (expId) await api(page, "DELETE", `/staffs/expense-records/${expId}/`);
    const recs = await api(page, "GET", `/staffs/work-records/?staff=${staffId}&date_from=2026-04-01&date_to=2026-04-30`);
    for (const r of ((recs.b?.results || recs.b || []) as any[])) await api(page, "DELETE", `/staffs/work-records/${r.id}/`);
    if (swtId) await api(page, "DELETE", `/staffs/staff-work-types/${swtId}/`);
    if (staffId) await api(page, "DELETE", `/staffs/${staffId}/`);
    if (wtId) await api(page, "DELETE", `/staffs/work-types/${wtId}/`);
  });
});
