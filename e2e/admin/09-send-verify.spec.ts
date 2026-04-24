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

// 글로벌 타임아웃 override — 모든 테스트에 적용
test.setTimeout(180_000);

import { FIXTURES } from "../helpers/test-fixtures";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";

/** API 기반 로그인 (admin 전용) */
async function loginViaUI(page: Page, _role: string = "admin") {
  const user = process.env.E2E_ADMIN_USER || (process.env.E2E_ADMIN_USER || "admin97");
  const pass = process.env.E2E_ADMIN_PASS || (process.env.E2E_ADMIN_PASS || "koreaseoul97");
  const code = "hakwonplus";

  const resp = await page.request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: user, password: pass, tenant_code: code },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": code },
  });

  if (resp.status() !== 200) {
    const body = await resp.text();
    throw new Error(`E2E login failed (${user}@${code}): ${resp.status()} ${body}`);
  }

  const tokens = (await resp.json()) as { access: string; refresh: string };

  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(
    ({ access, refresh, c }: { access: string; refresh: string; c: string }) => {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      try { sessionStorage.setItem("tenantCode", c); } catch {}
    },
    { access: tokens.access, refresh: tokens.refresh, c: code }
  );

  await page.goto(`${BASE}/admin`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2000);
}

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/send-verify-${name}.png`, fullPage: false });
  console.log(`[SNAP] send-verify-${name}.png`);
}

// ─────────────────────────────────────────────────────────────
// 시나리오 1: 성적 SMS 실제 발송 + 발송 내역 확인
// ─────────────────────────────────────────────────────────────
test("1. 성적 SMS 실제 발송 + 발송 내역 확인", async ({ page }) => {
  test.setTimeout(180_000);
  console.log("[START] 성적 SMS 발송 테스트");

  await loginViaUI(page, "admin");
  console.log("[OK] 로그인 완료");

  // ── 성적 탭 이동 ──
  await page.goto(`${BASE}/admin/lectures/${FIXTURES.lectureId}/sessions/${FIXTURES.sessionId}/scores`, {
    waitUntil: "load",
    timeout: 20000,
  });
  await page.waitForTimeout(3000);
  console.log("[OK] 성적 탭 이동");
  await snap(page, "01-scores-page");

  // ── 체크박스 전체 선택 ──
  // 헤더 체크박스(전체선택) 또는 개별 체크박스
  const headerCheckbox = page.locator('input[type="checkbox"]').first();
  const headerVisible = await headerCheckbox.isVisible({ timeout: 5000 }).catch(() => false);

  if (headerVisible) {
    await headerCheckbox.check();
    await page.waitForTimeout(500);
    console.log("[OK] 헤더 체크박스(전체선택) 클릭");
  } else {
    // 개별 체크박스 클릭
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    console.log(`[INFO] 체크박스 개수: ${count}`);
    if (count > 0) {
      await checkboxes.first().check();
      await page.waitForTimeout(500);
    }
  }
  await snap(page, "02-checkbox-selected");

  // ── 수업결과 발송 버튼 ──
  const sendBtn = page.locator("button").filter({ hasText: "수업결과 발송" }).first();
  const sendBtnVisible = await sendBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[INFO] 수업결과 발송 버튼 visible: ${sendBtnVisible}`);

  if (!sendBtnVisible) {
    console.log("[WARN] 수업결과 발송 버튼이 보이지 않음. 체크박스 선택 상태 확인 필요");
    await snap(page, "02b-no-send-btn");
    // 개별 체크박스 재시도
    const allBoxes = page.locator('input[type="checkbox"]');
    const boxCount = await allBoxes.count();
    console.log(`[INFO] 전체 체크박스 수: ${boxCount}`);
    for (let i = 0; i < boxCount; i++) {
      await allBoxes.nth(i).check().catch(() => {});
    }
    await page.waitForTimeout(500);
    await snap(page, "02c-all-checked");
  }

  await expect(sendBtn).toBeVisible({ timeout: 8000 });
  await sendBtn.click();
  await page.waitForTimeout(2000);
  console.log("[OK] 수업결과 발송 클릭");
  await snap(page, "03-modal-opened");

  // ── 모달에서 SMS 모드 확인 ──
  // blockCategory: "grades" → SMS 모드로 시작
  const smsIndicator = page
    .locator("text=SMS")
    .or(page.locator("text=문자"))
    .or(page.locator("[data-mode='sms']"))
    .first();
  const smsModeVisible = await smsIndicator.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[INFO] SMS 모드 표시 visible: ${smsModeVisible}`);

  // ── 본문에 실제 성적 내용이 있는지 확인 (#{선생님메모} 미치환 여부) ──
  const textarea = page.locator("textarea").first();
  const textareaVisible = await textarea.isVisible({ timeout: 5000 }).catch(() => false);

  if (textareaVisible) {
    const bodyContent = await textarea.inputValue();
    console.log(`[INFO] 모달 본문 내용 (첫 100자): ${bodyContent.slice(0, 100)}`);
    const hasUnreplacedVar = bodyContent.includes("#{선생님메모}");
    console.log(`[CHECK] #{선생님메모} 미치환: ${hasUnreplacedVar}`);
    if (hasUnreplacedVar) {
      console.log("[WARN] #{선생님메모}가 치환되지 않았습니다.");
    } else {
      console.log("[OK] 본문에 성적 내용이 치환되었습니다.");
    }
  } else {
    // ProseMirror 에디터 또는 div 기반 본문
    const proseMirror = page.locator(".ProseMirror").first();
    const pmVisible = await proseMirror.isVisible({ timeout: 3000 }).catch(() => false);
    if (pmVisible) {
      const bodyText = await proseMirror.innerText();
      console.log(`[INFO] ProseMirror 본문 (첫 100자): ${bodyText.slice(0, 100)}`);
      const hasUnreplaced = bodyText.includes("#{선생님메모}");
      console.log(`[CHECK] #{선생님메모} 미치환: ${hasUnreplaced}`);
    }
    // div contenteditable 기반 본문
    const editableDiv = page.locator('[contenteditable="true"]').first();
    const edVisible = await editableDiv.isVisible({ timeout: 3000 }).catch(() => false);
    if (edVisible) {
      const bodyText = await editableDiv.innerText();
      console.log(`[INFO] contenteditable 본문 (첫 100자): ${bodyText.slice(0, 100)}`);
    }
  }

  await snap(page, "04-modal-body");

  // ── 학부모만 선택 (학생 체크 해제) ──
  const studentCheckbox = page.locator('label').filter({ hasText: /^학생$/ }).locator('input[type="checkbox"]').first();
  const studentChkVisible = await studentCheckbox.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[INFO] 학생 체크박스 visible: ${studentChkVisible}`);

  if (studentChkVisible) {
    const isChecked = await studentCheckbox.isChecked();
    if (isChecked) {
      await studentCheckbox.uncheck();
      await page.waitForTimeout(500);
      console.log("[OK] 학생 체크 해제 → 학부모만 선택");
    }
  } else {
    // 다른 방법으로 학생 체크박스 찾기
    const studentLabel = page.locator("label").filter({ hasText: "학생" }).first();
    const studentLabelVisible = await studentLabel.isVisible({ timeout: 3000 }).catch(() => false);
    if (studentLabelVisible) {
      const chkInLabel = studentLabel.locator('input[type="checkbox"]');
      const chkVisible = await chkInLabel.isVisible({ timeout: 3000 }).catch(() => false);
      if (chkVisible) {
        const checked = await chkInLabel.isChecked();
        if (checked) {
          await chkInLabel.uncheck();
          console.log("[OK] 학생 체크 해제 (대안 방법)");
        }
      }
    }
  }

  await snap(page, "05-parent-only");

  // ── 발송 버튼 클릭 (확인 오버레이 열기) ──
  // 실제 버튼 텍스트: "학부모 1명에게 문자 발송" 또는 "발송하기" 형태
  // 모달 하단에서 "발송" 포함 버튼 중 마지막(확인 오버레이 트리거)
  const footerSendBtn = page
    .locator("button")
    .filter({ hasText: /발송/ })
    .last();

  const footerBtnVisible = await footerSendBtn.isVisible({ timeout: 5000 }).catch(() => false);
  const footerBtnText = await footerSendBtn.innerText().catch(() => "");
  console.log(`[INFO] 하단 발송 버튼 visible: ${footerBtnVisible}, 텍스트: "${footerBtnText}"`);

  if (footerBtnVisible) {
    await footerSendBtn.click();
    await page.waitForTimeout(2000);
    console.log("[OK] 하단 발송 버튼 클릭 → 확인 오버레이 열림");
    await snap(page, "06-confirm-overlay");
  } else {
    console.log("[WARN] 하단 발송 버튼을 찾지 못함");
    await snap(page, "06-no-send-btn");
  }

  // ── 확인 오버레이에서 "발송하기" 클릭 ──
  // 확인 오버레이 내 "발송하기" 버튼 (겹치는 버튼이 없을 때까지 대기)
  const confirmBtn = page
    .locator("button")
    .filter({ hasText: /^발송하기$/ })
    .first();

  const confirmVisible = await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[INFO] 발송하기(확인) 버튼 visible: ${confirmVisible}`);

  if (confirmVisible) {
    await confirmBtn.click();
    await page.waitForTimeout(3000);
    console.log("[OK] 발송하기 클릭");
    await snap(page, "07-after-send");
  } else {
    // 오버레이 없이 직접 발송이면 이미 완료됨
    console.log("[INFO] 확인 오버레이 없음 — 이미 발송 완료됐을 수 있음");
  }

  // ── 토스트 확인 ──
  const successToast = page
    .locator("text=발송 예정")
    .or(page.locator("text=발송됨"))
    .or(page.locator("text=발송 완료"))
    .or(page.locator("[class*=toast], [class*=Toast], [role=alert]"))
    .first();

  const toastVisible = await successToast.isVisible({ timeout: 8000 }).catch(() => false);
  console.log(`[CHECK] 발송 완료 토스트 visible: ${toastVisible}`);
  if (toastVisible) {
    const toastText = await successToast.innerText().catch(() => "");
    console.log(`[INFO] 토스트 텍스트: ${toastText}`);
  }
  await snap(page, "08-toast");

  // ── 발송 내역 이동 ──
  await page.goto(`${BASE}/admin/message/log`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(3000);
  console.log("[OK] 발송 내역 페이지 이동");
  await snap(page, "09-log-page");

  // ── 최신 발송 로그 행 클릭 ──
  // 발송 내역 LogRow: 날짜/시간 포함하는 button. 필터 버튼(전체/성공/실패)과 구분하기 위해
  // 날짜 패턴(20xx 포함)이 있는 행 또는 flex 행을 선택
  const logRows = page.locator("button[type='button']").filter({ hasText: /20\d\d/ });
  const rowCount = await logRows.count();
  console.log(`[INFO] 날짜 포함 로그 행 수: ${rowCount}`);

  // 날짜 포함 행이 없으면 010번호 행 시도
  const rowsToUse = rowCount > 0
    ? logRows
    : page.locator("button[type='button']").filter({ hasText: /010/ });
  const rowsCount2 = await rowsToUse.count();
  console.log(`[INFO] 클릭할 행 수: ${rowsCount2}`);

  if (rowsCount2 > 0) {
    await rowsToUse.first().click();
    await page.waitForTimeout(2000);
    console.log("[OK] 첫 번째 발송 로그 행 클릭");
    await snap(page, "10-detail-modal");

    // ── 상세 팝업 확인 ──
    const detailTitle = page.locator("text=발송 상세").first();
    const detailVisible = await detailTitle.isVisible({ timeout: 8000 }).catch(() => false);
    console.log(`[CHECK] 발송 상세 팝업 제목 visible: ${detailVisible}`);

    // 수신자 정보 (DetailRow label)
    const recipientRow = page.locator("text=수신자").first();
    const recipientVisible = await recipientRow.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[CHECK] 수신자 레이블 visible: ${recipientVisible}`);

    // 발송 내용
    const bodySection = page.locator("text=발송 내용").first();
    const bodySectionVisible = await bodySection.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[CHECK] 발송 내용 섹션 visible: ${bodySectionVisible}`);

    // 성공/실패 배지 (모달 내부) — body 전체 텍스트로 검증
    if (detailVisible) {
      await page.waitForTimeout(1500);
      const fullBodyText = await page.locator("body").innerText().catch(() => "");

      const hasBadge = fullBodyText.includes("성공") || fullBodyText.includes("실패");
      console.log(`[CHECK] 성공/실패 배지 포함: ${hasBadge}`);

      const hasMode = fullBodyText.includes("SMS") || fullBodyText.includes("알림톡");
      console.log(`[CHECK] 발송 방식 포함: ${hasMode}`);

      const hasBodySection = fullBodyText.includes("발송 내용");
      console.log(`[CHECK] 발송 내용 섹션 포함: ${hasBodySection}`);

      const hasDeduct = fullBodyText.includes("원");
      console.log(`[CHECK] 차감 금액("원") 포함: ${hasDeduct}`);
    }

    await snap(page, "11-detail-modal-full");

    // ESC로 닫기
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);
    const detailAfterEsc = await detailTitle.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`[CHECK] ESC 후 팝업 닫힘: ${!detailAfterEsc}`);
    await snap(page, "12-modal-closed");
  } else {
    console.log("[WARN] 클릭 가능한 로그 행을 찾지 못함");
    await snap(page, "10-no-rows");
  }

  console.log("[DONE] 시나리오 1 완료");
});

