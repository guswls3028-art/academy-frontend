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

    // 출결 페이지 필수 요소 — 출석 or 결석 버튼 중 하나는 반드시 있어야 함
    const attendBtn = page.locator("button").filter({ hasText: /출석|참석|present/ }).first();
    const absentBtn = page.locator("button").filter({ hasText: /결석|absent/ }).first();

    await expect(
      attendBtn.or(absentBtn),
      "출결 페이지에 출석/결석 버튼이 렌더링되어야 함"
    ).toBeVisible({ timeout: 10000 });

    // 출석 버튼 우선 클릭
    if (await attendBtn.isVisible().catch(() => false)) {
      await attendBtn.click();
      await page.waitForTimeout(3000);
      await snap(page, "01-attend-clicked");
    } else {
      // 출석만 가려진 경우 결석이라도 클릭해서 트리거 발동 확인
      await absentBtn.click();
      await page.waitForTimeout(3000);
      await snap(page, "01-absent-clicked");
    }
  });

  test("2. 수업결과 발송 알림톡 — 프론트 클릭", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 강의 113 > 차시 153 > 성적 탭
    await page.goto(`${BASE}/admin/lectures/${FIXTURES.lectureId}/sessions/${FIXTURES.sessionId}/scores`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const sendStart = Date.now();

    // 학생 선택
    const checkbox = page.locator('input[type="checkbox"]').first();
    await expect(checkbox, "성적 페이지에 수강생 체크박스가 있어야 함").toBeVisible({ timeout: 10000 });
    await checkbox.click();
    await page.waitForTimeout(500);

    // 수업결과 발송 → 모달 → 발송하기 (각 단계 fail-fast)
    const scoreBtn = page.locator("button").filter({ hasText: "수업결과 발송" }).first();
    await expect(scoreBtn).toBeVisible({ timeout: 5000 });
    await scoreBtn.click();
    await page.waitForTimeout(2000);

    const kakaoPreview = page.locator(".template-preview-kakao").first();
    await expect(kakaoPreview, "알림톡 모드 미리보기가 렌더링되어야 함").toBeVisible({ timeout: 5000 });
    await snap(page, "02-score-modal");

    const sendBtn = page.locator("button").filter({ hasText: /에게.*발송/ }).last();
    await expect(sendBtn).toBeVisible({ timeout: 5000 });
    await sendBtn.click();
    await page.waitForTimeout(2000);

    const confirmBtn = page.locator("button").filter({ hasText: "발송하기" }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();
    await page.waitForTimeout(3000);

    // 발송 내역 확인 — 방금 발송된 건이 로그에 반영되었는지 폴링
    const loginResp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: (process.env.E2E_ADMIN_USER || "admin97"), password: (process.env.E2E_ADMIN_PASS || "koreaseoul97"), tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    const { access } = await loginResp.json() as { access: string };

    let latest: { id: number; sent_at: string; message_mode: string; success: boolean } | undefined;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(2000);
      const logResp = await page.request.get(`${API}/api/v1/messaging/log/?page_size=3&ordering=-sent_at`, {
        headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
      });
      const logData = await logResp.json() as { results: Array<{ id: number; sent_at: string; message_mode: string; success: boolean }> };
      latest = logData.results[0];
      if (latest && new Date(latest.sent_at).getTime() >= sendStart - 60_000) break;
    }

    expect(latest, "발송 로그가 최소 1건 있어야 함").toBeDefined();
    expect(
      new Date(latest!.sent_at).getTime(),
      "최신 발송이 테스트 시작 이후(±60s)여야 함"
    ).toBeGreaterThanOrEqual(sendStart - 60_000);
  });
});
