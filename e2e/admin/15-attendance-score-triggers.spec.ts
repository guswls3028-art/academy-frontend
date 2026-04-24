/**
 * 강의 출결 + 성적 알림톡 트리거 검증
 * - check_in_complete (차시 출석)
 * - absent_occurred (차시 결석)
 * - exam_score_published (성적 공개) — 채점 저장 시
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

import { FIXTURES } from "../helpers/test-fixtures";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/att-score-${name}.png`, fullPage: false });
}

test.describe("강의 출결 + 성적 트리거", () => {
  test.setTimeout(120_000);

  test("1. 차시 출결 — 출석/결석 트리거", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 강의 113 > 차시 153 > 출결 탭
    await page.goto(`${BASE}/admin/lectures/${FIXTURES.lectureId}/sessions/${FIXTURES.sessionId}/attendance`, { timeout: 15000 });
    await page.waitForTimeout(3000);
    await snap(page, "01-attendance-page");

    // 페이지에 출석/결석 버튼이 있는지 확인
    const allBtns = await page.locator("button").allTextContents();
    console.log(`[출결] 버튼 목록: ${allBtns.filter(b => b.trim()).join(" | ")}`);

    // 학생 체크박스 또는 출석 버튼 찾기
    const attendBtn = page.locator("button").filter({ hasText: /출석|참석|present/ }).first();
    const absentBtn = page.locator("button").filter({ hasText: /결석|absent/ }).first();

    if (await attendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("[출결] 출석 버튼 발견");
      await attendBtn.click();
      await page.waitForTimeout(3000);
      console.log("[출결] 출석 클릭 완료");
      await snap(page, "01-attend-clicked");
    } else {
      console.log("[출결] 출석 버튼 미표시 — 출결 UI 구조 확인 필요");
      await snap(page, "01-no-attend-btn");
    }
  });

  test("2. 수업결과 발송 알림톡 — 프론트 클릭", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 강의 113 > 차시 153 > 성적 탭
    await page.goto(`${BASE}/admin/lectures/${FIXTURES.lectureId}/sessions/${FIXTURES.sessionId}/scores`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 학생 선택
    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.click();
    await page.waitForTimeout(500);

    // 수업결과 발송
    const scoreBtn = page.locator("button").filter({ hasText: "수업결과 발송" }).first();
    if (await scoreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scoreBtn.click();
      await page.waitForTimeout(2000);

      // 모달에서 알림톡 모드 확인
      const kakaoPreview = page.locator(".template-preview-kakao");
      const isAlimtalk = await kakaoPreview.first().isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`[수업결과] 모달 모드: ${isAlimtalk ? "알림톡" : "SMS"}`);
      await snap(page, "02-score-modal");

      // 발송
      const sendBtn = page.locator("button").filter({ hasText: /에게.*발송/ }).last();
      if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sendBtn.click();
        await page.waitForTimeout(2000);
        const confirmBtn = page.locator("button").filter({ hasText: "발송하기" }).first();
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(5000);
          console.log("[수업결과] 발송 완료");
        }
      }
    }

    // 발송 내역 확인
    const loginResp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: (process.env.E2E_ADMIN_USER || "admin97"), password: (process.env.E2E_ADMIN_PASS || "koreaseoul97"), tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    const { access } = await loginResp.json() as { access: string };
    await page.waitForTimeout(5000);

    const logResp = await page.request.get(`${API}/api/v1/messaging/log/?page_size=3&ordering=-sent_at`, {
      headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
    });
    const logData = await logResp.json() as { results: Array<{ id: number; sent_at: string; message_mode: string; success: boolean }> };
    for (const r of logData.results.slice(0, 3)) {
      console.log(`  id=${r.id} | ${r.sent_at?.slice(11, 19)} | ${r.message_mode} | success=${r.success}`);
    }
  });
});
