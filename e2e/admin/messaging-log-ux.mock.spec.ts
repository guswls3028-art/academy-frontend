import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

const logs = [
  {
    id: 901,
    sent_at: "2026-08-23T02:25:27Z",
    claimed_at: "2026-08-23T02:25:28Z",
    success: true,
    status: "sent",
    amount_deducted: "0.00",
    recipient_summary: "최정원 0109****",
    template_summary: "가입 안내(학생)",
    notification_type: "registration_approved_student",
    message_mode: "alimtalk",
    failure_code: "",
    failure_reason: "",
    message_body: "",
    message_body_included: false,
    body_visibility: "sensitive_redacted",
    provider_evidence: true,
    provider_message_reference: "•••• A12345",
    provider_message_id: "group-provider-A12345",
  },
  {
    id: 902,
    sent_at: "2026-08-23T02:20:00Z",
    claimed_at: "2026-08-23T02:20:01Z",
    success: false,
    status: "ambiguous",
    amount_deducted: "15.00",
    recipient_summary: "김민서 0108****",
    template_summary: "클리닉 예약 안내",
    notification_type: "clinic_reservation_created",
    message_mode: "alimtalk",
    failure_code: "provider_unconfirmed",
    failure_reason: "공급사 접수 결과를 자동 확인하지 못했습니다. 관리자 확인이 필요합니다.",
    message_body: "",
    message_body_included: false,
    body_visibility: "available",
    provider_evidence: true,
    provider_message_reference: "•••• B67890",
    provider_message_id: "group-provider-B67890",
  },
  {
    id: 903,
    sent_at: "2026-08-23T02:15:00Z",
    claimed_at: null,
    success: false,
    status: "retryable_failed",
    amount_deducted: "0.00",
    recipient_summary: "이서준 0107****",
    template_summary: "성적 안내",
    notification_type: "exam_score_published",
    message_mode: "alimtalk",
    failure_code: "temporary_failure",
    failure_reason: "일시적인 연결 문제로 발송을 완료하지 못했습니다.",
    message_body: "",
    message_body_included: false,
    body_visibility: "available",
    provider_evidence: false,
    provider_message_reference: "",
    provider_message_id: "",
  },
];

async function installMessagingLogApp(page: Page) {
  const detailRequests: number[] = [];
  const access = localJwt();
  await page.addInitScript(({ accessToken }) => {
    localStorage.setItem("tenant_code", "hakwonplus");
    localStorage.setItem("workspace:preferFull:hakwonplus", "1");
    localStorage.setItem("access", accessToken);
    localStorage.setItem("refresh", `${accessToken}-refresh`);
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { accessToken: access });

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, body: "" });
    if (pathname === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: { login_title: "학원플러스" },
        feature_flags: {},
        is_active: true,
      });
    }
    if (pathname === "/core/me/") {
      return json({
        id: 12,
        username: "owner",
        name: "학원장",
        is_staff: true,
        is_superuser: false,
        tenantRole: "owner",
        must_change_password: false,
        first_login_guide_required: false,
      });
    }
    if (pathname === "/messaging/log/") {
      return json({ count: logs.length, results: logs });
    }
    if (pathname === "/messaging/info/") {
      return json({
        channel_source: "common_owner",
        alimtalk_available: true,
        messaging_provider: "solapi",
        delivery_policy: "common_alimtalk_only",
        tenant_messaging_enabled: true,
        messaging_ops_hold: false,
        can_manage_messaging: true,
      });
    }
    const detailMatch = pathname.match(/^\/messaging\/log\/(\d+)\/$/);
    if (detailMatch) {
      const id = Number(detailMatch[1]);
      detailRequests.push(id);
      const item = logs.find((entry) => entry.id === id);
      if (!item) return json({ detail: "Not found." }, 404);
      return json({
        ...item,
        message_body: id === 901
          ? "[보안] 계정/인증 알림 본문은 저장하지 않습니다."
          : "8월 24일 오후 3시 클리닉 예약이 완료되었습니다.",
        message_body_included: true,
      });
    }
    if (pathname === "/messaging/operations/status/") {
      return json({
        worker: { status: "ok", age_seconds: 12 },
        scheduled: { pending: 0, overdue: 0 },
        log_24h: {
          sent: 18,
          failed: 1,
          processing: 0,
          sending: 0,
          retryable_failed: 1,
          ambiguous: 1,
          action_required: 1,
          total: 21,
        },
        auto_send: { enabled: 4, enabled_without_template: 0, enabled_unapproved_template: 0 },
        risks: [],
      });
    }
    if (pathname === "/messaging/scheduled/") {
      return json({ count: 0, results: [] });
    }
    if (pathname === "/landing/has-published/") return json({ has_published: false });
    return json({ count: 0, results: [] });
  });
  return detailRequests;
}

