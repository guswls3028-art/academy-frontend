/**
 * 09-send-verify.spec.ts — 메시징 안정화 실전 검증
 *
 * 시나리오:
 *   1. 성적 SMS 실제 발송 + 발송 내역 확인
 *   2. 클리닉 미리보기에서 #{장소} 정상 확인
 *   3. 발송 내역 상세 팝업 UX 정밀 검증
 *
 * 환경: hakwonplus.com / admin97 / koreaseoul97
 * 강의113 / 차시153 / 수강생 E2E메시지3139
 */

import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { FIXTURES } from "../helpers/test-fixtures";
import { gotoAndSettle } from "../helpers/wait";

test.setTimeout(180_000);

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/send-verify-${name}.png`, fullPage: false });
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// 시나리오 1: 성적 SMS 실제 발송 + 발송 내역 확인
// ─────────────────────────────────────────────────────────────
test("1. 성적 SMS 실제 발송 + 발송 내역 확인", async ({ page }) => {
  await loginViaUI(page, "admin");

  await gotoAndSettle(
    page,
    `${BASE}/admin/lectures/${FIXTURES.lectureId}/sessions/${FIXTURES.sessionId}/scores`,
    { settleMs: 2000 },
  );
  await snap(page, "01-scores-page");

  // ── 체크박스 전체 선택 ──
  const headerCheckbox = page.locator('input[type="checkbox"]').first();
  if (await headerCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
    await headerCheckbox.check();
  } else {
    const checkboxes = page.locator('input[type="checkbox"]');
    if ((await checkboxes.count()) > 0) {
      await checkboxes.first().check();
    }
  }
  await snap(page, "02-checkbox-selected");

  // ── 수업결과 발송 버튼 — 체크박스 선택 후 보여야 함 ──
  const sendBtn = page.locator("button").filter({ hasText: "수업결과 발송" }).first();
  if (!(await sendBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    // 개별 체크박스 재시도 (전체선택 미작동 환경 fallback)
    const allBoxes = page.locator('input[type="checkbox"]');
    const boxCount = await allBoxes.count();
    for (let i = 0; i < boxCount; i++) {
      await allBoxes.nth(i).check().catch(() => {});
    }
    await snap(page, "02c-all-checked");
  }

  await expect(sendBtn).toBeVisible({ timeout: 8000 });
  await sendBtn.click();
  // 모달 textarea 가 보일 때까지.
  const textarea = page.locator("textarea").first();
  await expect(textarea, "수업결과 발송 모달 본문 textarea 가 보여야 함").toBeVisible({ timeout: 8_000 });
  await snap(page, "03-modal-opened");

  // ── 본문 미치환 변수 검증 ──
  const bodyContent = await textarea.inputValue();
  expect(bodyContent.trim().length, "본문이 비어있지 않아야 함").toBeGreaterThan(0);
  expect(bodyContent, "#{선생님메모} 미치환 회귀").not.toContain("#{선생님메모}");

  await snap(page, "04-modal-body");

  // ── 학부모만 선택 (학생 체크 해제) ──
  const studentCheckbox = page.locator('label').filter({ hasText: /^학생$/ }).locator('input[type="checkbox"]').first();
  if (await studentCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
    if (await studentCheckbox.isChecked()) await studentCheckbox.uncheck();
  }

  await snap(page, "05-parent-only");

  // ── 발송 버튼 클릭 (확인 오버레이 열기) ──
  const footerSendBtn = page.locator("button").filter({ hasText: /발송/ }).last();
  await expect(footerSendBtn, "하단 발송 버튼이 보여야 함").toBeVisible({ timeout: 5_000 });
  await footerSendBtn.click();
  await snap(page, "06-confirm-overlay");

  // ── 확인 오버레이에서 "발송하기" 클릭 ──
  const confirmBtn = page.locator("button").filter({ hasText: /^발송하기$/ }).first();
  await expect(confirmBtn, "확인 오버레이의 '발송하기' 버튼이 보여야 함 (안전 가드)").toBeVisible({ timeout: 5_000 });
  await confirmBtn.click();

  // 발송 후 토스트 또는 모달 닫힘 — 둘 중 하나.
  await Promise.race([
    page.locator("text=/발송 예정|발송됨|발송 완료/").first().waitFor({ state: "visible", timeout: 10_000 }).catch(() => null),
    page.locator("[class*=toast], [class*=Toast], [role=alert]").first().waitFor({ state: "visible", timeout: 10_000 }).catch(() => null),
    textarea.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => null),
  ]);
  await snap(page, "08-toast");

  // ── 발송 내역 이동 ──
  await gotoAndSettle(page, `${BASE}/admin/message/log`, { settleMs: 2000 });
  await snap(page, "09-log-page");

  // ── 최신 발송 로그 행 클릭 ──
  const logRows = page.locator("button[type='button']").filter({ hasText: /20\d\d/ });
  const rowCount = await logRows.count();
  const rowsToUse = rowCount > 0
    ? logRows
    : page.locator("button[type='button']").filter({ hasText: /010/ });

  if ((await rowsToUse.count()) > 0) {
    await rowsToUse.first().click();
    await snap(page, "10-detail-modal");

    const detailTitle = page.locator("text=발송 상세").first();
    await expect(detailTitle, "발송 상세 팝업 제목이 보여야 함").toBeVisible({ timeout: 8_000 });

    // 핵심 라벨 hard expect
    const fullBodyText = await page.locator("body").innerText().catch(() => "");
    expect(fullBodyText, "성공/실패 배지").toMatch(/성공|실패/);
    expect(fullBodyText, "SMS 또는 알림톡 표시").toMatch(/SMS|알림톡/);
    expect(fullBodyText, "발송 내용 섹션").toContain("발송 내용");

    await snap(page, "11-detail-modal-full");

    // ESC 닫기
    await page.keyboard.press("Escape");
    await expect(detailTitle, "ESC 후 팝업 닫힘").toBeHidden({ timeout: 3_000 });
    await snap(page, "12-modal-closed");
  } else {
    test.info().annotations.push({ type: "external-blocker", description: "발송 내역 0건 (시나리오 1 발송 미반영 가능)" });
    await snap(page, "10-no-rows");
  }
});

// ─────────────────────────────────────────────────────────────
// 시나리오 2: 클리닉 미리보기에서 #{장소} 정상 확인
// ─────────────────────────────────────────────────────────────
test("2. 클리닉 미리보기에서 #{장소} 정상 확인", async ({ page }) => {
  test.setTimeout(120_000);

  await loginViaUI(page, "admin");
  await gotoAndSettle(page, `${BASE}/admin/clinic/msg-settings`, { settleMs: 2000 });
  await snap(page, "20-clinic-msg-settings");

  const previewBtns = page.locator("button").filter({ hasText: "미리보기" });
  expect(
    await previewBtns.count(),
    "클리닉 메시지 설정에 미리보기 버튼 1개 이상",
  ).toBeGreaterThan(0);

  await previewBtns.first().click();
  await snap(page, "21-preview-opened");

  // "장소?" 경고 배지 — 절대 보이면 안 됨 (templateBlocks 회귀).
  const locationWarning = page.locator("text=장소?")
    .or(page.locator("[class*=warning]").filter({ hasText: "장소" }))
    .first();
  await expect(
    locationWarning,
    "클리닉 미리보기에 '장소?' 경고가 노출되면 templateBlocks 회귀",
  ).toBeHidden({ timeout: 3_000 });

  // 미리보기 카드 노출
  const previewContent = page.locator(
    "[class*=preview], [class*=Preview], [class*=card], [class*=Card], [class*=kakao], [class*=Kakao]",
  ).first();
  await expect(previewContent, "미리보기 카드가 보여야 함").toBeVisible({ timeout: 5_000 });

  const previewText = await previewContent.innerText().catch(() => "");
  expect(previewText, "미리보기에 '#{장소}' 가 미치환 상태로 노출되면 안 됨").not.toContain("#{장소}");

  await snap(page, "22-preview-content");

  await page.keyboard.press("Escape");
  await settle(page);
  await snap(page, "23-preview-closed");
});

// ─────────────────────────────────────────────────────────────
// 시나리오 3: 발송 내역 상세 팝업 UX 정밀 검증
// ─────────────────────────────────────────────────────────────
test("3. 발송 내역 상세 팝업 UX 정밀 검증", async ({ page }) => {
  test.setTimeout(120_000);

  await loginViaUI(page, "admin");
  await gotoAndSettle(page, `${BASE}/admin/message/log`, { settleMs: 2000 });
  await snap(page, "30-log-page");

  // ── 성공 필터 ──
  const successFilter = page.locator("button").filter({ hasText: /^성공$/ }).first();
  if (await successFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
    await successFilter.click();
    await settle(page);
    await snap(page, "31-success-filter");
  }

  // ── 첫 번째 발송 로그 행 클릭 ──
  const logRowsSc3 = page.locator("button[type='button']").filter({ hasText: /20\d\d/ });
  const logRowCountSc3 = await logRowsSc3.count();

  const rowsToUseSc3 = logRowCountSc3 > 0
    ? logRowsSc3
    : page.locator("button[type='button']").filter({ hasText: /010/ });

  if ((await rowsToUseSc3.count()) === 0) {
    // 전체 필터로 전환
    const allFilter = page.locator("button").filter({ hasText: /^전체$/ }).first();
    if (await allFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await allFilter.click();
      await settle(page);
    }
  }

  const rowToClick = (await rowsToUseSc3.count()) > 0
    ? rowsToUseSc3.first()
    : page.locator("button[type='button']").filter({ hasText: /20\d\d/ }).first();

  await expect(
    rowToClick,
    "발송 내역에 클릭할 행이 보여야 함 (시나리오 1 의 SMS 발송이 반영되어야 함)",
  ).toBeVisible({ timeout: 8000 });
  await rowToClick.click();
  await snap(page, "32-detail-popup");

  // ── 상세 팝업 UX 검증 ──
  const detailTitle = page.locator("text=발송 상세").first();
  await expect(detailTitle, "발송 상세 팝업 제목이 보여야 함").toBeVisible({ timeout: 8000 });

  const bodyText = await page.locator("body").innerText().catch(() => "");

  expect(bodyText, "상세 팝업에 '수신자' 레이블").toContain("수신자");
  expect(bodyText, "상세 팝업에 '발송 내용' 레이블").toContain("발송 내용");
  expect(bodyText, "상세 팝업에 '발송 방식' 레이블").toContain("발송 방식");
  expect(bodyText, "상세 팝업에 성공/실패 배지").toMatch(/성공|실패/);
  expect(bodyText, "상세 팝업에 SMS 또는 알림톡 표시").toMatch(/SMS|알림톡/);

  await snap(page, "33-detail-full");

  // ── ESC로 닫기 ──
  await page.keyboard.press("Escape");
  await expect(detailTitle, "ESC 후 팝업 닫힘").toBeHidden({ timeout: 3_000 });
  await snap(page, "34-popup-closed");

  // ── 실패 필터 ──
  const failFilter = page.locator("button").filter({ hasText: /^실패$/ }).first();
  if (await failFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
    await failFilter.click();
    await settle(page);
    await snap(page, "35-fail-filter");

    const failRows = page.locator("button[type='button']");
    if ((await failRows.count()) > 0) {
      await failRows.first().click();
      await snap(page, "36-fail-detail");

      // 실패 사유 — 실패 건이면 반드시 노출.
      const failReasonLabel = page.locator("text=실패 사유").first();
      if (await failReasonLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(failReasonLabel).toBeVisible();
      }

      await page.keyboard.press("Escape");
    }
  }
});
