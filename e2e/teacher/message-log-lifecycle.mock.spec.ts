import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5193").replace(/\/+$/, "");
const LOCAL = ["127.0.0.1", "localhost"].includes(new URL(BASE).hostname);
const statuses = ["processing", "sending", "sent", "retryable_failed", "failed", "ambiguous", "future_status"];
const labels = ["발송 준비 중", "접수 확인 중", "접수 완료", "재시도 대기", "발송 실패", "결과 확인 필요", "상태 확인 필요"];

async function scenario(page: Page, role: "teacher" | "staff", paginated = false) {
  const access = `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.sig`;
  await page.addInitScript(({ access, role }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", access);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
    localStorage.setItem("teacher:preferAdmin", "0");
    sessionStorage.setItem("teacher-message-test-role", role);
  }, { access, role });
  const logs = statuses.map((status, index) => ({
    id: index + 1, status, success: status === "sent" || status === "future_status",
    sent_at: "2026-09-13T01:00:00+09:00", amount_deducted: "0", message_mode: "alimtalk",
    template_summary: `합성 안내 ${index + 1}`, recipient_summary: "합성학생 010****0000",
    provider_evidence: status === "sent", provider_message_reference: status === "sent" ? "•••• abc123" : "",
    provider_delivery_status: status === "sent" ? "provider_accepted" : "unavailable",
    body_visibility: "restricted", message_body: "", failure_reason: status === "failed" ? "발송을 완료하지 못했습니다." : "",
  }));
  const observed = { list: 0, detail: 0, mutations: 0, detailFailure: false, listFailure: false, pages: [] as number[], failureReason: "",
    finalStatus: "delivered" as "delivered" | "failed" | "provider_accepted" | "unavailable", hold: null as null | (() => void) };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    if (request.method() !== "GET") observed.mutations++;
    if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "합성 학원", ui_config: {}, feature_flags: {}, is_active: true } });
    if (path === "/core/me/") return route.fulfill({ json: { id: 3, username: role, name: "합성 교직원", is_staff: true, is_superuser: false, tenantRole: role, must_change_password: false } });
    if (path === "/staffs/me/") return route.fulfill({ json: { is_authenticated: true, is_staff: true, is_owner: false, is_payroll_manager: false, staff_id: 12, assigned_work_types: [] } });
    if (path === "/messaging/log/") {
      observed.list++;
      const requestedPage = Number(url.searchParams.get("page") || "1");
      observed.pages.push(requestedPage);
      if (observed.listFailure) return route.fulfill({ status: 403, json: { detail: "이력을 조회할 수 없습니다." } });
      if (paginated) {
        expect(url.searchParams.get("page_size")).toBe("50");
        const results = requestedPage === 1
          ? Array.from({ length: 50 }, (_, index) => ({ ...logs[2], id: 100 + index, template_summary: `최근 안내 ${index + 1}`, sent_at: "2026-10-28T21:00:00+09:00" }))
          : requestedPage === 2 ? [logs[2]] : [];
        return route.fulfill({ json: { results, count: 51 } });
      }
      return route.fulfill({ json: { results: logs, count: logs.length } });
    }
    if (path === "/messaging/log/3/") {
      observed.detail++;
      expect(request.method()).toBe("GET");
      expect(url.searchParams.get("verify_provider")).toBe("true");
      expect(request.headers()["x-tenant-code"]).toBe("hakwonplus");
      if (observed.detailFailure) return route.fulfill({ status: 403, json: { detail: "상태 확인 권한을 확인할 수 없습니다." } });
      await new Promise<void>((resolve) => { observed.hold = resolve; });
      return route.fulfill({ json: { ...logs[2], provider_delivery_status: observed.finalStatus, provider_status_code: observed.finalStatus === "failed" ? "3058" : observed.finalStatus === "delivered" ? "4000" : "", provider_delivery_checked_at: "2026-09-13T01:01:00+09:00", provider_delivery_failure_reason: observed.failureReason, message_body: "DO_NOT_DISPLAY_PRIVATE_BODY", provider_message_id: "DO_NOT_DISPLAY_PROVIDER_ID" } });
    }
    return route.fulfill({ json: { count: 0, results: [] } });
  });
  return observed;
}

