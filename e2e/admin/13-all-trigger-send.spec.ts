/**
 * 전 트리거 발송 UX — 실제 발송 전 확인 + 발송 내역 계약 확인
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { getSessionWithParticipants } from "../helpers/data";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/allsend-${name}.png`, fullPage: false });
}

test.describe("전 트리거 발송 UX", () => {
  test.setTimeout(120_000);

  test("1. 수업결과 발송 (성적 알림톡) — 최종 확인 전까지", async ({ page }) => {
    await loginViaUI(page, "admin");

    const session = await getSessionWithParticipants(page);
    if (!session) {
      test.info().annotations.push({ type: "skip-reason", description: "참여자 있는 차시 없음 — 수업결과 발송 UX 검증 무효" });
      return;
    }

    await page.goto(`${BASE}/admin/lectures/${session.lectureId}/sessions/${session.sessionId}/scores`, { timeout: 15000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    if (await page.getByText(/세션 정보를 불러올 수 없습니다|Not Found/).first().isVisible({ timeout: 1000 }).catch(() => false)) {
      test.info().annotations.push({ type: "skip-reason", description: "동적 차시 접근 불가 — 수업결과 발송 UX 검증 무효" });
      return;
    }

    // 학생 체크박스 선택
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (!(await checkbox.isVisible({ timeout: 10000 }).catch(() => false))) {
      test.info().annotations.push({ type: "skip-reason", description: "성적 페이지 체크박스 없음 — 수업결과 발송 UX 검증 무효" });
      return;
    }
    await checkbox.click();

    // "수업결과 발송" 버튼 — fail-fast
    const sendBtn = page.locator("button").filter({ hasText: "수업결과 발송" }).first();
    if (!(await sendBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.info().annotations.push({ type: "skip-reason", description: "수업결과 발송 버튼 미노출 — 차시/성적 미입력 환경" });
      return;
    }
    await sendBtn.click();
    await snap(page, "01-score-modal");

    // 1단계 모달: 직접 "발송하기"가 있거나, "N명에게 발송" → 확인 오버레이 "발송하기" 2단계.
    // 운영 전체 suite에서는 기존 학생에게 실제 발송하지 않고 최종 확인 UX까지만 검증한다.
    const directConfirm = page.locator("button").filter({ hasText: "발송하기" }).first();
    const mainSend = page.locator("button").filter({ hasText: /에게.*발송/ }).last();

    if (!(await directConfirm.isVisible({ timeout: 3000 }).catch(() => false))) {
      await expect(mainSend, "'N명에게 발송' 또는 '발송하기' 버튼이 보여야 함").toBeVisible({ timeout: 5000 });
      await mainSend.click();
    }
    const confirm2 = page.locator("button").filter({ hasText: "발송하기" }).first();
    await expect(confirm2, "확인 오버레이의 '발송하기' 버튼이 보여야 함").toBeVisible({ timeout: 5000 });
    const backBtn = page.locator("button").filter({ hasText: "돌아가기" }).first();
    await expect(backBtn, "운영 전체 suite에서는 실제 발송하지 않고 돌아갈 수 있어야 함").toBeVisible({ timeout: 5000 });
    await backBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await snap(page, "01-score-confirm-guard");
  });

  test("2. 발송 내역 확인 — 로그 API 계약", async ({ page }) => {
    const loginResp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: (process.env.E2E_ADMIN_USER || "admin97"), password: (process.env.E2E_ADMIN_PASS || "koreaseoul97"), tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    expect(loginResp.ok(), "admin 로그인 토큰 발급 성공").toBe(true);
    const { access } = await loginResp.json() as { access: string };

    const logResp = await page.request.get(`${API}/api/v1/messaging/log/?page_size=5&ordering=-sent_at`, {
      headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
    });
    expect(logResp.status()).toBe(200);
    const results = ((await logResp.json()) as {
      results?: Array<{ id: number; sent_at: string; success: boolean; message_mode: string; template_summary: string; message_body: string }>;
    }).results || [];

    for (const r of results.slice(0, 5)) {
      const tmplShort = r.template_summary?.slice(0, 20) || "?";
      console.log(`  id=${r.id} | ${r.sent_at?.slice(11, 19)} | ${r.message_mode} | success=${r.success} | tmpl=${tmplShort}`);
    }

    expect(results.length, "발송 내역 API는 최신 로그 목록을 반환해야 함").toBeGreaterThan(0);
    expect(results[0].message_mode || "", "발송 방식 필드").toMatch(/^(alimtalk|sms)?$/);
  });
});
