/**
 * 10-hidden-bugs.spec.ts — 메시징 모달 미확인 시나리오 검증
 *
 * 시나리오 1: SMS 양식 선택 후 본문 변경 정확성
 * 시나리오 2: 알림톡 양식 선택 후 본문 변경 + 직접 작성 초기화
 * 시나리오 3: 발송 disable 사유 정확성
 *
 * 환경: hakwonplus.com / admin97
 */

import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

test.setTimeout(180_000);

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

async function snap(page: Page, name: string) {
  const path = `e2e/screenshots/hidden-${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`[SNAP] ${path}`);
}

/**
 * 학생 목록 페이지로 이동 후 첫 번째 학생 체크 → 메시지 발송 클릭 → 모달 열림까지 대기
 * SMS 모달이 열리면 빈 본문 힌트 오버레이가 덮여있을 수 있으므로 dismiss 처리
 */
async function openSendModalFromStudentPage(page: Page): Promise<void> {
  console.log("[STEP] 학생 목록 페이지 이동");
  await page.goto(`${BASE}/admin/students`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2500);
  await snap(page, "01-students-list");

  // 첫 번째 학생 행 체크박스 선택
  const checkboxes = page.locator('input[type="checkbox"]');
  const checkCount = await checkboxes.count();
  console.log(`[INFO] 체크박스 수: ${checkCount}`);

  if (checkCount === 0) {
    throw new Error("학생 목록에서 체크박스를 찾을 수 없습니다");
  }

  // 헤더(전체선택) 체크박스와 개별 체크박스를 구분: 첫 번째(헤더)가 아닌 두 번째 이후
  // 안전하게 첫 번째 tbody row 체크박스를 선택
  const firstRowCheckbox = page.locator('tbody input[type="checkbox"]').first();
  const firstRowVisible = await firstRowCheckbox.isVisible({ timeout: 5000 }).catch(() => false);

  if (firstRowVisible) {
    await firstRowCheckbox.check();
    console.log("[OK] 첫 번째 학생 체크박스 선택");
  } else {
    // fallback: 두 번째 체크박스(첫 번째는 헤더)
    await checkboxes.nth(1).check().catch(async () => {
      await checkboxes.first().check();
    });
    console.log("[OK] 체크박스 선택 (fallback)");
  }
  await page.waitForTimeout(500);
  await snap(page, "02-checkbox-checked");

  // 메시지 발송 버튼 클릭
  const msgBtn = page.locator("button").filter({ hasText: "메시지 발송" }).first();
  const msgBtnVisible = await msgBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[INFO] 메시지 발송 버튼 visible: ${msgBtnVisible}`);

  if (!msgBtnVisible) {
    await snap(page, "02b-no-msg-btn");
    throw new Error("메시지 발송 버튼이 보이지 않습니다");
  }
  await msgBtn.click();
  await page.waitForTimeout(2500);
  console.log("[OK] 메시지 발송 모달 열림 시도");
  await snap(page, "03-modal-opened");

  // 모달이 실제로 열렸는지 확인
  const modalBody = page.locator(".send-message-modal, [class*=AdminModal], [role=dialog]").first();
  const modalVisible = await modalBody.isVisible({ timeout: 8000 }).catch(() => false);
  console.log(`[CHECK] 모달 visible: ${modalVisible}`);
  if (!modalVisible) {
    // role=dialog 없이 렌더링될 수 있음 — body 텍스트로 확인
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const hasSmsLabel = bodyText.includes("SMS") || bodyText.includes("알림톡");
    console.log(`[CHECK] SMS/알림톡 텍스트 존재: ${hasSmsLabel}`);
    if (!hasSmsLabel) {
      throw new Error("메시지 발송 모달이 열리지 않았습니다");
    }
  }
}

/**
 * SMS 빈 본문 힌트 오버레이(smsEmptyHintDismissed=false 상태) dismiss
 * 힌트가 있으면 "직접 작성하기" 클릭하여 textarea 활성화
 */
async function dismissSmsEmptyHint(page: Page): Promise<void> {
  const directWriteBtn = page.locator("button, a").filter({ hasText: "직접 작성하기" }).first();
  const hintVisible = await directWriteBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (hintVisible) {
    await directWriteBtn.click();
    await page.waitForTimeout(500);
    console.log("[OK] SMS 빈 본문 힌트 → 직접 작성하기 클릭으로 dismiss");
  }
}

