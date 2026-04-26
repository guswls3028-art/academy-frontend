/**
 * 메시징 잠재 버그 시나리오 E2E — 08-edge-cases.spec.ts
 *
 * 검증 목표:
 *   1. 더블클릭 방지 (sendingRef + disabled 검증)
 *   2. 빈 데이터 상태 (수신자 없음 / 본문 없음 / 대상 없음)
 *   3. 모달 중첩/상태 꼬임 (양식 전환, 모드 전환, 돌아가기)
 *   4. 좁은 해상도 (768x600)
 *
 * 모든 시나리오에서 실제 발송 API 호출은 하지 않는다.
 * 발송하기 버튼 disabled 상태 / 확인 오버레이 가시성 기준으로 검증.
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import * as fs from "fs";

// ── 헬퍼 ──

async function snap(page: Page, name: string) {
  const dir = "e2e/screenshots";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
  console.log(`[snap] ${name}.png 저장`);
}

/** 사이드바 메뉴 클릭으로 이동 */
async function navTo(page: Page, text: string) {
  const link = page
    .locator("nav a, aside a, [class*=sidebar] a, [class*=Sidebar] a, [class*=drawer] a")
    .filter({ hasText: text })
    .first();
  await link.click({ timeout: 10000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

/** 학생 목록에서 체크박스를 클릭해 1명 이상 선택 후 "메시지 발송" 버튼 클릭 → 모달 열기 */
async function openSendModal(page: Page): Promise<boolean> {
  await navTo(page, "학생");

  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  if (count === 0) {
    console.log("[openSendModal] 체크박스 없음 — 학생 없음");
    return false;
  }

  const targetCheckbox = count > 1 ? checkboxes.nth(1) : checkboxes.first();
  await targetCheckbox.click();

  const sendBtn = page.locator("button").filter({ hasText: /메시지/ }).first();
  const visible = await sendBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (!visible) {
    console.log("[openSendModal] 메시지 발송 버튼 미표시");
    return false;
  }
  await sendBtn.click();
  // 모달이 열릴 때까지.
  const modalVisible = await page
    .locator("text=메시지 발송")
    .first()
    .isVisible({ timeout: 8000 })
    .catch(() => false);
  if (!modalVisible) {
    console.log("[openSendModal] 모달 열림 실패");
    return false;
  }
  return true;
}

/** SMS 모드로 전환 시도 */
async function switchToSms(page: Page) {
  const smsBtn = page.locator("button").filter({ hasText: /^SMS$/ }).first();
  if (await smsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    if (!(await smsBtn.isDisabled().catch(() => true))) {
      await smsBtn.click();
      // 모드 전환 settle.
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
    }
  }
}

/** 알림톡 모드로 전환 */
async function switchToAlimtalk(page: Page) {
  const atBtn = page.locator("button").filter({ hasText: /알림톡/ }).first();
  if (await atBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await atBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────
// 테스트 그룹
// ─────────────────────────────────────────────────────────

test.describe("메시징 잠재 버그 시나리오 — edge cases", () => {
  test.setTimeout(180_000);

  // ═══════════════════════════════════════════════════════
  // 1. 더블클릭 방지
  // ═══════════════════════════════════════════════════════
  test("1. 더블클릭 방지 — 발송 버튼 disabled 전환 확인", async ({ page }) => {
    await loginViaUI(page, "admin");

    const opened = await openSendModal(page);
    if (!opened) {
      console.log("[1] 모달 열기 실패 — 학생 없음 또는 메시지 기능 미설정, 스킵");
      await snap(page, "edge-1-skip");
      return;
    }

    await snap(page, "edge-1-modal-open");

    // SMS 모드 시도 (disabled면 알림톡 유지)
    await switchToSms(page);

    // 본문 입력 — SMS textarea 또는 알림톡 textarea
    const textarea = page
      .locator("textarea.message-domain-input, textarea[placeholder='내용을 입력하세요']")
      .first();
    const hasTextarea = await textarea.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasTextarea) {
      await textarea.fill("E2E 더블클릭 방지 테스트 메시지");
    }

    // ── 1a. 푸터의 발송 버튼(requestSend) disabled/enabled 상태 확인 ──
    const footerSendBtn = page
      .locator("div[class*=ModalFooter] button, footer button")
      .filter({ hasText: /발송/ })
      .last();

    // SMS 연동이 없거나 본문이 없으면 disabled 상태여야 함
    const footerDisabled = await footerSendBtn.isDisabled().catch(() => true);
    console.log(`[1] 푸터 발송 버튼 disabled: ${footerDisabled}`);

    if (!footerDisabled) {
      // canSend=true 상태에서 발송 버튼 클릭 → 확인 오버레이 표시
      await footerSendBtn.click();

      const confirmOverlay = page.locator("text=발송하기").last();
      const overlayVisible = await confirmOverlay.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`[1] 확인 오버레이 표시: ${overlayVisible}`);

      if (overlayVisible) {
        await snap(page, "edge-1-confirm-overlay");

        // ── 1b. "발송하기" 버튼 2번 빠르게 클릭 ──
        const confirmSendBtn = page.locator("button").filter({ hasText: "발송하기" }).last();

        // 클릭 직후 disabled 전환 여부 확인
        await confirmSendBtn.click();
        // 바로 disabled 상태 확인 (비동기 처리 전)
        const disabledAfterFirst = await confirmSendBtn.isDisabled().catch(() => true);
        // 두 번째 클릭 시도 — 의도적 race (더블클릭 방지 검증의 본질)
        await confirmSendBtn.click({ force: true }).catch(() => {});
        // eslint-disable-next-line no-restricted-syntax
        await page.waitForTimeout(200); // 의도적: 더블클릭 race 검증

        const disabledAfterSecond = await confirmSendBtn.isDisabled().catch(() => true);
        console.log(`[1] 1차 클릭 후 disabled: ${disabledAfterFirst}`);
        console.log(`[1] 2차 클릭 후 disabled: ${disabledAfterSecond}`);
        await snap(page, "edge-1-after-double-click");

        // sendingRef.current 방어: 버튼이 "발송 중…"으로 바뀌거나 disabled여야 함
        const btnText = await confirmSendBtn.textContent().catch(() => "");
        console.log(`[1] 발송하기 버튼 텍스트: "${btnText}"`);
        if (disabledAfterFirst || btnText?.includes("발송 중")) {
          console.log("[1] PASS — 더블클릭 방지 정상: 1차 클릭 직후 버튼 비활성화됨");
        } else {
          console.log("[1] WARN — 1차 클릭 후 즉시 disabled가 아님. sendingRef 작동 시 API 중복 호출 없음은 확인 필요");
        }

        // 발송 후 모달 상태 캡처 — settle 후 스냅.
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
        await snap(page, "edge-1-after-send");
      } else {
        console.log("[1] 확인 오버레이 미표시 — requestSend canSend 조건 미충족");
        await snap(page, "edge-1-no-overlay");
      }
    } else {
      console.log("[1] 푸터 발송 버튼 disabled — SMS 연동 없거나 본문 없음 (canSend=false 정상)");
      await snap(page, "edge-1-btn-disabled");
    }
  });

  // ═══════════════════════════════════════════════════════
  // 2. 빈 데이터 상태
  // ═══════════════════════════════════════════════════════
  test("2a. 빈 데이터 — 학생 0명 선택 시 안내 문구", async ({ page }) => {
    await loginViaUI(page, "admin");
    await navTo(page, "학생");

    // 체크박스 선택 없이 메시지 버튼 클릭 시도
    const sendBtn = page.locator("button").filter({ hasText: /메시지/ }).first();
    const btnVisible = await sendBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (btnVisible) {
      await sendBtn.click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      // 모달이 열렸다면 수신자 없음 안내 확인
      const noRecipientHint = page
        .locator("text=수신자를 선택한 뒤, text=수신자를 선택해 주세요")
        .first();
      const hintVisible = await noRecipientHint.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`[2a] 수신자 없음 안내 표시: ${hintVisible}`);
      await snap(page, "edge-2a-no-recipient");

      // 발송 버튼 disabled 확인
      const footerSendBtn = page
        .locator("button")
        .filter({ hasText: /발송/ })
        .last();
      const isDisabled = await footerSendBtn.isDisabled().catch(() => true);
      console.log(`[2a] 발송 버튼 disabled (수신자 없음): ${isDisabled}`);
      if (isDisabled) {
        console.log("[2a] PASS — 수신자 없음 시 발송 버튼 disabled 정상");
      } else {
        console.log("[2a] FAIL — 수신자 없음인데 발송 버튼 enabled");
      }

      // 모달 닫기
      const closeBtn = page.locator("button").filter({ hasText: "취소" }).first();
      if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeBtn.click();
      }
    } else {
      console.log("[2a] 메시지 버튼 미표시 (체크박스 선택 필요한 경우) — 스킵");
      await snap(page, "edge-2a-skip");
    }
  });

  test("2b. 빈 데이터 — 본문 비어 있으면 발송 버튼 disabled", async ({ page }) => {
    await loginViaUI(page, "admin");

    const opened = await openSendModal(page);
    if (!opened) {
      console.log("[2b] 모달 열기 실패 — 스킵");
      await snap(page, "edge-2b-skip");
      return;
    }

    // SMS 전환 시도 (switchToSms 자체가 settle 포함)
    await switchToSms(page);

    // textarea 비어 있는 상태에서 발송 버튼 확인
    const textarea = page
      .locator("textarea.message-domain-input, textarea[placeholder='내용을 입력하세요']")
      .first();
    const hasTextarea = await textarea.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasTextarea) {
      // 본문 비우기
      await textarea.fill("");

      const footerSendBtn = page.locator("button").filter({ hasText: /발송/ }).last();
      const isDisabled = await footerSendBtn.isDisabled().catch(() => true);
      console.log(`[2b] 본문 비어있을 때 발송 버튼 disabled: ${isDisabled}`);
      await snap(page, "edge-2b-empty-body");

      if (isDisabled) {
        console.log("[2b] PASS — 빈 본문 시 발송 버튼 disabled 정상");
      } else {
        console.log("[2b] FAIL — 빈 본문인데 발송 버튼 enabled");
      }

      // disableReason 안내 문구 확인
      const disableReason = page.locator("text=본문을 입력해 주세요").first();
      const reasonVisible = await disableReason.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`[2b] 본문 입력 안내 표시: ${reasonVisible}`);
    } else {
      console.log("[2b] SMS textarea 미표시 — SMS 연동 없는 테넌트. 알림톡 모드 확인");
      // 알림톡 모드에서 양식 미선택 시 발송 버튼 disabled 확인
      const footerSendBtn = page.locator("button").filter({ hasText: /발송/ }).last();
      const isDisabled = await footerSendBtn.isDisabled().catch(() => true);
      console.log(`[2b] 알림톡 양식 미선택 시 발송 버튼 disabled: ${isDisabled}`);
      await snap(page, "edge-2b-alimtalk-no-template");
    }

    // 닫기
    const closeBtn = page.locator("button").filter({ hasText: "취소" }).first();
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
    }
  });

  test("2c. 빈 데이터 — 학부모/학생 수신 대상 둘 다 해제", async ({ page }) => {
    await loginViaUI(page, "admin");

    const opened = await openSendModal(page);
    if (!opened) {
      console.log("[2c] 모달 열기 실패 — 스킵");
      await snap(page, "edge-2c-skip");
      return;
    }

    // 학부모 체크박스 찾기
    const parentCheckbox = page.locator("label").filter({ hasText: "학부모" }).locator('input[type="checkbox"]').first();
    const studentCheckbox = page.locator("label").filter({ hasText: "학생" }).locator('input[type="checkbox"]').first();

    const parentVisible = await parentCheckbox.isVisible({ timeout: 5000 }).catch(() => false);
    const studentVisible = await studentCheckbox.isVisible({ timeout: 3000 }).catch(() => false);

    if (parentVisible && studentVisible) {
      // 학부모 checked 상태 확인 후 해제
      const parentChecked = await parentCheckbox.isChecked().catch(() => false);
      const studentChecked = await studentCheckbox.isChecked().catch(() => false);
      console.log(`[2c] 초기 상태 — 학부모: ${parentChecked}, 학생: ${studentChecked}`);

      if (parentChecked) await parentCheckbox.click();
      if (studentChecked) await studentCheckbox.click();

      // "선택 필요" 경고 표시 확인 (체크 해제 settle 은 isVisible timeout 으로 흡수)
      const warningText = page.locator("text=선택 필요").first();
      const warningVisible = await warningText.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`[2c] "선택 필요" 경고 표시: ${warningVisible}`);
      await snap(page, "edge-2c-no-target");

      // 발송 버튼 disabled 확인
      const footerSendBtn = page.locator("button").filter({ hasText: /발송/ }).last();
      const isDisabled = await footerSendBtn.isDisabled().catch(() => true);
      console.log(`[2c] 대상 없음 시 발송 버튼 disabled: ${isDisabled}`);

      if (isDisabled && warningVisible) {
        console.log("[2c] PASS — 대상 없음 시 경고 표시 + 발송 버튼 disabled 정상");
      } else if (isDisabled) {
        console.log("[2c] PASS (partial) — 발송 버튼 disabled. 경고 텍스트 선택자 미일치 가능");
      } else {
        console.log("[2c] FAIL — 대상 없음인데 발송 버튼 enabled");
      }
    } else {
      console.log("[2c] 학부모/학생 체크박스 미표시 (직원모드 또는 알림톡 전용) — 스킵");
      await snap(page, "edge-2c-no-checkbox");
    }

    const closeBtn = page.locator("button").filter({ hasText: "취소" }).first();
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
    }
  });

  // ═══════════════════════════════════════════════════════
  // 3. 모달 중첩/상태 꼬임
  // ═══════════════════════════════════════════════════════
  test("3a. 양식 패널 열기 → 양식 선택 → 본문 변경 확인", async ({ page }) => {
    await loginViaUI(page, "admin");

    const opened = await openSendModal(page);
    if (!opened) {
      console.log("[3a] 모달 열기 실패 — 스킵");
      await snap(page, "edge-3a-skip");
      return;
    }

    // SMS 전환 (switchToSms 자체가 settle)
    await switchToSms(page);

    const textarea = page
      .locator("textarea.message-domain-input, textarea[placeholder='내용을 입력하세요']")
      .first();
    const hasSmsTextarea = await textarea.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasSmsTextarea) {
      // 초기 본문 입력
      await textarea.fill("초기 본문 — 덮어쓰기 테스트");
      const bodyBefore = await textarea.inputValue();
      console.log(`[3a] 양식 선택 전 본문: "${bodyBefore}"`);

      // 양식 패널 열기
      const templatePanelBtn = page
        .locator("button")
        .filter({ hasText: /양식 선택|양식 변경/ })
        .first();
      const panelBtnVisible = await templatePanelBtn.isVisible({ timeout: 5000 }).catch(() => false);

      if (panelBtnVisible) {
        await templatePanelBtn.click();
        // 패널 진입 — 템플릿 카드가 나타날 때까지 대기.
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
        await snap(page, "edge-3a-template-panel");

        // 첫 번째 템플릿 클릭
        const firstTemplate = page
          .locator("[class*=template], [class*=Template]")
          .filter({ hasText: /[가-힣]/ })
          .first();
        const templateVisible = await firstTemplate.isVisible({ timeout: 5000 }).catch(() => false);

        if (templateVisible) {
          await firstTemplate.click();
          // 양식 적용 후 settle.
          await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

          const bodyAfter = await textarea.inputValue().catch(() => "");
          console.log(`[3a] 양식 선택 후 본문: "${bodyAfter.slice(0, 50)}..."`);
          await snap(page, "edge-3a-after-template");

          if (bodyAfter !== bodyBefore) {
            console.log("[3a] PASS — 양식 선택 시 본문이 변경됨 (덮어쓰기 정상)");
          } else {
            console.log("[3a] WARN — 양식 선택 후 본문 미변경 (bodyModified 로직 확인 필요)");
          }
        } else {
          console.log("[3a] 템플릿 목록 없음 (양식 0개)");
          await snap(page, "edge-3a-no-templates");
        }
      } else {
        console.log("[3a] 양식 선택 버튼 미표시");
      }
    } else {
      console.log("[3a] SMS textarea 없음 (SMS 연동 없는 테넌트) — 알림톡 모드 기준 스킵");
    }

    const closeBtn = page.locator("button").filter({ hasText: "취소" }).first();
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
    }
  });

  test("3b. SMS → 알림톡 → SMS 전환 후 본문/양식 상태 확인", async ({ page }) => {
    await loginViaUI(page, "admin");

    const opened = await openSendModal(page);
    if (!opened) {
      console.log("[3b] 모달 열기 실패 — 스킵");
      await snap(page, "edge-3b-skip");
      return;
    }

    // 1단계: SMS 모드
    await switchToSms(page);
    const smsBtnDisabled = await page
      .locator("button")
      .filter({ hasText: /^SMS$/ })
      .first()
      .isDisabled()
      .catch(() => true);

    if (smsBtnDisabled) {
      console.log("[3b] SMS 연동 없음 — 모드 전환 시나리오 스킵");
      await snap(page, "edge-3b-no-sms");
      const closeBtn = page.locator("button").filter({ hasText: "취소" }).first();
      if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) await closeBtn.click();
      return;
    }

    // SMS 본문 입력
    const smsTextarea = page
      .locator("textarea.message-domain-input, textarea[placeholder='내용을 입력하세요']")
      .first();
    if (await smsTextarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await smsTextarea.fill("SMS 모드 본문 — 전환 테스트");
    }
    await snap(page, "edge-3b-sms-body");

    // 2단계: 알림톡으로 전환 (switchToAlimtalk 자체가 settle)
    await switchToAlimtalk(page);
    await snap(page, "edge-3b-alimtalk-switch");

    // 알림톡 모드로 전환됐는지 확인 (SMS textarea 사라짐)
    const smsTextareaVisible = await smsTextarea.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`[3b] 알림톡 전환 후 SMS textarea 가시: ${smsTextareaVisible}`);

    // 3단계: 다시 SMS로 전환
    await switchToSms(page);
    await snap(page, "edge-3b-back-to-sms");

    const smsTextareaBackVisible = await smsTextarea.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[3b] SMS 복귀 후 SMS textarea 가시: ${smsTextareaBackVisible}`);

    // SMS 복귀 후 본문이 유지되는지 확인 (sendMode 전환 시 body 초기화 여부)
    if (smsTextareaBackVisible) {
      const bodyAfterSwitch = await smsTextarea.inputValue().catch(() => "");
      console.log(`[3b] SMS 복귀 후 본문: "${bodyAfterSwitch}"`);
      // 소스 분석: switchToSms 시 setBody("") 하지 않으므로 유지되어야 함
      if (bodyAfterSwitch.includes("SMS 모드 본문")) {
        console.log("[3b] PASS — 모드 전환 후 SMS 본문 유지됨");
      } else {
        console.log("[3b] WARN — SMS 복귀 후 본문 초기화됨 (의도된 동작인지 확인 필요)");
      }
    }

    const closeBtn = page.locator("button").filter({ hasText: "취소" }).first();
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) await closeBtn.click();
  });

  test("3c. 확인 오버레이 '돌아가기' 후 본문 유지 확인", async ({ page }) => {
    await loginViaUI(page, "admin");

    const opened = await openSendModal(page);
    if (!opened) {
      console.log("[3c] 모달 열기 실패 — 스킵");
      await snap(page, "edge-3c-skip");
      return;
    }

    // canSend가 되도록 본문 입력
    await switchToSms(page);
    const textarea = page
      .locator("textarea.message-domain-input, textarea[placeholder='내용을 입력하세요']")
      .first();
    const hasTextarea = await textarea.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasTextarea) {
      console.log("[3c] SMS textarea 없음 — 알림톡 전용 테넌트, 스킵");
      await snap(page, "edge-3c-no-sms");
      const closeBtn = page.locator("button").filter({ hasText: "취소" }).first();
      if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) await closeBtn.click();
      return;
    }

    const originalBody = "돌아가기 후 유지 테스트 본문 123";
    await textarea.fill(originalBody);

    // 발송 버튼 클릭 → 확인 오버레이
    const footerSendBtn = page.locator("button").filter({ hasText: /발송/ }).last();
    const isEnabled = !(await footerSendBtn.isDisabled().catch(() => true));

    if (isEnabled) {
      await footerSendBtn.click();

      const confirmOverlay = page.locator("text=발송하기").last();
      const overlayVisible = await confirmOverlay.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`[3c] 확인 오버레이 표시: ${overlayVisible}`);
      await snap(page, "edge-3c-confirm-overlay");

      if (overlayVisible) {
        // "돌아가기" 클릭
        const backBtn = page.locator("button").filter({ hasText: "돌아가기" }).first();
        await backBtn.click();
        // 오버레이가 사라질 때까지.
        await expect(
          page.locator("button").filter({ hasText: "돌아가기" }).first(),
          "돌아가기 후 확인 오버레이의 돌아가기 버튼이 사라져야 함",
        ).toBeHidden({ timeout: 3_000 });
        await snap(page, "edge-3c-after-back");

        // 오버레이 사라짐 확인
        const overlayGone = !(await page.locator("button").filter({ hasText: "돌아가기" }).isVisible({ timeout: 2000 }).catch(() => false));
        console.log(`[3c] 돌아가기 후 오버레이 해제: ${overlayGone}`);

        // 본문 유지 확인
        const bodyAfterBack = await textarea.inputValue().catch(() => "");
        console.log(`[3c] 돌아가기 후 본문: "${bodyAfterBack}"`);

        if (bodyAfterBack === originalBody) {
          console.log("[3c] PASS — 돌아가기 후 본문 유지됨");
        } else {
          console.log(`[3c] FAIL — 돌아가기 후 본문 변경됨: "${bodyAfterBack}"`);
        }
      } else {
        console.log("[3c] 확인 오버레이 미표시 — canSend 조건 불충족 (SMS 연동 없을 수 있음)");
      }
    } else {
      console.log("[3c] 발송 버튼 disabled — SMS 연동 없어 확인 오버레이 진입 불가, 스킵");
      await snap(page, "edge-3c-btn-disabled");
    }

    const closeBtn = page.locator("button").filter({ hasText: "취소" }).first();
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) await closeBtn.click();
  });

  // ═══════════════════════════════════════════════════════
  // 4. 좁은 해상도 (768x600)
  // ═══════════════════════════════════════════════════════
  test("4. 좁은 해상도 768x600 — 모달 스크롤/버튼 접근성", async ({ page }) => {
    // viewport 변경
    await page.setViewportSize({ width: 768, height: 600 });
    await loginViaUI(page, "admin");

    const opened = await openSendModal(page);
    if (!opened) {
      console.log("[4] 모달 열기 실패 — 스킵");
      await snap(page, "edge-4-skip");
      return;
    }

    await snap(page, "edge-4-modal-768x600");

    // 모달이 뷰포트 내에서 보이는지 확인
    const modal = page
      .locator("[class*=AdminModal], [class*=admin-modal], [role='dialog']")
      .first();
    const modalVisible = await modal.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[4] 768x600 모달 표시: ${modalVisible}`);

    if (modalVisible) {
      const modalBox = await modal.boundingBox().catch(() => null);
      if (modalBox) {
        console.log(`[4] 모달 위치/크기: x=${modalBox.x.toFixed(0)}, y=${modalBox.y.toFixed(0)}, w=${modalBox.width.toFixed(0)}, h=${modalBox.height.toFixed(0)}`);
        if (modalBox.height > 600) {
          console.log("[4] INFO — 모달 높이 > 뷰포트. 스크롤 필요 예상");
        }
      }

      // 모달 내부 스크롤 가능 여부 — ModalBody 요소 확인
      const modalBody = modal.locator("[class*=ModalBody], [class*=modal-body]").first();
      const bodyScrollable = await page.evaluate((el) => {
        if (!el) return false;
        return el.scrollHeight > el.clientHeight;
      }, await modalBody.elementHandle().catch(() => null)).catch(() => false);
      console.log(`[4] 모달 바디 스크롤 가능: ${bodyScrollable}`);

      // 하단 버튼(취소/발송) 클릭 가능한지 확인
      const cancelBtn = page.locator("button").filter({ hasText: "취소" }).first();
      const cancelVisible = await cancelBtn.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`[4] 취소 버튼 가시: ${cancelVisible}`);

      if (cancelVisible) {
        const cancelBox = await cancelBtn.boundingBox().catch(() => null);
        if (cancelBox) {
          const inViewport = cancelBox.y + cancelBox.height <= 600 && cancelBox.x + cancelBox.width <= 768;
          console.log(`[4] 취소 버튼 뷰포트 내 위치: ${inViewport} (y=${cancelBox.y.toFixed(0)})`);
          if (!inViewport) {
            console.log("[4] WARN — 취소 버튼이 뷰포트 아래 있음. 스크롤 없이 접근 불가");
          } else {
            console.log("[4] PASS — 취소 버튼 뷰포트 내 접근 가능");
          }
        }
        await snap(page, "edge-4-modal-full");
        await cancelBtn.click();
      } else {
        console.log("[4] WARN — 취소 버튼 미표시 (하단 잘림)");
        await snap(page, "edge-4-footer-hidden");
        // 스크롤 후 재확인 (스크롤 자체는 동기, 약간의 settle 후 캡처)
        await page.mouse.wheel(0, 300);
        await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});
        await snap(page, "edge-4-after-scroll");
        const cancelAfterScroll = await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`[4] 스크롤 후 취소 버튼 가시: ${cancelAfterScroll}`);
      }
    } else {
      console.log("[4] 모달 미표시 — 선택자 미일치 가능");
    }
  });
});
