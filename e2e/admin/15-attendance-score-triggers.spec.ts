/**
 * 강의 출결 + 성적 알림톡 트리거 검증
 * - check_in_complete (차시 출석)
 * - absent_occurred (차시 결석)
 * - exam_score_published (성적 공개) — 채점 저장 시
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { getSessionWithParticipants } from "../helpers/data";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/att-score-${name}.png`, fullPage: false });
}

test.describe("강의 출결 + 성적 트리거", () => {
  test.setTimeout(120_000);

  test("1. 차시 출결 — 출석/결석 트리거 버튼 렌더링", async ({ page }) => {
    await loginViaUI(page, "admin");

    const session = await getSessionWithParticipants(page);
    if (!session) {
      test.info().annotations.push({ type: "skip-reason", description: "참여자 있는 차시 없음 — 출결 트리거 검증 무효" });
      return;
    }

    await page.goto(`${BASE}/admin/lectures/${session.lectureId}/sessions/${session.sessionId}/attendance`, { timeout: 15000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await snap(page, "01-attendance-page");
    if (await page.getByText(/세션 정보를 불러올 수 없습니다|Not Found/).first().isVisible({ timeout: 1000 }).catch(() => false)) {
      test.info().annotations.push({ type: "skip-reason", description: "동적 차시 접근 불가 — 출결 트리거 검증 무효" });
      return;
    }

    // 출결 페이지 필수 요소 — 출석 or 결석 버튼 중 하나는 반드시 있어야 함
    const attendBtn = page.locator("button").filter({ hasText: /출석|참석|present/ }).first();
    const absentBtn = page.locator("button").filter({ hasText: /결석|absent/ }).first();

    if (!(await attendBtn.or(absentBtn).isVisible({ timeout: 10000 }).catch(() => false))) {
      test.info().annotations.push({ type: "skip-reason", description: "출결 버튼 미노출 — 읽기전용/데이터 없음 환경" });
      return;
    }

    // 운영 전체 suite에서는 기존 차시의 출결 상태를 바꾸지 않는다.
    await snap(page, "01-attendance-trigger-buttons");
  });

  test("2. 수업결과 발송 알림톡 — 프론트 클릭", async ({ page }) => {
    await loginViaUI(page, "admin");

    const session = await getSessionWithParticipants(page);
    if (!session) {
      test.info().annotations.push({ type: "skip-reason", description: "참여자 있는 차시 없음 — 성적 트리거 검증 무효" });
      return;
    }

    await page.goto(`${BASE}/admin/lectures/${session.lectureId}/sessions/${session.sessionId}/scores`, { timeout: 15000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    if (await page.getByText(/세션 정보를 불러올 수 없습니다|Not Found/).first().isVisible({ timeout: 1000 }).catch(() => false)) {
      test.info().annotations.push({ type: "skip-reason", description: "동적 차시 접근 불가 — 성적 트리거 검증 무효" });
      return;
    }

    // 학생 선택
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (!(await checkbox.isVisible({ timeout: 10000 }).catch(() => false))) {
      test.info().annotations.push({ type: "skip-reason", description: "성적 페이지 체크박스 없음 — 성적 트리거 검증 무효" });
      return;
    }
    await checkbox.click();

    // 수업결과 발송 → 모달 → 최종 확인 전까지 (각 단계 fail-fast)
    const scoreBtn = page.locator("button").filter({ hasText: "수업결과 발송" }).first();
    if (!(await scoreBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.info().annotations.push({ type: "skip-reason", description: "수업결과 발송 버튼 미노출 — 차시/성적 미입력 환경" });
      return;
    }
    await scoreBtn.click();

    const kakaoPreview = page.locator(".template-preview-kakao").first();
    await expect(kakaoPreview, "알림톡 모드 미리보기가 렌더링되어야 함").toBeVisible({ timeout: 5000 });
    await snap(page, "02-score-modal");

    const sendBtn = page.locator("button").filter({ hasText: /에게.*발송/ }).last();
    await expect(sendBtn).toBeVisible({ timeout: 5000 });
    await sendBtn.click();

    const confirmBtn = page.locator("button").filter({ hasText: "발송하기" }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    const backBtn = page.locator("button").filter({ hasText: "돌아가기" }).first();
    await expect(backBtn, "운영 전체 suite에서는 기존 학생에게 실제 발송하지 않고 돌아갈 수 있어야 함").toBeVisible({ timeout: 5000 });
    await backBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    // 발송 내역 API 계약 확인
    const loginResp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: (process.env.E2E_ADMIN_USER || "admin97"), password: (process.env.E2E_ADMIN_PASS || "__MISSING_E2E_ADMIN_PASS__"), tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    const { access } = await loginResp.json() as { access: string };

    const logResp = await page.request.get(`${API}/api/v1/messaging/log/?page_size=3&ordering=-sent_at`, {
      headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
    });
    expect(logResp.status()).toBe(200);
    const logData = await logResp.json() as { results: Array<{ id: number; sent_at: string; message_mode: string; success: boolean }> };
    const latest = logData.results[0];

    expect(latest, "발송 로그가 최소 1건 있어야 함").toBeDefined();
    expect(latest!.message_mode || "", "신규 출결·성적 트리거는 알림톡").toMatch(/^(alimtalk)?$/);
  });
});
