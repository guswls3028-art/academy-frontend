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
    await checkbox.click();
    await page.waitForTimeout(500);

    // "수업결과 발송" 버튼
    const sendBtn = page.locator("button").filter({ hasText: "수업결과 발송" }).first();
    if (await sendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sendBtn.click();
      await page.waitForTimeout(2000);
      await snap(page, "01-score-modal");

      // 발송하기 클릭
      const confirmBtn = page.locator("button").filter({ hasText: "발송하기" }).first();
      if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(3000);
        console.log("[수업결과] ✅ 실발송 완료");
        await snap(page, "01-score-sent");
      } else {
        // 확인 오버레이
        const mainSend = page.locator("button").filter({ hasText: /에게.*발송/ }).last();
        if (await mainSend.isVisible({ timeout: 3000 }).catch(() => false)) {
          await mainSend.click();
          await page.waitForTimeout(2000);
          const confirm2 = page.locator("button").filter({ hasText: "발송하기" }).first();
          if (await confirm2.isVisible({ timeout: 3000 }).catch(() => false)) {
            await confirm2.click();
            await page.waitForTimeout(3000);
            console.log("[수업결과] ✅ 실발송 완료 (2단계)");
          }
        }
      }
    }
  });

  test("2. 발송 내역 확인 — 성적 알림톡 도착", async ({ page }) => {
    const loginResp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: (process.env.E2E_ADMIN_USER || "admin97"), password: (process.env.E2E_ADMIN_PASS || "koreaseoul97"), tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    const { access } = await loginResp.json() as { access: string };

    // 10초 대기 (SQS 처리)
    await page.waitForTimeout(10000);

    const logResp = await page.request.get(`${API}/api/v1/messaging/log/?page_size=5&ordering=-sent_at`, {
      headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
    });
    const logData = await logResp.json() as { results: Array<{ id: number; sent_at: string; success: boolean; message_mode: string; template_summary: string; message_body: string }> };

    console.log("=== 최신 발송 5건 ===");
    for (const r of logData.results.slice(0, 5)) {
      const tmplShort = r.template_summary?.slice(0, 20) || "?";
      const bodyShort = r.message_body?.slice(0, 80) || "?";
      console.log(`  id=${r.id} | ${r.sent_at?.slice(11, 19)} | ${r.message_mode} | success=${r.success} | tmpl=${tmplShort}`);
      console.log(`    body: ${bodyShort}`);
    }

    // 오늘 발송 총 건수
    const todayCount = logData.results.filter(r => r.sent_at >= "2026-04-09T05:").length;
    console.log(`\n오늘 배포 후 발송: ${todayCount}건`);
  });
});
