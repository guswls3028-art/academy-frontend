import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const NOW = new Date("2026-09-01T10:00:00+09:00");

test.use({ serviceWorkers: "block" });

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function seed(page: Page) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "클리닉 메시지 route-mock 검증은 로컬 dev 서버 전용",
  );
  await page.clock.setFixedTime(NOW);
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
}

async function installApi(page: Page, verifyQueries: string[]) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({ tenantCode: "hakwonplus", display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true });
    }
    if (path === "/core/me/") {
      return json({ id: 12, username: "admin", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin" });
    }
    if (path === "/staffs/currently-working/") return json([]);
    if (path === "/messaging/info/") {
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
    if (path === "/messaging/auto-send/") {
      return json([{
        id: 501,
        trigger: "clinic_reminder",
        template: 301,
        template_name: "클리닉 안내 문구",
        template_subject: "클리닉 안내",
        template_body: "준비물을 확인해 주세요.",
        template_solapi_status: "APPROVED",
        effective_template_solapi_status: "APPROVED",
        effective_template_source: "unified",
        effective_template_is_approved: true,
        effective_template_type: "clinic_info",
        template_is_system: false,
        enabled: true,
        message_mode: "alimtalk",
        minutes_before: 30,
        created_at: "2026-09-01T08:00:00+09:00",
        updated_at: "2026-09-01T08:00:00+09:00",
      }]);
    }
    if (path === "/messaging/templates/301/") {
      return json({
        id: 301,
        category: "clinic",
        name: "클리닉 안내 문구",
        subject: "클리닉 안내",
        body: "준비물을 확인해 주세요.",
        is_system: false,
        is_user_default: true,
        solapi_template_id: "approved-clinic-envelope",
        solapi_status: "APPROVED",
        has_content_var: true,
        alimtalk_envelope_type: "clinic_info",
        alimtalk_readiness: "ready",
        created_at: "2026-09-01T08:00:00+09:00",
        updated_at: "2026-09-01T08:00:00+09:00",
      });
    }
    if (path === "/messaging/templates/") return json([]);
    if (path === "/messaging/log/" && request.method() === "GET") {
      expect(url.searchParams.get("scope")).toBe("clinic");
      return json({
        count: 4,
        results: [
          {
            id: 101, sent_at: "2026-09-01T09:58:00+09:00", success: true, status: "sent",
            recipient_summary: "학생 1명", template_summary: "클리닉 예약 안내",
            provider_evidence: true, provider_delivery_status: "provider_accepted",
          },
          {
            id: 102, sent_at: "2026-09-01T09:56:00+09:00", success: true, status: "sent",
            recipient_summary: "학부모 1명", template_summary: "클리닉 변경 안내",
            provider_evidence: true, provider_delivery_status: "delivered",
            provider_delivery_checked_at: "2026-09-01T09:57:00+09:00",
          },
          {
            id: 103, sent_at: "2026-09-01T09:54:00+09:00", success: false, status: "failed",
            recipient_summary: "학생 1명", template_summary: "클리닉 재촉",
            failure_code: "temporary_failure", failure_reason: "일시적인 연결 문제로 발송을 완료하지 못했습니다.",
          },
          {
            id: 104, sent_at: "2026-09-01T09:52:00+09:00", success: false, status: "failed",
            recipient_summary: "학부모 1명", template_summary: "클리닉 결석 안내",
            failure_code: "template_unavailable", failure_reason: "승인된 알림톡 양식이 없어 발송하지 않았습니다.",
          },
        ],
      });
    }
    if (path === "/messaging/scheduled/" && request.method() === "GET") {
      expect(url.searchParams.get("scope")).toBe("clinic");
      return json({
        count: 4,
        results: [
          { id: 201, trigger: "clinic_reminder", send_at: "2026-09-01T11:00:00+09:00", status: "pending", recipient_summary: "학생 1명", message_preview: "예약 재촉", target_type: "clinic", target_id: "", target_name: "", message_mode: "alimtalk", created_at: "2026-09-01T09:40:00+09:00", sent_at: null, error_message: "" },
          { id: 202, trigger: "clinic_reminder", send_at: "2026-09-01T09:45:00+09:00", status: "pending", recipient_summary: "학생 1명", message_preview: "발송 대기", target_type: "clinic", target_id: "", target_name: "", message_mode: "alimtalk", created_at: "2026-09-01T09:30:00+09:00", sent_at: null, error_message: "" },
          { id: 203, trigger: "clinic_reminder", send_at: "2026-09-01T09:35:00+09:00", status: "dispatching", recipient_summary: "학생 1명", message_preview: "전송 작업", target_type: "clinic", target_id: "", target_name: "", message_mode: "alimtalk", created_at: "2026-09-01T09:20:00+09:00", sent_at: null, error_message: "" },
          { id: 204, trigger: "clinic_reminder", send_at: "2026-09-01T09:15:00+09:00", status: "cancelled", recipient_summary: "학생 1명", message_preview: "취소한 예약", target_type: "clinic", target_id: "", target_name: "", message_mode: "alimtalk", created_at: "2026-09-01T09:00:00+09:00", sent_at: null, error_message: "" },
        ],
      });
    }
    if (path === "/messaging/log/101/" && request.method() === "GET") {
      verifyQueries.push(url.search);
      return json({
        id: 101, sent_at: "2026-09-01T09:58:00+09:00", success: true, status: "sent",
        recipient_summary: "학생 1명", template_summary: "클리닉 예약 안내",
        provider_evidence: true, provider_delivery_status: "delivered", provider_status_code: "4000",
        provider_delivery_checked_at: "2026-09-01T10:01:00+09:00",
        provider_delivery_updated_at: "2026-09-01T09:59:00+09:00",
      });
    }
    return json({ count: 0, results: [] });
  });
}

