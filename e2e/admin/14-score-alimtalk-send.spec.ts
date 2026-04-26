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
    await expect(checkbox, "성적 페이지에 수강생 체크박스가 있어야 함").toBeVisible({ timeout: 10000 });
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

    // 알림톡/SMS 토글 버튼 렌더링 검증
    const alimBtn = page.locator("button").filter({ hasText: "알림톡" }).first();
    const smsBtn = page.locator("button").filter({ hasText: "SMS" }).first();
    await expect(alimBtn).toBeVisible({ timeout: 5000 });
    await expect(smsBtn).toBeVisible({ timeout: 5000 });

    // 알림톡 모드 — 카카오 미리보기 필수
    await page.screenshot({ path: "e2e/screenshots/score-alimtalk-mode.png" });
    const kakaoPreview = page.locator(".template-preview-kakao").first();
    await expect(
      kakaoPreview,
      "알림톡 모드에서 카카오 미리보기가 렌더링되어야 함"
    ).toBeVisible({ timeout: 5000 });

    // 발송 버튼 클릭 — 없으면 실패
    const sendBtn = page.locator("button").filter({ hasText: /에게.*발송/ }).last();
    await expect(sendBtn, "'N명에게 발송' 버튼이 보여야 함").toBeVisible({ timeout: 5000 });
    await sendBtn.click();
    await page.waitForTimeout(2000);

    // 확인 오버레이 — 발송하기 버튼 필수
    const confirmBtn = page.locator("button").filter({ hasText: "발송하기" }).first();
    await expect(confirmBtn, "확인 오버레이의 '발송하기' 버튼이 보여야 함").toBeVisible({ timeout: 5000 });
    await confirmBtn.click();
    await page.waitForTimeout(5000);

    await page.screenshot({ path: "e2e/screenshots/score-alimtalk-sent.png" });

    // 발송 내역 확인
    const loginResp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: (process.env.E2E_ADMIN_USER || "admin97"), password: (process.env.E2E_ADMIN_PASS || "koreaseoul97"), tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    const { access } = await loginResp.json() as { access: string };

    // SQS 처리 대기 (최대 20초 폴링)
    let logData: { results: Array<{ id: number; sent_at: string; success: boolean; message_mode: string; message_body: string }> } = { results: [] };
    const sendStart = Date.now();
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(2000);
      const logResp = await page.request.get(`${API}/api/v1/messaging/log/?page_size=5&ordering=-sent_at`, {
        headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
      });
      logData = await logResp.json();
      const latest = logData.results[0];
      if (latest && new Date(latest.sent_at).getTime() >= sendStart - 60_000) break;
    }

    for (const r of logData.results.slice(0, 3)) {
      console.log(`  id=${r.id} | ${r.sent_at?.slice(11, 19)} | mode=${r.message_mode} | success=${r.success}`);
    }

    // 핵심 검증: 최신 발송 로그 존재 + alimtalk 모드
    const latest = logData.results[0];
    expect(latest, "발송 로그가 최소 1건 있어야 함").toBeDefined();
    expect(
      new Date(latest.sent_at).getTime(),
      "최신 발송이 테스트 시작 이후(±60s)여야 함"
    ).toBeGreaterThanOrEqual(sendStart - 60_000);
    expect(latest.message_mode).toBe("alimtalk");
  });
});
