import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
test.use({ serviceWorkers: "block", timezoneId: "Asia/Seoul" });
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local synthetic API only");

async function installApi(page: Page) {
  await installTenantOneInitScript(page);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const jwt = `${encode({ alg: "none" })}.${encode({ exp: 2_000_000_000, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, jwt);
  const generated: Record<string, unknown>[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown) => route.fulfill({ json: body });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "검증 학원", isPlatformAdmin: false, is_active: true, feature_flags: { fee_management: true } });
    if (path === "/core/me/") return json({ id: 12, username: "fees-owner", name: "수납 담당자", is_staff: true, is_superuser: false, tenantRole: "owner", must_change_password: false, first_login_guide_required: false });
    if (path === "/core/subscription/") return json({ plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 });
    if (path === "/fees/invoices/generate/") {
      generated.push(req.postDataJSON());
      return json({ created: 1, skipped: 0, errors: [] });
    }
    if (path === "/staffs/me/") return json({ id: 12, can_manage_staff: true });
    return json({ count: 0, next: null, results: [] });
  });
  return { generated };
}

for (const mobile of [false, true]) {
for (const conflict of [false, true]) {
test(`${mobile ? "모바일 업무 390px" : "관리자 1366px"} 부분 수납 ${conflict ? "동시 잔액 변경" : "응답 유실 60초 후 재시도"}와 새 분할 납부`, async ({ page }) => {
  await page.setViewportSize({ width: mobile ? 390 : 1366, height: 900 });
  await installApi(page);
  const entries: Array<Record<string, unknown>> = [];
  const requests: Array<Record<string, unknown>> = [];
  let loseFirstResponse = !conflict;
  const invoice = () => ({
    id: 701, student: 71, student_name: "수납 검증 학생", invoice_number: "QA-701",
    billing_year: 2026, billing_month: 10, total_amount: 100000,
    paid_amount: entries.reduce((sum, entry) => sum + Number(entry.amount), 0),
    outstanding_amount: 100000 - entries.reduce((sum, entry) => sum + Number(entry.amount), 0),
    status: entries.length ? "PARTIAL" : "PENDING", due_date: "2026-10-31", items: [], payments: entries,
  });
  await page.route("**/api/v1/fees/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path.endsWith("/payments/") && req.method() === "POST") {
      const payload = req.postDataJSON() as Record<string, unknown>;
      requests.push(payload);
      if (conflict && requests.length === 1) {
        entries.push({ id: 99, amount: 40000, status: "SUCCESS", payment_method: "CASH", payment_method_display: "현금", paid_at: "2026-10-09T09:00:00+09:00" });
      }
      let entry = payload.idempotency_key && entries.find((row) => row.idempotency_key === payload.idempotency_key);
      if (!entry) {
        if (payload.expected_paid_amount !== invoice().paid_amount) {
          return route.fulfill({ status: 409, json: { code: "invoice_balance_changed", detail: "수납 내역이 변경되었습니다. 최신 납부 금액을 확인한 뒤 다시 기록해 주세요." } });
        }
        entry = { ...payload, id: entries.length + 1, status: "SUCCESS", payment_method_display: "현금", paid_at: "2026-10-09T09:00:00+09:00" };
        entries.push(entry);
      }
      if (loseFirstResponse) {
        loseFirstResponse = false;
        return route.fulfill({ status: 504, json: { detail: "수납 결과 확인에 실패했습니다" } });
      }
      return route.fulfill({ status: 201, json: entry });
    }
    return route.fulfill({ json: path.endsWith("/invoices/701/") ? invoice() : { count: 1, next: null, results: [invoice()] } });
  });
  await gotoAndSettle(page, `${BASE}/workspace/${mobile ? "mobile/" : ""}fees/invoices`);
  if (mobile) await page.getByRole("button", { name: /수납 검증 학생/ }).click();
  else await page.getByText("QA-701", { exact: true }).click();
  const openPayment = () => page.getByRole("dialog").getByRole("button", { name: mobile ? "결제 기록하기" : "수납 기록", exact: true }).click();
  await openPayment();
  const form = mobile ? page.getByRole("dialog") : page.getByRole("dialog", { name: "수납 기록" });
  await form.locator('input[type="number"]').fill("40000");
  await form.getByRole("button", { name: mobile ? "저장" : "수납 기록", exact: true }).click();
  if (conflict) {
    await expect(page.getByText("수납 내역이 변경되었습니다. 최신 납부 금액을 확인한 뒤 다시 기록해 주세요.", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog").locator('input[type="number"]')).toHaveCount(0);
    await waitForRenderSettled(page);
    await page.screenshot({ path: test.info().outputPath(`payment-conflict-${mobile ? 390 : 1366}.png`), fullPage: true, animations: "disabled" });
  } else {
    await expect(page.getByText("수납 결과 확인에 실패했습니다", { exact: true })).toBeVisible();
    await expect(form.locator('input[type="number"]')).toBeDisabled();
    await waitForRenderSettled(page);
    await page.screenshot({ path: test.info().outputPath(`payment-retry-${mobile ? 390 : 1366}.png`), fullPage: true, animations: "disabled" });
    await page.clock.setFixedTime(new Date(Date.now() + 61000));
    await form.getByRole("button", { name: "같은 수납 다시 확인", exact: true }).click();
    await expect(form.locator('input[type="number"]')).toHaveCount(0);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
  }
  expect(entries).toHaveLength(1);
  expect(requests[0].idempotency_key).toBeTruthy();
  await page.reload();
  if (!mobile) await page.getByText("QA-701", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("60,000");
  await openPayment();
  await expect(form.locator('input[type="number"]')).toHaveValue("60000");
  await form.getByRole("button", { name: mobile ? "저장" : "수납 기록", exact: true }).click();
  await expect(form.locator('input[type="number"]')).toHaveCount(0);
  expect(entries).toHaveLength(2);
  expect(invoice().paid_amount).toBe(100000);
  expect(requests.at(-1)?.expected_paid_amount).toBe(40000);
  expect(requests.at(-1)?.idempotency_key).not.toBe(requests[0].idempotency_key);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(mobile ? 390 : 1366);
});
}
}

for (const width of [1366, 390]) {
test(`${width}px 한국 시간 월말·윤년·선택 월 변경과 직접 입력한 납부기한을 보존한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.clock.setFixedTime(new Date("2028-03-12T12:00:00+09:00"));
  const state = await installApi(page);
  await gotoAndSettle(page, `${BASE}/workspace/fees/invoices`);
  await page.getByRole("button", { name: "월 청구서 생성", exact: true }).click();
  await expect(page.locator('input[type="date"]')).toHaveValue("2028-03-31");
  await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("combobox").first().selectOption("2028-2");
  await page.getByRole("button", { name: "월 청구서 생성", exact: true }).click();
  await expect(page.locator('input[type="date"]')).toHaveValue("2028-02-29");
  await page.locator('input[type="date"]').fill("2028-03-05");
  await waitForRenderSettled(page);
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({ path: test.info().outputPath(`fees-due-date-${width}.png`), fullPage: true, animations: "disabled" });
  await page.getByRole("dialog").getByRole("button", { name: "생성", exact: true }).click();
  await expect.poll(() => state.generated).toEqual([{ billing_year: 2028, billing_month: 2, due_date: "2028-03-05" }]);
});
}

