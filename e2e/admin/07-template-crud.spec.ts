/**
 * 템플릿 CRUD 전체 플로우 E2E — 실사용자 기준 검증
 *
 * 시나리오:
 * 1. 생성 — 새 템플릿 만들기 + 목록 확인
 * 2. 수정 — 열어서 본문 변경 + 다시 열어 유지 확인
 * 3. 복제 — ⋯→복제 버튼 → 목록 복제본 확인
 * 4. 삭제 — 복제본 삭제 + 목록 사라짐 확인
 * 5. 새로고침 후 유지 — 원본 템플릿 남아있는지
 * 6. 정리 — 원본 삭제
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const TIMESTAMP = Date.now();
const TEMPLATE_NAME = `[AUDIT-CRUD-${TIMESTAMP}]`;
const TEMPLATE_BODY = `E2E 감사 #{학생이름}님 테스트`;
const UPDATED_BODY = `[수정됨] #{학생이름}님`;
const DUPLICATE_NAME = `복사 - ${TEMPLATE_NAME}`;

async function snap(page: Page, name: string) {
  await page.screenshot({
    path: `e2e/screenshots/crud-${name}.png`,
    fullPage: false,
  });
}

/** 템플릿 목록 페이지로 이동 (사이드바 클릭 또는 직접 URL) */
async function goToTemplates(page: Page) {
  await page.goto(`${BASE}/admin/message/templates`, {
    waitUntil: "load",
    timeout: 20000,
  });
  await page.waitForTimeout(2000);
}