test("클리닉 알림 설정은 예약부터 최종 전달까지 상태를 구분하고 공급사 결과만 읽기 확인한다", async ({ page }) => {
  const verifyQueries: string[] = [];
  await seed(page);
  await installApi(page, verifyQueries);
  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/msg-settings`, { timeout: 45_000 });

  const panel = page.getByRole("region", { name: "클리닉 알림톡 기록" });
  await expect(panel).toBeVisible({ timeout: 30_000 });
  for (const label of ["예약", "대기", "전송 중", "공급사 접수", "최종 전달", "실패", "취소", "발송 안 함"]) {
    await expect(panel.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(panel).toContainText("하원 처리는 알림톡을 보내지 않습니다.");
  await expect(panel).toContainText("고정 문구·변수는 읽기 전용");
  await expect(page.getByText(/SMS|LMS/)).toHaveCount(0);

  const reminderCard = page.locator('[data-channel-active="true"]').filter({ hasText: "클리닉 시작 N분 전" });
  await reminderCard.getByRole("button", { name: /^수정하기/ }).click();
  const editor = page.getByRole("dialog").filter({ hasText: "문구 수정" });
  await expect(editor.getByText("자동으로 들어가는 정보", { exact: true })).toBeVisible();
  await expect(editor.getByText("학원이름", { exact: true })).toBeVisible();
  await expect(editor.getByText("학생이름", { exact: true })).toBeVisible();
  await expect(editor.getByText("아래 본문에 안내문만 작성하면 됩니다.", { exact: true })).toBeVisible();
  await expect(editor.locator("textarea")).toBeEnabled();
  await expect(editor.locator("textarea")).toHaveValue("준비물을 확인해 주세요.");
  await expect(editor.getByRole("button", { name: /학원이름|학생이름|클리닉 장소|클리닉 날짜|클리닉 시간/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await panel.getByRole("button", { name: "최종 상태 확인" }).click();
  await expect.poll(() => verifyQueries).toEqual(["?verify_provider=true"]);
  await expect(panel.getByText("공급사 접수", { exact: true })).toHaveCount(0);
  await expect(panel.getByText("최종 전달", { exact: true })).toHaveCount(2);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await panel.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
});