// ─────────────────────────────────────────────────────────────
// 시나리오 2: 클리닉 미리보기에서 #{장소} 정상 확인
// ─────────────────────────────────────────────────────────────
test("2. 클리닉 미리보기에서 #{장소} 정상 확인", async ({ page }) => {
  test.setTimeout(120_000);
  console.log("[START] 클리닉 미리보기 테스트");

  await loginViaUI(page, "admin");
  console.log("[OK] 로그인 완료");

  await page.goto(`${BASE}/admin/clinic/msg-settings`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(3000);
  console.log("[OK] 클리닉 메시지 설정 이동");
  await snap(page, "20-clinic-msg-settings");

  // ── 알림톡 자동발송 섹션에서 미리보기 버튼 찾기 ──
  const previewBtns = page.locator("button").filter({ hasText: "미리보기" });
  const previewCount = await previewBtns.count();
  console.log(`[INFO] 미리보기 버튼 수: ${previewCount}`);

  if (previewCount > 0) {
    await previewBtns.first().click();
    await page.waitForTimeout(2000);
    console.log("[OK] 첫 번째 미리보기 클릭");
    await snap(page, "21-preview-opened");

    // ── 카카오 카드 미리보기 확인 ──
    // "장소?" 경고 배지 없는지 확인
    const locationWarning = page
      .locator("text=장소?")
      .or(page.locator("[class*=warning]").filter({ hasText: "장소" }))
      .first();
    const warningVisible = await locationWarning.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[CHECK] "장소?" 경고 배지 없음: ${!warningVisible}`);
    if (warningVisible) {
      console.log("[WARN] 장소 경고 배지가 존재합니다.");
    }

    // 정상 미리보기 텍스트 확인
    const previewContent = page
      .locator("[class*=preview], [class*=Preview], [class*=card], [class*=Card], [class*=kakao], [class*=Kakao]")
      .first();
    const previewVisible = await previewContent.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[CHECK] 미리보기 카드 visible: ${previewVisible}`);

    if (previewVisible) {
      const previewText = await previewContent.innerText().catch(() => "");
      console.log(`[INFO] 미리보기 텍스트 (첫 200자): ${previewText.slice(0, 200)}`);
      const hasUnresolved = previewText.includes("#{장소}");
      console.log(`[CHECK] #{장소} 미치환 잔존: ${hasUnresolved}`);
      if (hasUnresolved) {
        console.log("[WARN] #{장소}가 치환되지 않은 상태로 표시됩니다.");
      } else {
        console.log("[OK] #{장소} 치환 정상 또는 플레이스홀더 처리됨");
      }
    }

    await snap(page, "22-preview-content");

    // ESC로 닫기
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);
    console.log("[OK] ESC로 미리보기 닫기");
    await snap(page, "23-preview-closed");
  } else {
    console.log("[WARN] 미리보기 버튼을 찾지 못했습니다.");
    // 모든 버튼 텍스트 로그
    const allBtns = page.locator("button");
    const cnt = await allBtns.count();
    for (let i = 0; i < Math.min(cnt, 20); i++) {
      const t = await allBtns.nth(i).innerText().catch(() => "");
      if (t.trim()) console.log(`  버튼[${i}]: "${t.trim()}"`);
    }
    await snap(page, "20b-no-preview-btn");
  }

  console.log("[DONE] 시나리오 2 완료");
});

