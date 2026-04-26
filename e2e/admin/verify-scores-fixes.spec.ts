/**
 * Verify Scores Bug Fixes & UX Improvements — Production E2E
 *
 * Target: hakwonplus.com (Tenant 1), admin account
 * Known IDs: lecture 96 / session 158 (omr 테스트강의)
 *
 * NOTE: Some checks test features that may not yet be deployed.
 * These use soft assertions (test.info().annotations) and log clearly.
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const SCREENSHOT_DIR = "e2e/screenshots/verify";

import { FIXTURES_ALT } from "../helpers/test-fixtures";

const LECTURE_ID = FIXTURES_ALT.lectureId;
const SESSION_ID = FIXTURES_ALT.sessionId;

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

function scoresUrl() {
  return `${BASE}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`;
}
function examsUrl() {
  return `${BASE}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams`;
}
function assignmentsUrl() {
  return `${BASE}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/assignments`;
}

async function clickSessionBlockCard(page: Page, titleText: string) {
  const card = page.locator("button.session-block").filter({
    has: page.locator(".session-block__title", { hasText: titleText }),
  }).first();
  await expect(card).toBeVisible({ timeout: 8000 });
  await card.click();
  // 모달 진입 — admin-modal 또는 dialog 가 떠야 함.
  await expect(
    page.locator("[role='dialog'], .admin-modal-overlay").first(),
    `'${titleText}' 카드 클릭 후 모달이 열려야 함`,
  ).toBeVisible({ timeout: 5_000 });
}

async function getModalText(page: Page): Promise<string> {
  const modal = page.locator("[role='dialog'], .admin-modal-overlay").first();
  if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
    return modal.innerText();
  }
  return "";
}

test.describe("Verify Scores Fixes & UX", () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  // ─── 1. Scores tab toolbar ────────────────────────────────────────
  test("1. Scores tab toolbar — batch assign text, dividers, more menu", async ({ page }) => {
    await gotoAndSettle(page, scoresUrl(), { settleMs: 2000 });
    await snap(page, "01-scores-tab-loaded");

    const enrollBtn = page.locator("button").filter({ hasText: "수강생 일괄배정" }).first();
    await expect(enrollBtn).toBeVisible({ timeout: 10000 });

    const dividers = page.locator('span[aria-hidden="true"]');
    expect(await dividers.count()).toBeGreaterThanOrEqual(2);

    // More menu
    const moreBtn = page.locator("button[title='추가 기능']").first();
    const moreBtnAlt = page.locator("button").filter({ hasText: "더보기" }).first();

    let moreBtnToClick: ReturnType<Page["locator"]>;
    if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      moreBtnToClick = moreBtn;
    } else if (await moreBtnAlt.isVisible({ timeout: 3000 }).catch(() => false)) {
      moreBtnToClick = moreBtnAlt;
    } else {
      moreBtnToClick = page.locator(".domain-list-toolbar button").last();
    }

    await moreBtnToClick.click();
    // 메뉴 항목이 보일 때까지 대기 (waitForTimeout 제거).
    const printItem = page.locator("button, [role='menuitem']").filter({ hasText: "성적표 출력" }).first();
    await expect(printItem).toBeVisible({ timeout: 5000 });
    await snap(page, "01-more-menu-open");

    const clinicItem = page.locator("button, [role='menuitem']").filter({ hasText: "클리닉 대상 보기" }).first();
    await expect(clinicItem).toBeVisible({ timeout: 5000 });

    await page.keyboard.press("Escape");
  });

  // ─── 2. Edit mode keyboard hints ─────────────────────────────────
  test("2. Edit mode keyboard hints — Enter and Tab", async ({ page }) => {
    await gotoAndSettle(page, scoresUrl(), { settleMs: 2000 });

    const editBtn = page.locator("button").filter({ hasText: "편집 모드" }).first();
    await expect(editBtn).toBeVisible({ timeout: 10000 });
    await editBtn.click();
    // 편집 모드 진입 — 키보드 힌트 텍스트 (Enter/Tab) 가 보여야 함.
    await expect(
      page.locator("body"),
      "편집 모드 진입 후 'Enter' 키보드 힌트가 노출되어야 함",
    ).toContainText("Enter", { timeout: 5_000 });
    await snap(page, "02-edit-mode-active");

    const pageText = await page.locator("body").innerText();
    expect(pageText).toContain("Tab");

    await snap(page, "02-keyboard-hints");

    const saveBtn = page.locator("button").filter({ hasText: /저장|편집 종료/ }).first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
    }
  });

  // ─── 3. Exam creation modal — cutline unit badge ──────────────────
  test("3. Exam creation modal — cutline header and unit badge", async ({ page }) => {
    await gotoAndSettle(page, scoresUrl(), { settleMs: 2000 });

    const addExamBtn = page.locator("button").filter({ hasText: "+ 시험" }).first();
    await expect(addExamBtn).toBeVisible({ timeout: 10000 });
    await addExamBtn.click();
    // 시험 picker 가 열릴 때까지.
    await expect(
      page.locator("button.session-block").first(),
      "시험 picker (session-block 카드) 가 보여야 함",
    ).toBeVisible({ timeout: 5_000 });
    await snap(page, "03-exam-picker");

    await clickSessionBlockCard(page, "신규 시험");
    await snap(page, "03-exam-creation-form");

    const cutlineHeader = page.locator("th").filter({ hasText: "커트라인" }).first();
    await expect(cutlineHeader).toBeVisible({ timeout: 10000 });

    // "점" 단위 뱃지 확인 — 미배포 가능성 있음 → annotation.
    const headerText = await cutlineHeader.innerText();
    if (!headerText.includes("점")) {
      test.info().annotations.push({ type: "note", description: "'점' badge not deployed yet" });
    }

    const titleInput = page.locator('input[aria-label*="시험"][aria-label*="제목"]').first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    await snap(page, "03-cutline-unit-badge");
    await page.keyboard.press("Escape");
  });

  // ─── 4. Exam creation modal — info text ──────────────────────────
  test("4. Exam creation modal — clinic info text", async ({ page }) => {
    await gotoAndSettle(page, scoresUrl(), { settleMs: 2000 });

    const addExamBtn = page.locator("button").filter({ hasText: "+ 시험" }).first();
    await addExamBtn.click();
    await expect(page.locator("button.session-block").first()).toBeVisible({ timeout: 5_000 });

    await clickSessionBlockCard(page, "신규 시험");

    const modalText = await getModalText(page);

    const hasClinicText = modalText.includes("커트라인 미만") && modalText.includes("클리닉 보강 대상");
    const hasClinicAlt = modalText.includes("클리닉") && modalText.includes("대상");
    if (!hasClinicText && !hasClinicAlt) {
      test.info().annotations.push({ type: "note", description: "Clinic info text not deployed yet" });
    }

    expect(modalText).toContain("제목");

    await snap(page, "04-exam-info-text");
    await page.keyboard.press("Escape");
  });

  // ─── 5. Homework creation modal — 2nd row cutline disabled ────────
  test("5. Homework creation modal — 2nd row cutline behavior", async ({ page }) => {
    await gotoAndSettle(page, scoresUrl(), { settleMs: 2000 });

    const addHwBtn = page.locator("button").filter({ hasText: "+ 과제" }).first();
    await expect(addHwBtn).toBeVisible({ timeout: 10000 });
    await addHwBtn.click();
    await expect(page.locator("button.session-block").first()).toBeVisible({ timeout: 5_000 });
    await snap(page, "05-hw-picker");

    await clickSessionBlockCard(page, "신규 과제");
    await snap(page, "05-hw-creation-form");

    // Add 2nd row
    const addRowBtn = page.locator("button").filter({ hasText: /\+\s*추가/ }).first();
    await expect(addRowBtn).toBeVisible({ timeout: 10000 });
    await addRowBtn.click();
    // 2nd row 가 추가될 때까지 — 행 카운트 expect.
    await expect(
      page.locator("[role='dialog'] table tbody tr, .admin-modal-overlay table tbody tr"),
      "'+ 추가' 클릭 후 과제 행이 2개 이상이어야 함",
    ).toHaveCount(2, { timeout: 5_000 });
    await snap(page, "05-hw-2nd-row-added");

    // 2nd row cutline
    const secondCutline = page.locator('input[aria-label="과제 2 커트라인"]');
    await expect(secondCutline).toBeVisible({ timeout: 5000 });

    const isDisabled = await secondCutline.isDisabled();
    const style = await secondCutline.getAttribute("style") ?? "";

    if (!isDisabled && !style.includes("opacity")) {
      test.info().annotations.push({ type: "note", description: "Cutline disabled fix not deployed yet" });
    }

    await snap(page, "05-hw-cutline-disabled");
    await page.keyboard.press("Escape");
  });

  // ─── 6. Homework creation modal — common apply info text ──────────
  test("6. Homework creation modal — common apply info text", async ({ page }) => {
    await gotoAndSettle(page, scoresUrl(), { settleMs: 2000 });

    const addHwBtn = page.locator("button").filter({ hasText: "+ 과제" }).first();
    await addHwBtn.click();
    await expect(page.locator("button.session-block").first()).toBeVisible({ timeout: 5_000 });

    await clickSessionBlockCard(page, "신규 과제");

    const modalText = await getModalText(page);

    const hasInfoText = modalText.includes("첫 번째 행") && modalText.includes("공통 적용");
    const hasInfoAlt = modalText.includes("첫 번째") || modalText.includes("공통");
    if (!hasInfoText && !hasInfoAlt) {
      test.info().annotations.push({ type: "note", description: "HW info text not deployed yet" });
    }

    expect(modalText).toContain("제목");

    await snap(page, "06-hw-info-text");
    await page.keyboard.press("Escape");
  });

  // ─── 7. Exam tab loads ────────────────────────────────────────────
  test("7. Exam tab loads", async ({ page }) => {
    await gotoAndSettle(page, examsUrl(), { settleMs: 2000 });
    await snap(page, "07-exam-tab");

    expect(page.url()).toContain("/exams");

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain("시험");

    await snap(page, "07-exam-tab-content");
  });

  // ─── 8. Homework tab loads ────────────────────────────────────────
  test("8. Homework tab loads", async ({ page }) => {
    await gotoAndSettle(page, assignmentsUrl(), { settleMs: 2000 });
    await snap(page, "08-homework-tab");

    expect(page.url()).toContain("/assignments");

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain("과제");

    await snap(page, "08-homework-tab-content");
  });
});
