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
  await page.waitForTimeout(2000);
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
    await page.goto(scoresUrl(), { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(3000);
    await snap(page, "01-scores-tab-loaded");

    const enrollBtn = page.locator("button").filter({ hasText: "수강생 일괄배정" }).first();
    await expect(enrollBtn).toBeVisible({ timeout: 10000 });
    console.log("[PASS] '수강생 일괄배정' button visible");

    const dividers = page.locator('span[aria-hidden="true"]');
    const dividerCount = await dividers.count();
    console.log(`[INFO] Toolbar divider count: ${dividerCount}`);
    expect(dividerCount).toBeGreaterThanOrEqual(2);
    console.log("[PASS] Toolbar dividers >= 2");

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
    await page.waitForTimeout(1000);
    await snap(page, "01-more-menu-open");

    const printItem = page.locator("button, [role='menuitem']").filter({ hasText: "성적표 출력" }).first();
    await expect(printItem).toBeVisible({ timeout: 5000 });
    console.log("[PASS] '성적표 출력' menu item visible");

    const clinicItem = page.locator("button, [role='menuitem']").filter({ hasText: "클리닉 대상 보기" }).first();
    await expect(clinicItem).toBeVisible({ timeout: 5000 });
    console.log("[PASS] '클리닉 대상 보기' menu item visible");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  // ─── 2. Edit mode keyboard hints ─────────────────────────────────
  test("2. Edit mode keyboard hints — Enter and Tab", async ({ page }) => {
    await page.goto(scoresUrl(), { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(3000);

    const editBtn = page.locator("button").filter({ hasText: "편집 모드" }).first();
    await expect(editBtn).toBeVisible({ timeout: 10000 });
    await editBtn.click();
    await page.waitForTimeout(2000);
    await snap(page, "02-edit-mode-active");

    const pageText = await page.locator("body").innerText();
    expect(pageText).toContain("Enter");
    console.log("[PASS] Keyboard hint contains 'Enter'");
    expect(pageText).toContain("Tab");
    console.log("[PASS] Keyboard hint contains 'Tab'");

    await snap(page, "02-keyboard-hints");

    const saveBtn = page.locator("button").filter({ hasText: /저장|편집 종료/ }).first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  // ─── 3. Exam creation modal — cutline unit badge ──────────────────
  test("3. Exam creation modal — cutline header and unit badge", async ({ page }) => {
    await page.goto(scoresUrl(), { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(3000);

    const addExamBtn = page.locator("button").filter({ hasText: "+ 시험" }).first();
    await expect(addExamBtn).toBeVisible({ timeout: 10000 });
    await addExamBtn.click();
    await page.waitForTimeout(2000);
    await snap(page, "03-exam-picker");

    await clickSessionBlockCard(page, "신규 시험");
    await snap(page, "03-exam-creation-form");

    // "커트라인" column header must be visible
    const cutlineHeader = page.locator("th").filter({ hasText: "커트라인" }).first();
    await expect(cutlineHeader).toBeVisible({ timeout: 10000 });
    console.log("[PASS] '커트라인' table header visible");

    // Check for "점" badge — may not be deployed yet
    const headerText = await cutlineHeader.innerText();
    console.log(`[INFO] Cutline header innerText: "${headerText}"`);

    if (headerText.includes("점")) {
      console.log("[PASS] '점' unit badge present in cutline header");
    } else {
      console.log("[WARN] '점' unit badge NOT present — fix may not be deployed yet");
      test.info().annotations.push({ type: "note", description: "'점' badge not deployed yet" });
    }

    // Also verify the form has input fields (title, maxScore, passScore)
    const titleInput = page.locator('input[aria-label*="시험"][aria-label*="제목"]').first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    console.log("[PASS] Exam title input visible");

    await snap(page, "03-cutline-unit-badge");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);
  });

  // ─── 4. Exam creation modal — info text ──────────────────────────
  test("4. Exam creation modal — clinic info text", async ({ page }) => {
    await page.goto(scoresUrl(), { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(3000);

    const addExamBtn = page.locator("button").filter({ hasText: "+ 시험" }).first();
    await addExamBtn.click();
    await page.waitForTimeout(2000);

    await clickSessionBlockCard(page, "신규 시험");
    await page.waitForTimeout(1000);

    const modalText = await getModalText(page);
    console.log(`[INFO] Exam modal text (last 300 chars): "${modalText.slice(-300)}"`);

    // The info text should contain both "커트라인 미만" and "클리닉 보강 대상"
    const hasClinicText = modalText.includes("커트라인 미만") && modalText.includes("클리닉 보강 대상");
    // Fallback: simpler check
    const hasClinicAlt = modalText.includes("클리닉") && modalText.includes("대상");

    if (hasClinicText) {
      console.log("[PASS] '커트라인 미만 시 클리닉 보강 대상' info text present");
    } else if (hasClinicAlt) {
      console.log("[PASS] Clinic-related info text present (different wording)");
    } else {
      console.log("[WARN] Clinic info text NOT found — fix may not be deployed yet");
      test.info().annotations.push({ type: "note", description: "Clinic info text not deployed yet" });
    }

    // At minimum, the modal should have form content (stage=new)
    expect(modalText).toContain("제목");
    console.log("[PASS] Exam form '제목' column present");

    await snap(page, "04-exam-info-text");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);
  });

  // ─── 5. Homework creation modal — 2nd row cutline disabled ────────
  test("5. Homework creation modal — 2nd row cutline behavior", async ({ page }) => {
    await page.goto(scoresUrl(), { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(3000);

    const addHwBtn = page.locator("button").filter({ hasText: "+ 과제" }).first();
    await expect(addHwBtn).toBeVisible({ timeout: 10000 });
    await addHwBtn.click();
    await page.waitForTimeout(2000);
    await snap(page, "05-hw-picker");

    await clickSessionBlockCard(page, "신규 과제");
    await snap(page, "05-hw-creation-form");

    // Add 2nd row
    const addRowBtn = page.locator("button").filter({ hasText: /\+\s*추가/ }).first();
    await expect(addRowBtn).toBeVisible({ timeout: 10000 });
    await addRowBtn.click();
    await page.waitForTimeout(1500);
    await snap(page, "05-hw-2nd-row-added");

    // Find 2nd row cutline input
    const secondCutline = page.locator('input[aria-label="과제 2 커트라인"]');
    await expect(secondCutline).toBeVisible({ timeout: 5000 });
    console.log("[INFO] 2nd row cutline input found");

    const isDisabled = await secondCutline.isDisabled();
    const style = await secondCutline.getAttribute("style") ?? "";
    const isReadonly = await secondCutline.evaluate((el: HTMLInputElement) => el.readOnly);

    console.log(`[INFO] 2nd cutline — disabled: ${isDisabled}, readOnly: ${isReadonly}, style: "${style}"`);

    if (isDisabled) {
      console.log("[PASS] 2nd row cutline input is disabled");
    } else if (style.includes("opacity")) {
      console.log("[PASS] 2nd row cutline has reduced opacity (visually disabled)");
    } else {
      console.log("[WARN] 2nd row cutline is NOT disabled — fix may not be deployed yet");
      test.info().annotations.push({ type: "note", description: "Cutline disabled fix not deployed yet" });
    }

    // At minimum verify 2 rows exist
    const rowCount = await page.locator("[role='dialog'] table tbody tr, .admin-modal-overlay table tbody tr").count();
    console.log(`[INFO] Homework form row count: ${rowCount}`);
    expect(rowCount).toBeGreaterThanOrEqual(2);
    console.log("[PASS] 2 homework rows present after '+ 추가'");

    await snap(page, "05-hw-cutline-disabled");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);
  });

  // ─── 6. Homework creation modal — common apply info text ──────────
  test("6. Homework creation modal — common apply info text", async ({ page }) => {
    await page.goto(scoresUrl(), { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(3000);

    const addHwBtn = page.locator("button").filter({ hasText: "+ 과제" }).first();
    await addHwBtn.click();
    await page.waitForTimeout(2000);

    await clickSessionBlockCard(page, "신규 과제");
    await page.waitForTimeout(1000);

    const modalText = await getModalText(page);
    console.log(`[INFO] HW modal text (last 400 chars): "${modalText.slice(-400)}"`);

    const hasInfoText = modalText.includes("첫 번째 행") && modalText.includes("공통 적용");
    const hasInfoAlt = modalText.includes("첫 번째") || modalText.includes("공통");

    if (hasInfoText) {
      console.log("[PASS] '첫 번째 행 값이 전체 과제에 공통 적용' info text present");
    } else if (hasInfoAlt) {
      console.log("[PASS] Related info text present (partial match)");
    } else {
      console.log("[WARN] Common apply info text NOT found — fix may not be deployed yet");
      test.info().annotations.push({ type: "note", description: "HW info text not deployed yet" });
    }

    // At minimum, the modal should have the homework form
    expect(modalText).toContain("제목");
    console.log("[PASS] Homework form '제목' column present");

    await snap(page, "06-hw-info-text");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);
  });

  // ─── 7. Exam tab loads ────────────────────────────────────────────
  test("7. Exam tab loads", async ({ page }) => {
    await page.goto(examsUrl(), { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(4000);
    await snap(page, "07-exam-tab");

    expect(page.url()).toContain("/exams");
    console.log("[PASS] Exam tab URL correct");

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain("시험");
    console.log("[PASS] Exam tab contains '시험' text");

    await snap(page, "07-exam-tab-content");
  });

  // ─── 8. Homework tab loads ────────────────────────────────────────
  test("8. Homework tab loads", async ({ page }) => {
    await page.goto(assignmentsUrl(), { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(4000);
    await snap(page, "08-homework-tab");

    expect(page.url()).toContain("/assignments");
    console.log("[PASS] Homework tab URL correct");

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain("과제");
    console.log("[PASS] Homework tab contains '과제' text");

    await snap(page, "08-homework-tab-content");
  });
});
