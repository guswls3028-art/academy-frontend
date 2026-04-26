/**
 * DNB 아카데미 (tenant 9) -- 클리닉/커뮤니티/메시징 운영 E2E 검증
 * clinic_mode=remediation, section_mode=false
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";
import type { Page } from "@playwright/test";

const DNB_BASE = getBaseUrl("dnb-admin");

/** Collect console errors and failed network requests */
function attachErrorCollectors(page: Page) {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    const status = resp.status();
    if (status >= 400) {
      networkErrors.push(`${status} ${resp.url()}`);
    }
  });

  return { consoleErrors, networkErrors };
}

/** 페이지 진입 + 5xx 검증을 한꺼번에. */
async function visitAndAssertNo5xx(page: Page, path: string, screenshot: string) {
  const { networkErrors } = attachErrorCollectors(page);
  await gotoAndSettle(page, `${DNB_BASE}${path}`, { settleMs: 1500 });
  await page.screenshot({ path: `e2e/screenshots/${screenshot}.png` });

  await expect(page.locator("body")).toBeVisible();
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.length).toBeGreaterThan(10);

  const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
  expect(critical5xx, `5xx errors on ${path}: ${critical5xx.join(", ")}`).toHaveLength(0);
}

test.describe("DNB 클리닉/커뮤니티/메시징 검증", () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "dnb-admin");
  });

  // ===== CLINIC =====

  test("1. 클리닉 홈 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/clinic/home", "dnb-clinic-home");
  });

  test("2. 클리닉 운영 콘솔 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/clinic/operations", "dnb-clinic-operations");
  });

  test("3. 클리닉 예약 관리 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/clinic/bookings", "dnb-clinic-bookings");
  });

  test("4. 클리닉 리포트 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/clinic/reports", "dnb-clinic-reports");
  });

  test("5. 클리닉 설정 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/clinic/settings", "dnb-clinic-settings");
  });

  test("6. 클리닉 메시지 설정 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/clinic/msg-settings", "dnb-clinic-msg-settings");
  });

  test("7. 도구 > 클리닉 출력 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/tools/clinic", "dnb-tools-clinic");
  });

  // ===== COMMUNITY =====

  test("8. 게시판 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/community/board", "dnb-community-board");
  });

  test("9. 공지사항 렌더링 + 공지 추가 버튼", async ({ page }) => {
    const { networkErrors } = attachErrorCollectors(page);
    await gotoAndSettle(page, `${DNB_BASE}/admin/community/notice`, { settleMs: 1500 });
    await page.screenshot({ path: "e2e/screenshots/dnb-community-notice.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    // 공지 추가 버튼 — 1개 이상 노출 (공지 등록 입구).
    const addBtn = page.locator("button").filter({ hasText: /추가|작성|등록|새|공지/ }).first();
    await expect(addBtn, "공지사항 페이지에 추가/작성/등록 버튼이 보여야 함").toBeVisible({ timeout: 5_000 });

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx).toHaveLength(0);
  });

  test("10. QnA 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/community/qna", "dnb-community-qna");
  });

  test("11. 상담 (커뮤니티) 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/community/counsel", "dnb-community-counsel");
  });

  test("12. 자료실 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/community/materials", "dnb-community-materials");
  });

  test("13. 커뮤니티 설정 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/community/settings", "dnb-community-settings");
  });

  // ===== MESSAGING =====

  test("14. 메시지 템플릿 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/message/templates", "dnb-message-templates");
  });

  test("15. 자동발송 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/message/auto-send", "dnb-message-auto-send");
  });

  test("16. 발송내역 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/message/log", "dnb-message-log");
  });

  test("17. 메시지 설정 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/message/settings", "dnb-message-settings");
  });

  // ===== COUNSEL (standalone) =====

  test("18. 상담 페이지 렌더링", async ({ page }) => {
    await visitAndAssertNo5xx(page, "/admin/counsel", "dnb-counsel");
  });
});