/**
 * 템플릿 패널에서 시스템 기본 양식 1개 선택 후 패널 닫힘 확인
 * 선택된 양식 이름과 본문을 반환
 */
async function pickFirstSystemTemplate(
  page: Page,
  panelButtonText: string,
): Promise<{ name: string; body: string } | null> {
  // 패널 열기 버튼 클릭 ("양식 선택" or "양식 변경")
  const panelToggle = page.locator("button").filter({ hasText: panelButtonText }).first();
  const toggleVisible = await panelToggle.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[INFO] "${panelButtonText}" 버튼 visible: ${toggleVisible}`);

  if (!toggleVisible) {
    // "양식 변경" fallback
    const altToggle = page.locator("button").filter({ hasText: "양식 변경" }).first();
    const altVisible = await altToggle.isVisible({ timeout: 3000 }).catch(() => false);
    if (!altVisible) {
      console.log("[WARN] 양식 선택/변경 버튼을 찾지 못함");
      return null;
    }
    await altToggle.click();
  } else {
    await panelToggle.click();
  }
  await page.waitForTimeout(1000);
  console.log("[OK] 양식 패널 열림");
  await snap(page, "04-template-panel");

  // 시스템 기본 양식 목록에서 클릭 가능한 첫 번째 양식 카드 찾기
  // 시스템 양식은 "[HakwonPlus]" 또는 "[학원플러스]" 텍스트를 포함하는 카드
  // TemplatePickerCard: button 안에 양식 이름 있음
  const systemTplBtns = page
    .locator("button")
    .filter({ hasText: /\[HakwonPlus\]|\[학원플러스\]/ });
  const systemCount = await systemTplBtns.count();
  console.log(`[INFO] 시스템 양식 버튼 수: ${systemCount}`);

  let templateName = "";
  let templateCardBtn: ReturnType<Page["locator"]> | null = null;

  if (systemCount > 0) {
    templateCardBtn = systemTplBtns.first();
    templateName = (await templateCardBtn.innerText().catch(() => "")).split("\n")[0].trim();
  } else {
    // 시스템 배지가 없어도 패널 내 첫 번째 클릭 가능한 카드(직접 작성하기 제외)
    const allPanelBtns = page
      .locator("button")
      .filter({ hasText: /.{3,}/ }) // 최소 3자 이상 텍스트
      .filter({ hasNotText: /직접 작성|닫기|양식|취소|발송|저장/ });
    const allCount = await allPanelBtns.count();
    console.log(`[INFO] 패널 내 후보 버튼 수: ${allCount}`);
    if (allCount > 0) {
      templateCardBtn = allPanelBtns.first();
      templateName = (await templateCardBtn.innerText().catch(() => "")).split("\n")[0].trim();
    }
  }

  if (!templateCardBtn) {
    console.log("[WARN] 클릭할 양식 카드를 찾지 못함");
    return null;
  }

  console.log(`[INFO] 선택할 양식: "${templateName}"`);
  await templateCardBtn.click();
  await page.waitForTimeout(1000);
  console.log("[OK] 양식 클릭 완료 (패널 닫힘 예상)");
  await snap(page, "05-template-selected");

  // 패널이 닫혔으면 textarea에서 본문 읽기
  const textarea = page.locator("textarea").first();
  const taVisible = await textarea.isVisible({ timeout: 5000 }).catch(() => false);
  let body = "";
  if (taVisible) {
    body = await textarea.inputValue();
    console.log(`[INFO] 선택 후 textarea 본문 (첫 80자): "${body.slice(0, 80)}"`);
  } else {
    console.log("[WARN] textarea가 보이지 않음");
  }

  return { name: templateName, body };
}

// ─────────────────────────────────────────────────────────────
// 시나리오 1: SMS 양식 선택 후 본문 변경 정확성
// ─────────────────────────────────────────────────────────────
test("시나리오 1: SMS 양식 선택 후 본문 변경 정확성", async ({ page }) => {
  console.log("\n[START] 시나리오 1: SMS 양식 선택 후 본문 변경 정확성");
  await loginViaUI(page, "admin");
  console.log("[OK] 로그인 완료");

  await openSendModalFromStudentPage(page);

  // SMS 모드 확인 (student blockCategory는 SMS로 시작)
  const bodyText0 = await page.locator("body").innerText().catch(() => "");
  const smsModeActive = bodyText0.includes("SMS");
  console.log(`[CHECK] SMS 모드 활성: ${smsModeActive}`);

  // SMS 빈 본문 힌트 dismiss
  await dismissSmsEmptyHint(page);

  // ── Step 1: 양식 선택 클릭 → 첫 번째 시스템 양식 선택 ──
  console.log("\n[STEP 1] 첫 번째 양식 선택");
  const tpl1 = await pickFirstSystemTemplate(page, "양식 선택");
  if (!tpl1) {
    console.log("[SKIP] 시스템 양식을 찾지 못해 Step 1 이후 건너뜀");
    await snap(page, "sc1-skip");
    return;
  }

  // ── Step 2: textarea 값이 선택한 양식 본문으로 변경되었는지 확인 ──
  const textarea = page.locator("textarea").first();
  const bodyAfterSelect1 = await textarea.inputValue().catch(() => "");
  console.log(`\n[CHECK] 1-A. 양식 선택 후 textarea 비어있지 않음: ${bodyAfterSelect1.trim().length > 0}`);
  console.log(`  → 본문 (첫 80자): "${bodyAfterSelect1.slice(0, 80)}"`);

  if (bodyAfterSelect1.trim().length === 0) {
    console.log("[FAIL] 양식 선택 후 본문이 비어있습니다 — 버그 가능성");
  } else {
    console.log("[PASS] 양식 선택 후 본문이 채워졌습니다");
  }
  await snap(page, "sc1-body-after-select1");

  // ── Step 3: 본문에 추가 텍스트 입력 → "수정됨" 뱃지 확인 ──
  console.log("\n[STEP 2] 추가 텍스트 입력 → 수정됨 뱃지 확인");
  await textarea.click();
  await textarea.press("End");
  await textarea.type(" [E2E추가]");
  await page.waitForTimeout(800);
  await snap(page, "sc1-modified-badge");

  // "수정됨" 뱃지 확인
  const modifiedBadge = page.locator("text=수정됨").first();
  const modifiedVisible = await modifiedBadge.isVisible({ timeout: 3000 }).catch(() => false);
  console.log(`[CHECK] 1-B. "수정됨" 뱃지 visible: ${modifiedVisible}`);
  if (modifiedVisible) {
    console.log("[PASS] 수정됨 뱃지 표시됨");
  } else {
    console.log("[FAIL] 수정됨 뱃지가 보이지 않습니다");
  }

  // ── Step 4: 다른 양식 선택 → 본문이 새 양식으로 변경 (이전 수정 내용 사라짐) ──
  console.log("\n[STEP 3] 두 번째 양식 선택 → 본문 교체 확인");

  // 양식 변경 버튼 클릭
  const changeBtn = page.locator("button").filter({ hasText: /양식 변경|양식 선택/ }).first();
  const changeBtnVisible = await changeBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[INFO] 양식 변경 버튼 visible: ${changeBtnVisible}`);

  if (changeBtnVisible) {
    await changeBtn.click();
    await page.waitForTimeout(1000);
    await snap(page, "sc1-panel2-opened");

    // 두 번째 시스템 양식 찾기 (첫 번째와 다른 것)
    const systemTplBtns2 = page
      .locator("button")
      .filter({ hasText: /\[HakwonPlus\]|\[학원플러스\]/ });
    const count2 = await systemTplBtns2.count();
    console.log(`[INFO] 패널 내 시스템 양식 수: ${count2}`);

    if (count2 >= 2) {
      // 두 번째 양식 선택
      const tpl2Name = (await systemTplBtns2.nth(1).innerText().catch(() => "")).split("\n")[0].trim();
      console.log(`[INFO] 두 번째 양식: "${tpl2Name}"`);
      await systemTplBtns2.nth(1).click();
      await page.waitForTimeout(1000);
    } else if (count2 === 1) {
      // 동일한 양식 재선택 (변경 여부 확인용)
      console.log("[INFO] 시스템 양식이 1개 — 동일 양식 재선택");
      await systemTplBtns2.first().click();
      await page.waitForTimeout(1000);
    } else {
      console.log("[WARN] 두 번째 양식을 찾지 못함 — 패널 닫기");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    await snap(page, "sc1-body-after-select2");
    const bodyAfterSelect2 = await textarea.inputValue().catch(() => "");
    console.log(`[INFO] 두 번째 양식 선택 후 본문 (첫 80자): "${bodyAfterSelect2.slice(0, 80)}"`);

    // 이전에 입력한 [E2E추가]가 사라졌는지 확인
    const prevEditGone = !bodyAfterSelect2.includes("[E2E추가]");
    console.log(`[CHECK] 1-C. 이전 수정 내용 "[E2E추가]" 사라짐: ${prevEditGone}`);
    if (prevEditGone) {
      console.log("[PASS] 새 양식 선택 시 이전 수정 내용이 교체됨");
    } else {
      console.log("[FAIL] 이전 수정 내용이 남아있습니다 — 버그 가능성");
    }

    // 새 양식 본문도 비어있지 않은지 확인
    const newBodyNotEmpty = bodyAfterSelect2.trim().length > 0;
    console.log(`[CHECK] 1-D. 새 양식 선택 후 본문 비어있지 않음: ${newBodyNotEmpty}`);
    if (newBodyNotEmpty) {
      console.log("[PASS] 새 양식 본문이 채워짐");
    } else {
      console.log("[FAIL] 새 양식 선택 후 본문이 비어있습니다");
    }
  } else {
    console.log("[SKIP] 양식 변경 버튼을 찾지 못해 Step 3 건너뜀");
  }

  console.log("\n[DONE] 시나리오 1 완료");
});

