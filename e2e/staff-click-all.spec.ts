/**
 * 직원관리 — 모든 조작 실제 클릭/동작 검증
 * Tenant 1 전용, E2E 데이터는 [E2E-] 태그 후 cleanup
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const B = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
const TS = Date.now().toString().slice(-6);

async function getToken(page: Page) {
  return await page.evaluate(() => localStorage.getItem("access"));
}
async function apiReq(page: Page, method: string, path: string, data?: unknown) {
  const token = await getToken(page);
  const opts: Record<string, unknown> = {
    headers: { "X-Tenant-Code": "hakwonplus", "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
  };
  if (data) opts.data = data;
  const fn = method === "GET" ? page.request.get : method === "POST" ? page.request.post : method === "PATCH" ? page.request.patch : page.request.delete;
  const r = await fn.call(page.request, `${API}/api/v1${path}`, opts);
  return { status: r.status(), body: await r.json().catch(() => null), text: await r.text().catch(() => "") };
}

test.describe.serial("직원관리 전체 조작", () => {
  let staffId = 0;
  let workTypeId = 0;
  let staffWorkTypeId = 0;
  let workRecordId = 0;
  let expenseId = 0;

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("1. 시급태그 생성", async ({ page }) => {
    const res = await apiReq(page, "POST", "/staffs/work-types/", {
      name: `[E2E-${TS}]태그`, base_hourly_wage: 12000, color: "#3b82f6", description: "E2E test",
    });
    console.log("WorkType:", res.status, res.body?.id);
    expect(res.status).toBe(201);
    workTypeId = res.body.id;
  });

  test("2. 조교 생성 (프론트 모달)", async ({ page }) => {
    await page.goto(`${B}/admin/staff/home`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    await page.locator("button").filter({ hasText: "직원 등록" }).first().click();
    await page.waitForTimeout(800);

    const modal = page.locator("[role=dialog]").first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // nth index로 입력 (순서: 아이디, 비번, 이름, 전화번호)
    const inputs = modal.locator("input");
    await inputs.nth(0).fill(`e2e${TS}`);
    await inputs.nth(1).fill("test1234");
    await inputs.nth(2).fill(`[E2E-${TS}]조교`);
    await inputs.nth(3).fill("01099887766");

    await page.screenshot({ path: "e2e/screenshots/click-create-filled.png" });
    await modal.locator("button").filter({ hasText: "등록" }).click();
    await page.waitForTimeout(3000);

    // 생성 확인
    const newRow = page.locator(`text=[E2E-${TS}]조교`);
    await expect(newRow).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "e2e/screenshots/click-create-done.png", fullPage: true });

    // staffId 확보
    const data = await apiReq(page, "GET", "/staffs/");
    const list = (data.body?.results || data.body || []) as Array<{ id: number; name: string }>;
    const found = list.find(s => s.name.includes(`E2E-${TS}`));
    expect(found).toBeTruthy();
    staffId = found!.id;
    console.log("Staff created:", staffId);
  });

  test("3. 시급태그 할당", async ({ page }) => {
    const res = await apiReq(page, "POST", "/staffs/staff-work-types/", {
      staff: staffId, work_type_id: workTypeId,
    });
    console.log("Assign tag:", res.status);
    expect(res.status).toBe(201);
    staffWorkTypeId = res.body.id;

    // 프론트에서 확인
    await page.goto(`${B}/admin/staff/home`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await expect(page.locator(`text=[E2E-${TS}]태그`)).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: "e2e/screenshots/click-tag-visible.png", fullPage: true });
  });

  test("4. 출근 → 퇴근 → 근무시간 자동계산", async ({ page }) => {
    // 기존 출근 상태 확인
    const cur = await apiReq(page, "GET", `/staffs/${staffId}/work-records/current/`);
    if (cur.body?.status === "WORKING" || cur.body?.status === "BREAK") {
      await apiReq(page, "POST", `/staffs/work-records/${cur.body.work_record_id}/end_work/`);
    }

    // 출근
    const start = await apiReq(page, "POST", `/staffs/${staffId}/work-records/start-work/`, { work_type: workTypeId });
    console.log("Clock in:", start.status, start.body?.id);
    expect(start.status).toBe(201);
    workRecordId = start.body.id;

    // 잠시 대기
    await page.waitForTimeout(2000);

    // 퇴근
    const end = await apiReq(page, "POST", `/staffs/work-records/${workRecordId}/end_work/`);
    console.log("Clock out:", end.status);
    expect(end.status).toBe(200);
    console.log("Result:", JSON.stringify({
      date: end.body.date, start: end.body.start_time, end: end.body.end_time,
      hours: end.body.work_hours, amount: end.body.amount, wage: end.body.resolved_hourly_wage,
    }));
    expect(end.body.work_hours).not.toBeNull();
    expect(end.body.amount).not.toBeNull();
    expect(end.body.resolved_hourly_wage).toBe(12000);

    // 프론트 확인
    const now = new Date();
    await page.goto(`${B}/admin/staff/attendance?staffId=${staffId}&year=${now.getFullYear()}&month=${now.getMonth()+1}`, { waitUntil: "load" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "e2e/screenshots/click-attendance-record.png", fullPage: true });
  });

  test("5. 비용/경비 등록 + 프론트 확인", async ({ page }) => {
    const res = await apiReq(page, "POST", "/staffs/expense-records/", {
      staff: staffId, date: new Date().toISOString().split("T")[0],
      title: `[E2E-${TS}]교통비`, amount: 5000, memo: "E2E",
    });
    console.log("Expense:", res.status, res.body?.id);
    expect(res.status).toBe(201);
    expenseId = res.body.id;

    const now = new Date();
    await page.goto(`${B}/admin/staff/expenses?staffId=${staffId}&year=${now.getFullYear()}&month=${now.getMonth()+1}`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await expect(page.locator(`text=[E2E-${TS}]교통비`)).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: "e2e/screenshots/click-expense.png", fullPage: true });
  });

  test("6. 비용 승인", async ({ page }) => {
    const res = await apiReq(page, "PATCH", `/staffs/expense-records/${expenseId}/`, { status: "APPROVED" });
    console.log("Approve expense:", res.status, res.body?.status);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
  });

  test("7. 관리자권한 토글 + 급여유형 전환", async ({ page }) => {
    // 관리자 ON
    let r = await apiReq(page, "PATCH", `/staffs/${staffId}/`, { is_manager: true });
    expect(r.status).toBe(200);
    console.log("Manager ON:", r.body.is_manager);

    // 관리자 OFF
    r = await apiReq(page, "PATCH", `/staffs/${staffId}/`, { is_manager: false });
    expect(r.status).toBe(200);
    console.log("Manager OFF:", r.body.is_manager);

    // 급여유형 → 월급
    r = await apiReq(page, "PATCH", `/staffs/${staffId}/`, { pay_type: "MONTHLY" });
    expect(r.status).toBe(200);
    console.log("Pay MONTHLY:", r.body.pay_type);

    // 급여유형 → 시급
    r = await apiReq(page, "PATCH", `/staffs/${staffId}/`, { pay_type: "HOURLY" });
    expect(r.status).toBe(200);
    console.log("Pay HOURLY:", r.body.pay_type);

    // 프론트에서 확인
    await page.goto(`${B}/admin/staff/home`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/click-toggles.png", fullPage: true });
  });

  test("8. 급여 요약 API 확인", async ({ page }) => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const to = `${y}-${String(m).padStart(2, "0")}-30`;
    const res = await apiReq(page, "GET", `/staffs/${staffId}/summary/?date_from=${from}&date_to=${to}`);
    console.log("Summary:", JSON.stringify(res.body));
    expect(res.status).toBe(200);
    expect(res.body.work_hours).toBeGreaterThan(0);
  });

  test("99. Cleanup", async ({ page }) => {
    if (expenseId) console.log("Del expense:", (await apiReq(page, "DELETE", `/staffs/expense-records/${expenseId}/`)).status);
    if (workRecordId) console.log("Del record:", (await apiReq(page, "DELETE", `/staffs/work-records/${workRecordId}/`)).status);
    if (staffWorkTypeId) console.log("Del mapping:", (await apiReq(page, "DELETE", `/staffs/staff-work-types/${staffWorkTypeId}/`)).status);
    if (staffId) console.log("Del staff:", (await apiReq(page, "DELETE", `/staffs/${staffId}/`)).status);
    if (workTypeId) console.log("Del worktype:", (await apiReq(page, "DELETE", `/staffs/work-types/${workTypeId}/`)).status);
  });
});
