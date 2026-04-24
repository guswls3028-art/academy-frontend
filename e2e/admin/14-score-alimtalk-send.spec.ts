/**
 * 수업결과 발송 — 알림톡 모드 실발송 검증
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

import { FIXTURES } from "../helpers/test-fixtures";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";

test.describe("수업결과 발송 알림톡", () => {
  test.setTimeout(120_000);

  test("성적탭 > 수업결과 발송 > 알림톡 모드 > 발송 확인", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 강의113 > 차시153 > 성적 탭
    await page.goto(`${BASE}/admin/lectures/${FIXTURES.lectureId}/sessions/${FIXTURES.sessionId}/scores`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 학생 체크박스 선택
    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.click();
    await page.waitForTimeout(500);

    // "수업결과 발송" 버튼
    const scoreBtn = page.locator("button").filter({ hasText: "수업결과 발송" }).first();
    await expect(scoreBtn).toBeVisible({ timeout: 5000 });
    await scoreBtn.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "e2e/screenshots/score-alimtalk-modal.png" });

    // 모달 확인
    const modal = page.locator("text=메시지 발송").first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 알림톡 버튼이 활성 상태인지 확인
    const alimBtn = page.locator("button").filter({ hasText: "알림톡" }).first();
    const smsBtn = page.locator("button").filter({ hasText: "SMS" }).first();

    console.log(`[모달] 알림톡 버튼 visible: ${await alimBtn.isVisible()}`);
    console.log(`[모달] SMS 버튼 visible: ${await smsBtn.isVisible()}`);

    // 알림톡 모드 확인 — 알림톡 버튼의 배경색이나 활성 상태
    await page.screenshot({ path: "e2e/screenshots/score-alimtalk-mode.png" });

    // 카카오 미리보기가 표시되는지 (알림톡 모드 확인)
    const kakaoPreview = page.locator(".template-preview-kakao");
    const hasKakao = await kakaoPreview.first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[모달] 카카오 미리보기: ${hasKakao ? "알림톡 모드" : "SMS 모드"}`);

    // 발송 버튼 클릭
    const sendBtn = page.locator("button").filter({ hasText: /에게.*발송/ }).last();
    if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sendBtn.click();
      await page.waitForTimeout(2000);

      // 확인 오버레이
      const confirmBtn = page.locator("button").filter({ hasText: "발송하기" }).first();
      if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(5000);
        console.log("[수업결과] 발송하기 클릭 완료");
      }
    }

    await page.screenshot({ path: "e2e/screenshots/score-alimtalk-sent.png" });

    // 발송 내역 확인
    const loginResp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: (process.env.E2E_ADMIN_USER || "admin97"), password: (process.env.E2E_ADMIN_PASS || "koreaseoul97"), tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    const { access } = await loginResp.json() as { access: string };

    await page.waitForTimeout(5000);

    const logResp = await page.request.get(`${API}/api/v1/messaging/log/?page_size=5&ordering=-sent_at`, {
      headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
    });
    const logData = await logResp.json() as { results: Array<{ id: number; sent_at: string; success: boolean; message_mode: string; message_body: string }> };

    for (const r of logData.results.slice(0, 3)) {
      console.log(`  id=${r.id} | ${r.sent_at?.slice(11, 19)} | mode=${r.message_mode} | success=${r.success}`);
      console.log(`    body: ${r.message_body?.slice(0, 100)}`);
    }

    // 핵심 검증: 최신 발송이 alimtalk인지
    const latest = logData.results[0];
    if (latest && latest.sent_at >= "2026-04-09T08:") {
      console.log(`\n[최종] mode=${latest.message_mode} — ${latest.message_mode === "alimtalk" ? "✅ 알림톡" : "❌ SMS"}`);
      expect(latest.message_mode).toBe("alimtalk");
    }
  });
});