// ─────────────────────────────────────────────────────────────
// 시나리오 2: 알림톡에서 양식 선택 후 본문 변경
// ─────────────────────────────────────────────────────────────
test("시나리오 2: 알림톡 양식 선택 후 본문 변경 + 직접 작성 초기화", async ({ page }) => {
  console.log("\n[START] 시나리오 2: 알림톡 양식 선택 후 본문 변경");
  await loginViaUI(page, "admin");
  console.log("[OK] 로그인 완료");

  await openSendModalFromStudentPage(page);

  // ── 알림톡 모드로 전환 ──
  console.log("\n[STEP 1] 알림톡 모드로 전환");
  const alimtalkBtn = page.locator("button").filter({ hasText: "알림톡" }).first();
  const alimtalkBtnVisible = await alimtalkBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[INFO] 알림톡 탭 버튼 visible: ${alimtalkBtnVisible}`);

  if (!alimtalkBtnVisible) {
    console.log("[WARN] 알림톡 버튼이 보이지 않음 — 모달 상태 확인");
    await snap(page, "sc2-no-alimtalk-btn");
    // SMS 힌트 dismiss 후 재시도
    await dismissSmsEmptyHint(page);
    const alimtalkBtn2 = page.locator("button").filter({ hasText: "알림톡" }).first();
    const visible2 = await alimtalkBtn2.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[INFO] hint dismiss 후 알림톡 버튼 visible: ${visible2}`);
    if (!visible2) {
      console.log("[SKIP] 알림톡 버튼을 찾지 못해 시나리오 2 건너뜀");
      return;
    }
    await alimtalkBtn2.click();
  } else {
    await alimtalkBtn.click();
  }
  await page.waitForTimeout(1000);
  console.log("[OK] 알림톡 모드 전환");
  await snap(page, "sc2-alimtalk-mode");

  // ── Step 2: 양식 선택 클릭 → 시스템 기본 양식 선택 ──
  console.log("\n[STEP 2] 알림톡 양식 선택");
  const tpl1 = await pickFirstSystemTemplate(page, "양식 선택");
  if (!tpl1) {
    console.log("[SKIP] 시스템 양식을 찾지 못해 이후 건너뜀");
    await snap(page, "sc2-skip");
    return;
  }

  // ── Step 3: textarea 값이 변경되었는지 확인 ──
  const textarea = page.locator("textarea").first();
  const bodyAfterSelect = await textarea.inputValue().catch(() => "");
  console.log(`\n[CHECK] 2-A. 알림톡 양식 선택 후 textarea 비어있지 않음: ${bodyAfterSelect.trim().length > 0}`);
  console.log(`  → 본문 (첫 80자): "${bodyAfterSelect.slice(0, 80)}"`);

  if (bodyAfterSelect.trim().length > 0) {
    console.log("[PASS] 알림톡 양식 선택 후 본문이 채워졌습니다");
  } else {
    console.log("[FAIL] 알림톡 양식 선택 후 본문이 비어있습니다");
  }
  await snap(page, "sc2-body-after-select");

  // ── Step 4: 본문 수정 → "수정됨" 표시 ──
  console.log("\n[STEP 3] 본문 수정 → 수정됨 표시 확인");
  const taVisible = await textarea.isVisible({ timeout: 3000 }).catch(() => false);
  if (taVisible) {
    await textarea.click();
    await textarea.press("End");
    await textarea.type(" [알림톡E2E]");
    await page.waitForTimeout(800);
    await snap(page, "sc2-modified");

    // 알림톡의 수정됨 표시 — "수정됨" 텍스트 (· 포함 or 단독)
    const modBadge = page.locator("text=수정됨").first();
    const modVisible = await modBadge.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[CHECK] 2-B. 알림톡 "수정됨" 뱃지 visible: ${modVisible}`);
    if (modVisible) {
      console.log("[PASS] 수정됨 표시됨");
    } else {
      console.log("[FAIL] 수정됨 표시가 보이지 않습니다");
    }
  } else {
    console.log("[SKIP] textarea 미표시 — 본문 수정 단계 건너뜀");
  }

  // ── Step 5: "직접 작성하기" 선택 → 본문 초기화 확인 ──
  console.log("\n[STEP 4] 직접 작성하기 선택 → 본문 초기화 확인");

  // 양식 변경 버튼 클릭하여 패널 열기
  const changePanelBtn = page.locator("button").filter({ hasText: /양식 변경|양식 선택/ }).first();
  const changePanelVisible = await changePanelBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[INFO] 양식 변경 버튼 visible: ${changePanelVisible}`);

  if (changePanelVisible) {
    await changePanelBtn.click();
    await page.waitForTimeout(1000);
    await snap(page, "sc2-panel-for-direct");

    // 패널 내 "직접 작성하기" 버튼 찾기
    // 소스: setAlimtalkFreeForm(true) + setShowAlimtalkPanel(false) + setTemplateBodySnapshot(null)
    const directBtn = page.locator("button").filter({ hasText: "직접 작성하기" }).first();
    const directBtnVisible = await directBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[INFO] 직접 작성하기 버튼 visible: ${directBtnVisible}`);

    if (directBtnVisible) {
      await directBtn.click();
      await page.waitForTimeout(1000);
      console.log("[OK] 직접 작성하기 선택");
      await snap(page, "sc2-after-direct-write");

      // 직접 작성 모드 표시 확인
      const bodyText = await page.locator("body").innerText().catch(() => "");
      const directModeShown = bodyText.includes("직접 작성 모드");
      console.log(`[CHECK] 2-C. 직접 작성 모드 표시: ${directModeShown}`);

      // 본문 초기화 여부 확인 — textarea는 빈 상태거나 selectedTemplate이 null이어야
      const bodyAfterDirect = await textarea.inputValue().catch(() => "");
      console.log(`[INFO] 직접 작성 후 textarea 본문 (첫 80자): "${bodyAfterDirect.slice(0, 80)}"`);

      // 직접 작성 모드 전환 시 setBody("")는 하지 않음 (소스 확인)
      // → alimtalkFreeForm=true, selectedTemplate=null, templateBodySnapshot=null
      // → bodyModified = false (selectedTemplate이 null이므로)
      // → 수정됨 뱃지 사라짐 확인
      const modBadge2 = page.locator("text=수정됨").first();
      const modBadge2Visible = await modBadge2.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`[CHECK] 2-D. 직접 작성 후 수정됨 뱃지 사라짐: ${!modBadge2Visible}`);
      if (!modBadge2Visible) {
        console.log("[PASS] 직접 작성 전환 시 수정됨 뱃지 사라짐");
      } else {
        console.log("[FAIL] 직접 작성 전환 후에도 수정됨 뱃지가 남아있습니다");
      }
    } else {
      console.log("[SKIP] 직접 작성하기 버튼을 찾지 못함");
      await page.keyboard.press("Escape");
    }
  } else {
    console.log("[SKIP] 양식 변경 버튼 없음 — 직접 작성하기 단계 건너뜀");
  }

  console.log("\n[DONE] 시나리오 2 완료");
});

// ─────────────────────────────────────────────────────────────
// 시나리오 3: 발송 disable 사유 정확성
// ─────────────────────────────────────────────────────────────
test("시나리오 3: 발송 disable 사유 정확성", async ({ page }) => {
  console.log("\n[START] 시나리오 3: 발송 disable 사유 정확성");
  await loginViaUI(page, "admin");
  console.log("[OK] 로그인 완료");

  await openSendModalFromStudentPage(page);

  // disable 사유 span 공통 locator
  // 소스: <span style="fontSize:11, color:color-text-muted">{disableReason}</span>
  // ModalFooter right에 렌더링
  const disableReasonLocator = page.locator("span").filter({ hasText: /해 주세요|입력해 주세요|작성해 주세요/ });

  // ── 3-A: SMS 모드 + 본문 비어있음 → "본문을 입력해 주세요" ──
  console.log("\n[STEP 1] SMS 본문 비어있음 → disable 사유 확인");

  // SMS 힌트 dismiss (직접 작성하기 클릭)
  await dismissSmsEmptyHint(page);

  // textarea가 비어있는 상태 확보 (초기 상태)
  const textareaSms = page.locator("textarea").first();
  const taSmsClear = await textareaSms.isVisible({ timeout: 5000 }).catch(() => false);
  if (taSmsClear) {
    await textareaSms.clear();
    await page.waitForTimeout(500);
  }
  await snap(page, "sc3-sms-empty-body");

  // disableReason 텍스트 확인
  const bodyText1 = await page.locator("body").innerText().catch(() => "");
  const hasSmsBodyReason = bodyText1.includes("본문을 입력해 주세요");
  console.log(`[CHECK] 3-A. SMS 본문 비어있음 → "본문을 입력해 주세요": ${hasSmsBodyReason}`);
  if (hasSmsBodyReason) {
    console.log("[PASS] SMS 본문 비어있을 때 올바른 disable 사유 표시");
  } else {
    // 실제 표시된 disable 사유 추출
    const allSpans = await page.locator("span").allInnerTexts();
    const reasonSpan = allSpans.find((t) => t.includes("주세요") || t.includes("연동") || t.includes("초과"));
    console.log(`[FAIL] 예상 사유 없음. 현재 disable 사유 후보: "${reasonSpan ?? "없음"}"`);
  }

  // ── 3-B: 알림톡 모드 + 양식 미선택 + 직접작성 미선택 → disable 사유 확인 ──
  console.log("\n[STEP 2] 알림톡 모드 + 양식/직접작성 미선택 → disable 사유 확인");

  const alimtalkBtn = page.locator("button").filter({ hasText: "알림톡" }).first();
  const alimtalkBtnVisible = await alimtalkBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (alimtalkBtnVisible) {
    await alimtalkBtn.click();
    await page.waitForTimeout(1000);
    console.log("[OK] 알림톡 모드 전환");
    await snap(page, "sc3-alimtalk-no-template");

    const bodyText2 = await page.locator("body").innerText().catch(() => "");
    const hasAlimtalkReason = bodyText2.includes("양식을 선택하거나 직접 작성해 주세요");
    console.log(`[CHECK] 3-B. 알림톡 미선택 → "양식을 선택하거나 직접 작성해 주세요": ${hasAlimtalkReason}`);
    if (hasAlimtalkReason) {
      console.log("[PASS] 알림톡 미선택 시 올바른 disable 사유 표시");
    } else {
      const allSpans2 = await page.locator("span").allInnerTexts();
      const reasonSpan2 = allSpans2.find((t) => t.includes("주세요") || t.includes("연동") || t.includes("초과"));
      console.log(`[FAIL] 예상 사유 없음. 현재 disable 사유 후보: "${reasonSpan2 ?? "없음"}"`);
    }
  } else {
    console.log("[SKIP] 알림톡 버튼 없음");
  }

  // ── 3-C: 학부모 + 학생 모두 해제 → "발송 대상을 선택해 주세요" ──
  console.log("\n[STEP 3] 학부모+학생 모두 해제 → disable 사유 확인");

  // SMS 모드로 돌아가서 테스트 (알림톡 보다 단순)
  const smsBtnForReset = page.locator("button").filter({ hasText: "SMS" }).first();
  const smsBtnVisible = await smsBtnForReset.isVisible({ timeout: 3000 }).catch(() => false);
  if (smsBtnVisible) {
    await smsBtnForReset.click();
    await page.waitForTimeout(800);
    console.log("[OK] SMS 모드 전환");
  }

  // 학부모 체크박스 해제
  const parentLabel = page.locator("label").filter({ hasText: /^학부모$/ }).first();
  const parentChk = parentLabel.locator('input[type="checkbox"]');
  const parentVisible = await parentChk.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[INFO] 학부모 체크박스 visible: ${parentVisible}`);

  if (parentVisible) {
    const parentChecked = await parentChk.isChecked();
    if (parentChecked) {
      await parentChk.uncheck();
      await page.waitForTimeout(400);
      console.log("[OK] 학부모 체크 해제");
    }
  } else {
    // 대안: label 텍스트로 찾기
    const parentChk2 = page.locator("label").filter({ hasText: "학부모" }).locator('input[type="checkbox"]');
    const alt2Visible = await parentChk2.isVisible({ timeout: 3000 }).catch(() => false);
    if (alt2Visible && (await parentChk2.isChecked())) {
      await parentChk2.uncheck();
      console.log("[OK] 학부모 체크 해제 (대안)");
    }
  }

  // 학생 체크박스 해제
  const studentLabel = page.locator("label").filter({ hasText: /^학생$/ }).first();
  const studentChk = studentLabel.locator('input[type="checkbox"]');
  const studentVisible = await studentChk.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[INFO] 학생 체크박스 visible: ${studentVisible}`);

  if (studentVisible) {
    const studentChecked = await studentChk.isChecked();
    if (studentChecked) {
      await studentChk.uncheck();
      await page.waitForTimeout(400);
      console.log("[OK] 학생 체크 해제");
    }
  } else {
    const studentChk2 = page.locator("label").filter({ hasText: "학생" }).locator('input[type="checkbox"]');
    const alt2Visible = await studentChk2.isVisible({ timeout: 3000 }).catch(() => false);
    if (alt2Visible && (await studentChk2.isChecked())) {
      await studentChk2.uncheck();
      console.log("[OK] 학생 체크 해제 (대안)");
    }
  }
  await page.waitForTimeout(500);
  await snap(page, "sc3-no-targets");

  const bodyText3 = await page.locator("body").innerText().catch(() => "");
  const hasNoTargetReason = bodyText3.includes("발송 대상을 선택해 주세요");
  console.log(`[CHECK] 3-C. 대상 모두 해제 → "발송 대상을 선택해 주세요": ${hasNoTargetReason}`);

  if (hasNoTargetReason) {
    console.log("[PASS] 대상 미선택 시 올바른 disable 사유 표시");
  } else {
    const allSpans3 = await page.locator("span").allInnerTexts();
    const reasonSpan3 = allSpans3.find((t) => t.includes("주세요") || t.includes("연동") || t.includes("초과") || t.includes("선택"));
    console.log(`[FAIL] 예상 사유 없음. 현재 disable 사유 후보: "${reasonSpan3 ?? "없음"}"`);
  }

  // "선택 필요" 인라인 텍스트 (체크박스 옆) 도 확인
  const selectNeeded = page.locator("text=선택 필요").first();
  const selectNeededVisible = await selectNeeded.isVisible({ timeout: 2000 }).catch(() => false);
  console.log(`[CHECK] 3-D. 체크박스 옆 "선택 필요" 인라인 표시: ${selectNeededVisible}`);

  await snap(page, "sc3-final");
  console.log("\n[DONE] 시나리오 3 완료");
});
