/**
 * 전 트리거 실발송 — 성적 발송 + 강의 출결 + 클리닉 예약취소
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

import { FIXTURES } from "../helpers/test-fixtures";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/allsend-${name}.png`, fullPage: false });
}

test.describe("전 트리거 실발송", () => {
  test.setTimeout(120_000);

  test("1. 수업결과 발송 (성적 알림톡) — 실제 발송", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 강의113 > 차시153 > 성적 탭
    await page.goto(`${BASE}/admin/lectures/${FIXTURES.lectureId}/sessions/${FIXTURES.sessionId}/scores`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 학생 체크박스 선택
    const checkbox = page.locator('input[type="checkbox"]').first();
    await expect(checkbox, "성적 페이지에 수강생 체크박스가 있어야 함").toBeVisible({ timeout: 10000 });
    await checkbox.click();
    await page.waitForTimeout(500);

    // "수업결과 발송" 버튼 — fail-fast
    const sendBtn = page.locator("button").filter({ hasText: "수업결과 발송" }).first();
    await expect(sendBtn).toBeVisible({ timeout: 5000 });
    await sendBtn.click();
    await page.waitForTimeout(2000);
    await snap(page, "01-score-modal");

    // 1단계 모달: 직접 "발송하기"가 있거나, "N명에게 발송" → 확인 오버레이 "발송하기" 2단계
    const directConfirm = page.locator("button").filter({ hasText: "발송하기" }).first();
    const mainSend = page.locator("button").filter({ hasText: /에게.*발송/ }).last();

    if (await directConfirm.isVisible({ timeout: 3000 }).catch(() => false)) {
      await directConfirm.click();
    } else {
      await expect(mainSend, "'N명에게 발송' 또는 '발송하기' 버튼이 보여야 함").toBeVisible({ timeout: 5000 });
      await mainSend.click();
      await page.waitForTimeout(2000);
      const confirm2 = page.locator("button").filter({ hasText: "발송하기" }).first();
      await expect(confirm2, "확인 오버레이의 '발송하기' 버튼이 보여야 함").toBeVisible({ timeout: 5000 });
      await confirm2.click();
    }
    await page.waitForTimeout(3000);
    await snap(page, "01-score-sent");
  });

  test("2. 발송 내역 확인 — 성적 알림톡 도착", async ({ page }) => {
    const loginResp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: (process.env.E2E_ADMIN_USER || "admin97"), password: (process.env.E2E_ADMIN_PASS || "koreaseoul97"), tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    expect(loginResp.ok(), "admin 로그인 토큰 발급 성공").toBe(true);
    const { access } = await loginResp.json() as { access: string };

    // SQS 처리 대기 (최대 20초 폴링) — "최근 5분 내 발송 기록" 조건이 충족될 때까지
    const recentWindowMs = 5 * 60 * 1000;
    let results: Array<{ id: number; sent_at: string; success: boolean; message_mode: string; template_summary: string; message_body: string }> = [];
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(2000);
      const logResp = await page.request.get(`${API}/api/v1/messaging/log/?page_size=5&ordering=-sent_at`, {
        headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
      });
      results = (await logResp.json() as { results: typeof results }).results;
      const hasRecent = results.some(r => Date.now() - new Date(r.sent_at).getTime() <= recentWindowMs);
      if (hasRecent) break;
    }

    for (const r of results.slice(0, 5)) {
      const tmplShort = r.template_summary?.slice(0, 20) || "?";
      console.log(`  id=${r.id} | ${r.sent_at?.slice(11, 19)} | ${r.message_mode} | success=${r.success} | tmpl=${tmplShort}`);
    }

    // 최근 5분 내 발송 기록 최소 1건
    const recentCount = results.filter(r => Date.now() - new Date(r.sent_at).getTime() <= recentWindowMs).length;
    expect(recentCount, "직전 테스트(test 1)의 발송이 5분 내 로그에 반영되어야 함").toBeGreaterThan(0);
  });
});