for (const failSecondPage of [false, true]) {
  test(`청구서 전체 조회 ${failSecondPage ? "실패는 빈 결과와 구별하고 재시도로 복구" : "501번째 내역과 합계 보존"}`, async ({ page }) => {
    await installApi(page);
    let failing = failSecondPage;
    const invoices = Array.from({ length: 501 }, (_, index) => ({
      id: index + 1, invoice_number: `QA-${index + 1}`, student: index + 1,
      student_name: `검증학생 ${String(index + 1).padStart(3, "0")}`,
      billing_year: 2026, billing_month: 10, total_amount: 100000, paid_amount: 0,
      outstanding_amount: 100000, status: "PENDING", status_display: "미납", due_date: "2026-10-31",
    }));
    await page.route("**/api/v1/fees/invoices/?*", async (route) => {
      const number = Number(new URL(route.request().url()).searchParams.get("page") || 1);
      if (failing && number === 2) return route.fulfill({ status: 400, json: { detail: "QA second page failure" } });
      return route.fulfill({ json: { count: 501, next: number === 1 ? "?page=2" : null, results: invoices.slice((number - 1) * 500, number * 500) } });
    });
    await gotoAndSettle(page, `${BASE}/workspace/fees/invoices`);
    if (failSecondPage) {
      await expect(page.getByText("청구서를 불러올 수 없습니다", { exact: true })).toBeVisible();
      await expect(page.getByText("해당 월의 청구서가 없습니다", { exact: true })).toHaveCount(0);
      failing = false;
      await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    }
    await expect(page.getByRole("button", { name: "전체 501", exact: true })).toBeVisible();
    await expect(page.getByText("검증학생 501", { exact: true })).toBeVisible();
  });
}

test("미납/부분납 바로가기는 완납·취소를 제외하고 전체로 복구한다", async ({ page }) => {
  await installApi(page);
  const invoices = ["PENDING", "PARTIAL", "OVERDUE", "PAID", "CANCELLED"].map((status, index) => ({
    id: index + 1, student: index + 1, student_name: `${status} 학생`, invoice_number: `QA-${status}`,
    billing_year: 2026, billing_month: 10, total_amount: 100000, paid_amount: status === "PAID" ? 100000 : 0,
    outstanding_amount: status === "PAID" ? 0 : 100000, status, due_date: "2026-10-31",
  }));
  await page.route("**/api/v1/fees/invoices/?*", (route) => {
    const status = new URL(route.request().url()).searchParams.get("status");
    const results = status === "UNPAID" ? invoices.slice(0, 3) : invoices;
    return route.fulfill({ json: { count: results.length, results, next: null } });
  });
  await gotoAndSettle(page, `${BASE}/workspace/fees/invoices`);
  await expect(page.getByRole("button", { name: "전체 5", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "미납/부분납 3", exact: true }).click();
  await expect(page.getByText("PAID 학생", { exact: true })).toHaveCount(0);
  await expect(page.getByText("CANCELLED 학생", { exact: true })).toHaveCount(0);
  await expect(page.getByText("OVERDUE 학생", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "전체 3", exact: true }).click();
  await expect(page.getByText("PAID 학생", { exact: true })).toBeVisible();
});