/** 모달이 닫히기를 기다림 */
async function waitModalClosed(page: Page) {
  // AdminModal이 없어지면 모달 role=dialog 사라짐
  await page.waitForSelector('[role="dialog"]', { state: "hidden", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

/** 목록에서 이름으로 템플릿 카드 찾기 */
function getTemplateCard(page: Page, name: string) {
  return page.locator(`text=${name}`).first();
}

test.describe("템플릿 CRUD 전체 플로우", () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  // ═══════════════════════════════════════════════
  // 1. 생성
  // ═══════════════════════════════════════════════
  test("1. 템플릿 생성 — 새 템플릿 추가 후 목록 확인", async ({ page }) => {
    await goToTemplates(page);
    await snap(page, "01-list-before-create");

    // "새 템플릿" 버튼 클릭
    const newBtn = page.locator("button").filter({ hasText: "새 템플릿" }).first();
    await expect(newBtn).toBeVisible({ timeout: 10000 });
    await newBtn.click();
    await page.waitForTimeout(1500);

    // 모달 열림 확인
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 8000 });
    await snap(page, "01-modal-open");

    // 이름 입력
    const nameInput = modal.locator('input[placeholder*="템플릿 이름"], input[placeholder*="출석 안내"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(TEMPLATE_NAME);

    // 본문 입력 (textarea)
    const bodyTextarea = modal.locator("textarea").first();
    await expect(bodyTextarea).toBeVisible({ timeout: 5000 });
    await bodyTextarea.fill(TEMPLATE_BODY);

    await snap(page, "01-modal-filled");

    // 저장 버튼 클릭
    const saveBtn = modal.locator("button").filter({ hasText: "저장" }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();

    // 모달 닫힘 대기
    await waitModalClosed(page);
    await snap(page, "01-after-save");

    // 목록에서 생성한 템플릿 확인
    const createdCard = getTemplateCard(page, TEMPLATE_NAME);
    await expect(createdCard).toBeVisible({ timeout: 10000 });
    await snap(page, "01-created-visible");
  });

  // ═══════════════════════════════════════════════
  // 2. 수정
  // ═══════════════════════════════════════════════
  test("2. 템플릿 수정 — 본문 변경 후 다시 열어 유지 확인", async ({ page }) => {
    await goToTemplates(page);

    // 방금 만든 템플릿 카드 클릭
    const card = getTemplateCard(page, TEMPLATE_NAME);
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();
    await page.waitForTimeout(1500);

    // 모달 열림
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 8000 });
    await snap(page, "02-modal-open");

    // 본문 수정
    const bodyTextarea = modal.locator("textarea").first();
    await expect(bodyTextarea).toBeVisible({ timeout: 5000 });
    await bodyTextarea.fill(UPDATED_BODY);
    await snap(page, "02-modal-body-updated");

    // 수정 버튼 클릭
    const editBtn = modal.locator("button").filter({ hasText: "수정" }).first();
    await expect(editBtn).toBeEnabled({ timeout: 5000 });
    await editBtn.click();

    // 모달 닫힘 대기
    await waitModalClosed(page);
    await snap(page, "02-after-edit");

    // 다시 열어서 수정 내용 확인
    await page.waitForTimeout(1000);
    const cardAgain = getTemplateCard(page, TEMPLATE_NAME);
    await expect(cardAgain).toBeVisible({ timeout: 10000 });
    await cardAgain.click();
    await page.waitForTimeout(1500);

    const modal2 = page.locator('[role="dialog"]');
    await expect(modal2).toBeVisible({ timeout: 8000 });

    const bodyTextarea2 = modal2.locator("textarea").first();
    await expect(bodyTextarea2).toBeVisible({ timeout: 5000 });
    const bodyVal = await bodyTextarea2.inputValue();
    expect(bodyVal).toContain("[수정됨]");
    await snap(page, "02-edit-persisted");

    // 모달 닫기
    const cancelBtn = modal2.locator("button").filter({ hasText: "취소" }).first();
    await cancelBtn.click();
    await waitModalClosed(page);
  });

  // ═══════════════════════════════════════════════
  // 3. 복제
  // ═══════════════════════════════════════════════
  test("3. 템플릿 복제 — 복제 버튼으로 복제본 생성 확인", async ({ page }) => {
    await goToTemplates(page);

    // 원본 카드에서 복제 아이콘 버튼 찾기 (aria-label="복제")
    const card = page.locator('[class*="contentCard"]').filter({ hasText: TEMPLATE_NAME }).first();
    await expect(card).toBeVisible({ timeout: 10000 });

    const duplicateBtn = card.locator('button[aria-label="복제"], button[title="복제"]');
    await expect(duplicateBtn).toBeVisible({ timeout: 5000 });
    await snap(page, "03-before-duplicate");
    await duplicateBtn.click();
    await page.waitForTimeout(2500);

    // 복제본 확인
    const dupCard = getTemplateCard(page, DUPLICATE_NAME);
    await expect(dupCard).toBeVisible({ timeout: 10000 });
    await snap(page, "03-duplicate-visible");
  });

  // ═══════════════════════════════════════════════
  // 4. 삭제 (복제본)
  // ═══════════════════════════════════════════════
  test("4. 복제본 삭제 — 삭제 후 목록에서 사라짐 확인", async ({ page }) => {
    await goToTemplates(page);

    // 복제본 카드에서 삭제 버튼
    const dupCard = page.locator('[class*="contentCard"]').filter({ hasText: DUPLICATE_NAME }).first();
    await expect(dupCard).toBeVisible({ timeout: 10000 });

    const deleteBtn = dupCard.locator('button[aria-label="삭제"], button[title="삭제"]');
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await snap(page, "04-before-delete");
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // 인라인 확인 다이얼로그 — "삭제" 버튼 클릭
    const confirmDeleteBtn = dupCard.locator("button").filter({ hasText: "삭제" }).first();
    await expect(confirmDeleteBtn).toBeVisible({ timeout: 5000 });
    await confirmDeleteBtn.click();
    await page.waitForTimeout(2500);

    // 복제본 사라짐 확인
    await expect(page.locator(`text=${DUPLICATE_NAME}`)).toHaveCount(0, { timeout: 10000 });
    await snap(page, "04-duplicate-deleted");
  });

  // ═══════════════════════════════════════════════
  // 5. 새로고침 후 원본 유지 확인
  // ═══════════════════════════════════════════════
  test("5. 새로고침 후 원본 템플릿 유지 확인", async ({ page }) => {
    await goToTemplates(page);

    // 원본 존재 확인
    const card = getTemplateCard(page, TEMPLATE_NAME);
    await expect(card).toBeVisible({ timeout: 10000 });

    // 페이지 새로고침
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 새로고침 후도 원본 존재
    const cardAfterReload = getTemplateCard(page, TEMPLATE_NAME);
    await expect(cardAfterReload).toBeVisible({ timeout: 10000 });
    await snap(page, "05-after-reload-original-exists");
  });

  // ═══════════════════════════════════════════════
  // 6. 정리 — 원본 삭제
  // ═══════════════════════════════════════════════
  test("6. 정리 — 원본 테스트 템플릿 삭제", async ({ page }) => {
    await goToTemplates(page);

    const origCard = page.locator('[class*="contentCard"]').filter({ hasText: TEMPLATE_NAME }).first();
    await expect(origCard).toBeVisible({ timeout: 10000 });

    const deleteBtn = origCard.locator('button[aria-label="삭제"], button[title="삭제"]');
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await snap(page, "06-before-cleanup");
    await deleteBtn.click();
    await page.waitForTimeout(500);

    const confirmDeleteBtn = origCard.locator("button").filter({ hasText: "삭제" }).first();
    await expect(confirmDeleteBtn).toBeVisible({ timeout: 5000 });
    await confirmDeleteBtn.click();
    await page.waitForTimeout(2500);

    // 원본도 사라짐 확인
    await expect(page.locator(`text=${TEMPLATE_NAME}`)).toHaveCount(0, { timeout: 10000 });
    await snap(page, "06-cleanup-done");
  });
});