for (const width of [390, 1366]) {
  test(`teacher ${width}: 과거 테스트 페이지와 최종 실패를 조회하고 다시 열 수 있다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const observed = await scenario(page, "teacher", true);
    await gotoAndSettle(page, `${BASE}/workspace/mobile/message-log`);
    await expect(page.getByRole("article")).toHaveCount(50);
    const pagination = page.getByRole("navigation", { name: "발송 내역 페이지" });
    await expect(pagination.getByRole("button", { name: "이전 페이지", exact: true })).toBeDisabled();
    await pagination.getByRole("button", { name: "다음 페이지", exact: true }).click();
    await expect(page).toHaveURL(/message-log\?page=2$/);
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(pagination.getByRole("button", { name: "다음 페이지", exact: true })).toBeDisabled();
    await page.reload();
    const record = page.getByRole("article", { name: "알림톡 기록: 합성 안내 3" });
    await expect(record).toBeVisible();
    expect(observed.pages.at(-1)).toBe(2);
    observed.finalStatus = "failed";
    observed.failureReason = "전송경로 없음(3058): 등록된 번호를 확인해 주세요.";
    await record.getByRole("button", { name: "최종 상태 확인", exact: true }).click();
    await expect.poll(() => observed.detail).toBe(1);
    observed.hold!();
    await expect(record.getByText("최종 전달 실패", { exact: true })).toBeVisible();
    await expect(record.getByText(observed.failureReason, { exact: true })).toBeVisible();
    await expect(record.getByText("결과 코드 3058", { exact: true })).toBeVisible();
    await expect(record.getByText(/확인 시각/)).toBeVisible();
    await expect(page.getByText("DO_NOT_DISPLAY_PRIVATE_BODY", { exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`past-message-test-${width}.png`), fullPage: true });
    observed.listFailure = true;
    await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
    await expect(page.getByText("발송 내역을 불러오지 못했습니다", { exact: true })).toBeVisible();
    observed.listFailure = false;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(record).toBeVisible();
    await pagination.getByRole("button", { name: "최신 내역", exact: true }).click();
    await expect(page).toHaveURL(/message-log$/);
    await expect(page.getByRole("article")).toHaveCount(50);
    expect(observed.mutations).toBe(0);
  });
}

test.use({ serviceWorkers: "block" });
test.skip(!LOCAL, "Local closed-proxy route mocks only.");

for (const role of ["teacher", "staff"] as const) for (const width of [1366, 390]) {
  test(`${role} ${width}: 발송 단계와 최종 전달 확인·실패 복구를 구분한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const observed = await scenario(page, role);
    await gotoAndSettle(page, `${BASE}/workspace/mobile/message-log`);
    for (const label of labels) await expect(page.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByText("성공", { exact: true })).toHaveCount(0);
    await expect(page.getByText("실패", { exact: true })).toHaveCount(0);
    expect(observed.detail).toBe(0);
    const record = page.getByRole("article", { name: "알림톡 기록: 합성 안내 3" });
    const check = record.getByRole("button", { name: "최종 상태 확인", exact: true });
    await check.click();
    await expect.poll(() => observed.detail).toBe(1);
    await expect(record.getByRole("button", { name: "확인 중" })).toBeDisabled();
    observed.hold!();
    await expect(record.getByText("최종 전달 확인", { exact: true })).toBeVisible();
    await expect(record.getByText("공급사가 최종 전달 완료로 보고했습니다.")).toBeVisible();
    await page.reload();
    await expect(record.getByText("접수 완료", { exact: true })).toBeVisible();
    await expect(record.getByText("최종 전달 확인", { exact: true })).toHaveCount(0);
    expect(observed.detail).toBe(1);
    observed.detailFailure = true;
    await check.click();
    await expect(record.getByRole("alert")).toContainText("최종 상태를 확인하지 못했습니다");
    await expect(record.getByText("접수 완료", { exact: true })).toBeVisible();
    expect(observed.detail).toBe(2);
    observed.detailFailure = false;
    await record.getByRole("button", { name: "다시 확인", exact: true }).click();
    await expect.poll(() => observed.detail).toBe(3);
    observed.hold!();
    await expect(record.getByText("최종 전달 확인", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByText("합성학생 010****0000", { exact: true })).toHaveCount(0);
    await expect(page.getByText("DO_NOT_DISPLAY_PRIVATE_BODY", { exact: true })).toHaveCount(0);
    await expect(page.getByText("DO_NOT_DISPLAY_PROVIDER_ID", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("message-log-lifecycle.png"), fullPage: true });
    for (const [status, label] of [["provider_accepted", "공급사 접수"], ["failed", "최종 전달 실패"], ["unavailable", "최종 상태 확인 불가"]] as const) {
      observed.finalStatus = status;
      const before = observed.detail;
      await check.click();
      await expect.poll(() => observed.detail).toBe(before + 1);
      observed.hold!();
      await expect(record.getByText(label, { exact: true })).toBeVisible();
      await expect(record.getByText("최종 전달 확인", { exact: true })).toHaveCount(0);
    }
    observed.listFailure = true;
    await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
    await expect(page.getByText("발송 내역을 불러오지 못했습니다", { exact: true })).toBeVisible();
    await expect(page.getByText("발송 내역이 없습니다", { exact: true })).toHaveCount(0);
    observed.listFailure = false;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(record.getByText("접수 완료", { exact: true })).toBeVisible();
    expect(observed.mutations).toBe(0);
  });
}