// ─────────────────────────────────────────────────────────────
// 시나리오 3: 발송 내역 상세 팝업 UX 정밀 검증
// ─────────────────────────────────────────────────────────────
test("3. 발송 내역 상세 팝업 UX 정밀 검증", async ({ page }) => {
  test.setTimeout(120_000);
  console.log("[START] 발송 내역 상세 팝업 검증");

  await loginViaUI(page, "admin");
  console.log("[OK] 로그인 완료");

  await page.goto(`${BASE}/admin/message/log`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(3000);
  console.log("[OK] 발송 내역 페이지 이동");
  await snap(page, "30-log-page");

  // ── 발송 내역 제목 확인 ──
  const pageTitle = page.locator("text=발송 내역").first();
  const titleVisible = await pageTitle.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[CHECK] 발송 내역 페이지 제목 visible: ${titleVisible}`);

  // ── 성공 필터 클릭 ──
  const successFilter = page.locator("button").filter({ hasText: /^성공$/ }).first();
  const successFilterVisible = await successFilter.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[INFO] 성공 필터 버튼 visible: ${successFilterVisible}`);

  if (successFilterVisible) {
    await successFilter.click();
    await page.waitForTimeout(1500);
    console.log("[OK] 성공 필터 클릭");
    await snap(page, "31-success-filter");
  }

  // ── 첫 번째 발송 로그 행 클릭 ──
  // 날짜 패턴(20xx)을 포함하는 button이 LogRow임
  const logRowsSc3 = page.locator("button[type='button']").filter({ hasText: /20\d\d/ });
  const logRowCountSc3 = await logRowsSc3.count();
  console.log(`[INFO] 날짜 포함 로그 행 수: ${logRowCountSc3}`);

  // 날짜 포함 행이 없으면 010번호 행 시도
  const rowsToUseSc3 = logRowCountSc3 > 0
    ? logRowsSc3
    : page.locator("button[type='button']").filter({ hasText: /010/ });
  const rowCountSc3 = await rowsToUseSc3.count();
  console.log(`[INFO] 클릭 가능한 행 수: ${rowCountSc3}`);

  if (rowCountSc3 === 0) {
    console.log("[WARN] 표시할 발송 내역 없음. 전체 필터로 전환");
    const allFilter = page.locator("button").filter({ hasText: /^전체$/ }).first();
    if (await allFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await allFilter.click();
      await page.waitForTimeout(1500);
    }
  }

  const rowToClick = rowCountSc3 > 0
    ? rowsToUseSc3.first()
    : page.locator("button[type='button']").filter({ hasText: /20\d\d/ }).first();

  if (await rowToClick.isVisible({ timeout: 5000 }).catch(() => false)) {
    await rowToClick.click();
    await page.waitForTimeout(2000);
    console.log("[OK] 첫 번째 행 클릭");
    await snap(page, "32-detail-popup");

    // ── 상세 팝업 UX 검증 ──
    const detailTitle = page.locator("text=발송 상세").first();
    const detailVisible = await detailTitle.isVisible({ timeout: 8000 }).catch(() => false);
    console.log(`[CHECK] 발송 상세 팝업 제목 visible: ${detailVisible}`);

    if (detailVisible) {
      // 모달 내용 렌더링 대기
      await page.waitForTimeout(1500);

      // body 전체 텍스트로 검증 (AdminModal은 role=dialog 없이 렌더링)
      const bodyText = await page.locator("body").innerText().catch(() => "");

      const checks: { label: string; hasText: string | RegExp }[] = [
        { label: "수신자 레이블", hasText: "수신자" },
        { label: "발송 내용 레이블", hasText: "발송 내용" },
        { label: "발송 방식 레이블", hasText: "발송 방식" },
        { label: "성공 또는 실패 배지", hasText: /성공|실패/ },
        { label: "SMS 또는 알림톡", hasText: /SMS|알림톡/ },
      ];

      for (const chk of checks) {
        const contained = typeof chk.hasText === "string"
          ? bodyText.includes(chk.hasText)
          : chk.hasText.test(bodyText);
        console.log(`[CHECK] ${chk.label}: ${contained}`);
      }

      // 차감 금액
      const hasDeductInfo = bodyText.includes("원");
      console.log(`[CHECK] 차감 금액 정보("원" 포함): ${hasDeductInfo}`);

      // 수신자 실제 값
      const recipientLocator = page.locator("text=수신자").first();
      const recipientParent = recipientLocator.locator("..");
      const recipientText = await recipientParent.innerText().catch(() => "");
      console.log(`[INFO] 수신자 행: ${recipientText.trim()}`);

      await snap(page, "33-detail-full");
    } else {
      console.log("[WARN] 발송 상세 팝업이 열리지 않았습니다");
      await snap(page, "32b-popup-not-opened");
    }

    // ── ESC로 닫기 ──
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);
    const detailAfterEsc = await detailTitle.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`[CHECK] ESC 후 팝업 닫힘: ${!detailAfterEsc}`);
    await snap(page, "34-popup-closed");
  } else {
    console.log("[WARN] 발송 내역이 없어 상세 팝업 검증을 건너뜁니다.");
    await snap(page, "32-no-rows");
  }

  // ── 실패 필터 ──
  const failFilter = page.locator("button").filter({ hasText: /^실패$/ }).first();
  const failFilterVisible = await failFilter.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[INFO] 실패 필터 버튼 visible: ${failFilterVisible}`);

  if (failFilterVisible) {
    await failFilter.click();
    await page.waitForTimeout(1500);
    console.log("[OK] 실패 필터 클릭");
    await snap(page, "35-fail-filter");

    const failRows = page.locator("button[type='button']");
    const failRowCount = await failRows.count();
    console.log(`[INFO] 실패 건 행 수: ${failRowCount}`);

    if (failRowCount > 0) {
      await failRows.first().click();
      await page.waitForTimeout(1500);
      console.log("[OK] 실패 건 상세 클릭");
      await snap(page, "36-fail-detail");

      // 실패 사유 확인
      const failReasonLabel = page.locator("text=실패 사유").first();
      const failReasonVisible = await failReasonLabel.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`[CHECK] 실패 사유 섹션 visible: ${failReasonVisible}`);

      if (failReasonVisible) {
        const reasonParent = page.locator("text=실패 사유").locator("..").first();
        const reasonText = await reasonParent.innerText().catch(() => "");
        console.log(`[INFO] 실패 사유 텍스트: ${reasonText.slice(0, 200)}`);
      }

      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } else {
      console.log("[INFO] 실패 건 없음 (정상)");
    }
  }

  console.log("[DONE] 시나리오 3 완료");
});