async function openLog(page: Page) {
  await page.goto(`${BASE}/workspace/message/log`, { waitUntil: "commit", timeout: 60_000 });
  await expect(page.getByRole("tab", { name: "발송 내역" })).toBeVisible({ timeout: 60_000 });
}

test.use({ serviceWorkers: "block" });

test.describe("알림톡 발송 기록 UX", () => {
  test("provider lifecycle를 실패로 뭉개지 않고 보안 본문을 설명한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const detailRequests = await installMessagingLogApp(page);
    await openLog(page);

    const operationsSummary = page.getByRole("region", { name: "알림톡 운영 요약" });
    await expect(operationsSummary).toContainText("1 진행 중");
    await expect(operationsSummary).toContainText("1 확인 필요");
    await expect(operationsSummary).toContainText("1 실패");
    const logRegion = page.getByRole("region", { name: "알림톡 발송 기록" });
    await expect(logRegion.getByText("접수 완료", { exact: true })).toBeVisible();
    await expect(logRegion.getByText("결과 확인 필요", { exact: true })).toBeVisible();
    await expect(logRegion.getByText("재시도 대기", { exact: true })).toBeVisible();
    await expect(page.getByText("성공", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: /최정원/ }).click();
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByText("알림톡 발송 기록", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("region", { name: "카카오 알림톡 미리보기" })).toBeVisible();
    await expect(dialog.getByText("우리 학원 알림톡", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/보안을 위해 본문을 저장하지 않았습니다/)).toBeVisible();
    await expect(dialog.getByText(/공급사 접수 기록/)).toBeVisible();
    await expect(dialog.getByText(/group-provider-A12345/)).toBeVisible();
    expect(detailRequests).toContain(901);
  });

  test("상세를 열 때만 저장된 일반 본문을 조회한다", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    const detailRequests = await installMessagingLogApp(page);
    await openLog(page);

    expect(detailRequests).toEqual([]);
    await page.getByRole("button", { name: /김민서/ }).click();
    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByText("8월 24일 오후 3시 클리닉 예약이 완료되었습니다.")).toBeVisible();
    expect(detailRequests).toContain(902);
  });

  test("390px에서 로그와 상세가 가로로 잘리지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installMessagingLogApp(page);
    await openLog(page);

    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await expect(page.getByRole("button", { name: /김민서/ })).toBeVisible();
    await page.getByRole("button", { name: /김민서/ }).click();
    const dialog = page.getByRole("dialog").last();
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(391);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test("대시보드에서 알림톡 상태와 발송 내역 진입점을 함께 보여준다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await installMessagingLogApp(page);
    await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "commit", timeout: 60_000 });

    const card = page.getByRole("region", { name: "알림톡 발송 가능" });
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card.getByText("카카오 알림톡", { exact: true })).toBeVisible();
    await expect(card.getByText("정상", { exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "발송 내역" })).toBeVisible();
    await expect(card.getByRole("button", { name: "메시지 설정" })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(card).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

    await card.getByRole("button", { name: "발송 내역" }).click();
    await expect(page).toHaveURL(/\/workspace\/message\/log$/);
  });
});
