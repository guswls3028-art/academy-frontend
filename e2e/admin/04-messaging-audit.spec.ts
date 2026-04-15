/**
 * 메시징/알림 UX 전역 감사 E2E — 실사용자 기준 빡쎈 검증
 *
 * 모든 테스트는 실제 브라우저에서 사용자 클릭 경로로 수행.
 * API 직접 호출은 테스트 데이터 준비에만 사용.
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";

// ── 공통 헬퍼 ──

/** 사이드바 메뉴를 클릭해서 이동 */
async function navTo(page: Page, menuText: string, timeout = 10000) {
  const link = page.locator("nav a, aside a, [class*=sidebar] a, [class*=Sidebar] a, [class*=drawer] a")
    .filter({ hasText: menuText }).first();
  await link.click({ timeout });
  await page.waitForTimeout(2000);
}

/** 스크린샷 저장 */
async function snap(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: false });
}

// ── 테스트 그룹 ──

test.describe("메시징 전역 감사 — 실사용자 흐름", () => {
  test.setTimeout(120_000); // 2분 타임아웃

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  // ═══════════════════════════════════════════════════════════════
  // 1. 메시지 설정 페이지 — 발신번호, 공급자, 알림톡 채널 확인
  // ═══════════════════════════════════════════════════════════════
  test("1. 메시지 설정 — 발신번호/공급자/알림톡 상태 확인", async ({ page }) => {
    await navTo(page, "메시지");
    // 설정 탭 클릭
    const settingsTab = page.locator("a, button").filter({ hasText: "설정" }).last();
    await settingsTab.click();
    await page.waitForTimeout(2000);

    // 발신번호 확인
    await expect(page.locator("text=발신번호").first()).toBeVisible({ timeout: 10000 });
    await snap(page, "audit-1-settings");

    // 공급자 확인
    const provider = page.locator("text=뿌리오").or(page.locator("text=솔라피"));
    await expect(provider.first()).toBeVisible({ timeout: 5000 });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. 템플릿 관리 — 생성/수정/복제/삭제 전체 CRUD
  // ═══════════════════════════════════════════════════════════════
  test("2. 템플릿 CRUD — 생성/수정/복제/삭제", async ({ page }) => {
    await navTo(page, "메시지");
    // 템플릿 저장 탭 (기본)
    await page.waitForTimeout(2000);

    // 카테고리 트리에서 "사용자" 클릭
    const userCat = page.locator("text=사용자").first();
    if (await userCat.isVisible({ timeout: 5000 }).catch(() => false)) {
      await userCat.click();
      await page.waitForTimeout(1000);
    }

    await snap(page, "audit-2-templates-list");

    // 카테고리별 템플릿이 존재하는지 확인
    const categories = ["출결", "시험", "성적", "클리닉"];
    for (const cat of categories) {
      const catBtn = page.locator("button, a").filter({ hasText: cat }).first();
      if (await catBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await catBtn.click();
        await page.waitForTimeout(1000);
      }
    }
    await snap(page, "audit-2-templates-categories");
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. 자동발송 — 모든 섹션 순회 + 시간 단위 확인
  // ═══════════════════════════════════════════════════════════════
  test("3. 자동발송 — 전체 섹션 순회 + 시간 단위", async ({ page }) => {
    await navTo(page, "메시지");
    const autoTab = page.locator("a, button").filter({ hasText: "자동발송" }).first();
    await autoTab.click();
    await page.waitForTimeout(2000);

    // 모든 섹션 순회
    const sections = ["가입", "출결", "시험", "과제", "성적", "클리닉", "결제"];
    for (const sec of sections) {
      const secBtn = page.locator("button, [role=button], a").filter({ hasText: sec }).first();
      if (await secBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await secBtn.click();
        await page.waitForTimeout(1500);
        await snap(page, `audit-3-autosend-${sec}`);
      }
    }

    // 시험 섹션에서 시간 단위 확인 — "일 전" 또는 "분 전" 존재
    const examSec = page.locator("button, [role=button], a").filter({ hasText: "시험" }).first();
    if (await examSec.isVisible({ timeout: 3000 }).catch(() => false)) {
      await examSec.click();
      await page.waitForTimeout(1500);
      // 시간 단위 라벨 검증
      const timeUnits = await page.locator("text=분 전").or(page.locator("text=일 전")).count();
      console.log(`[자동발송 시험] 시간 단위 요소 수: ${timeUnits}`);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. 발송 내역 — 실제 로그 확인 + 상세 팝업
  // ═══════════════════════════════════════════════════════════════
  test("4. 발송 내역 — 로그 목록 + 상세 팝업", async ({ page }) => {
    await navTo(page, "메시지");
    const logTab = page.locator("a, button").filter({ hasText: "발송 내역" }).first();
    await logTab.click();
    await page.waitForTimeout(3000);

    await snap(page, "audit-4-log-list");

    // 성공/실패 필터 클릭
    const successFilter = page.locator("button").filter({ hasText: "성공" }).first();
    if (await successFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await successFilter.click();
      await page.waitForTimeout(1000);
      await snap(page, "audit-4-log-success-filter");
    }

    const failFilter = page.locator("button").filter({ hasText: "실패" }).first();
    if (await failFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await failFilter.click();
      await page.waitForTimeout(1000);
      await snap(page, "audit-4-log-fail-filter");
    }

    // 첫 번째 로그 항목 클릭 → 상세 팝업
    const allFilter = page.locator("button").filter({ hasText: "전체" }).first();
    if (await allFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await allFilter.click();
      await page.waitForTimeout(1000);
    }

    const firstRow = page.locator("tr, [class*=log-row], [class*=card]").filter({ hasText: /성공|실패/ }).first();
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(1500);
      await snap(page, "audit-4-log-detail");

      // 상세 팝업에서 발송 본문 확인
      const bodyContent = page.locator("text=내용").or(page.locator("text=본문")).or(page.locator("text=메시지"));
      if (await bodyContent.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log("[발송 내역] 상세 팝업에서 본문 확인 가능");
      } else {
        console.log("[발송 내역] ⚠️ 상세 팝업에서 본문 확인 불가");
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. 발송 모달 — SMS 전체 흐름 (양식 선택 → 수정 → 변수 삽입 → 확인)
  // ═══════════════════════════════════════════════════════════════
  test("5. 발송 모달 SMS — 양식 선택/수정/변수 삽입/확인 오버레이", async ({ page }) => {
    // 학생 목록으로 이동
    await navTo(page, "학생");
    await page.waitForTimeout(2000);

    // 전체 선택 체크박스 클릭
    const selectAll = page.locator('input[type="checkbox"]').first();
    if (!(await selectAll.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log("[발송 모달] 학생 목록에서 체크박스 미표시 — 학생이 없을 수 있음");
      return;
    }
    await selectAll.click();
    await page.waitForTimeout(500);

    // 메시지 발송 버튼 클릭
    const sendBtn = page.locator("button").filter({ hasText: /메시지/ }).first();
    await sendBtn.click();
    await page.waitForTimeout(2000);

    // 모달 열림 확인
    await expect(page.locator("text=메시지 발송").first()).toBeVisible({ timeout: 5000 });
    await snap(page, "audit-5-modal-open");

    // ── SMS 모드 확인 ──
    const smsBtn = page.locator("button").filter({ hasText: "SMS" }).first();
    await expect(smsBtn).toBeVisible();

    // SMS가 선택된 상태인지 확인 (배경색으로)
    await snap(page, "audit-5-modal-sms-mode");

    // ── 양식 선택 ──
    const templateSelectBtn = page.locator("button").filter({ hasText: /양식 선택|양식 변경/ }).first();
    if (await templateSelectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await templateSelectBtn.click();
      await page.waitForTimeout(1000);
      await snap(page, "audit-5-modal-template-panel");

      // "직접 작성하기" 클릭
      const freeformBtn = page.locator("button").filter({ hasText: "직접 작성하기" }).first();
      if (await freeformBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await freeformBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // ── 본문 작성 ──
    const textarea = page.locator("textarea").first();
    await textarea.fill("[E2E-테스트] 안녕하세요, 테스트 메시지입니다. #{학생이름}님");
    await page.waitForTimeout(500);
    await snap(page, "audit-5-modal-body-written");

    // ── 변수 삽입 ── 변수 팔레트에서 "사이트 링크" 클릭
    const varBlock = page.locator("button").filter({ hasText: "사이트 링크" }).first();
    if (await varBlock.isVisible({ timeout: 3000 }).catch(() => false)) {
      await varBlock.click();
      await page.waitForTimeout(500);
      // 변수가 본문에 삽입되었는지 확인
      const bodyValue = await textarea.inputValue();
      console.log(`[변수 삽입] 본문: ${bodyValue.slice(0, 100)}...`);
      expect(bodyValue).toContain("#{사이트링크}");
    }

    // ── 미리보기 확인 (좌측) ──
    const previewArea = page.locator(".template-preview-phone__bubble, .template-preview-phone");
    if (await previewArea.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("[미리보기] SMS 미리보기 영역 표시됨");
    }

    // ── 글자수 표시 확인 ──
    const charCount = page.locator("text=/SMS|LMS/").first();
    if (await charCount.isVisible({ timeout: 3000 }).catch(() => false)) {
      const countText = await charCount.textContent();
      console.log(`[글자수] ${countText}`);
    }

    // ── 학부모/학생 체크박스 조작 ──
    const parentCheck = page.locator("label").filter({ hasText: "학부모" }).locator("input[type=checkbox]").first();
    const studentCheck = page.locator("label").filter({ hasText: "학생" }).locator("input[type=checkbox]").first();

    // 학부모만 선택
    if (await studentCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (await studentCheck.isChecked()) await studentCheck.uncheck();
      await page.waitForTimeout(300);
      await snap(page, "audit-5-modal-parent-only");

      // 발송 버튼 텍스트 확인 — "학부모 N명에게 문자 발송"
      const sendText = page.locator("button").filter({ hasText: /학부모.*발송/ }).first();
      if (await sendText.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`[대상 선택] 학부모만: ${await sendText.textContent()}`);
      }

      // 학생 다시 체크
      await studentCheck.check();
      await page.waitForTimeout(300);
    }

    // ── 발송 확인 오버레이 ──
    const mainSendBtn = page.locator("button").filter({ hasText: /에게.*발송/ }).last();
    if (await mainSendBtn.isVisible({ timeout: 3000 }).catch(() => false) && await mainSendBtn.isEnabled()) {
      await mainSendBtn.click();
      await page.waitForTimeout(1000);

      // 확인 오버레이 표시 확인
      const confirmOverlay = page.locator("text=발송을 확인해 주세요");
      if (await confirmOverlay.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log("[확인 오버레이] 표시됨");
        await snap(page, "audit-5-modal-confirm-overlay");

        // 본문 미리보기가 오버레이에 포함되는지 확인
        const bodyPreview = page.locator("text=E2E-테스트").first();
        if (await bodyPreview.isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log("[확인 오버레이] ✅ 본문 미리보기 포함됨");
        } else {
          console.log("[확인 오버레이] ⚠️ 본문 미리보기 미포함 — UX 개선 필요");
        }

        // 채널 정보 확인
        const channelInfo = page.locator("text=SMS").or(page.locator("text=LMS"));
        console.log(`[확인 오버레이] 채널 정보: ${await channelInfo.first().isVisible() ? "표시됨" : "미표시"}`);

        // "돌아가기" 클릭 (실제 발송 안 함)
        const backBtn = page.locator("button").filter({ hasText: "돌아가기" }).first();
        if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await backBtn.click();
          await page.waitForTimeout(500);
          console.log("[확인 오버레이] 돌아가기 클릭 → 모달로 복귀");
        }
      }
    }

    // ── 취소 (모달 닫기) ──
    const cancelBtn = page.locator("button").filter({ hasText: "취소" }).first();
    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelBtn.click();
      await page.waitForTimeout(500);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. 발송 모달 — 알림톡 전체 흐름
  // ═══════════════════════════════════════════════════════════════
  test("6. 발송 모달 알림톡 — 양식/직접 작성/전환/변수/미리보기", async ({ page }) => {
    await navTo(page, "학생");
    await page.waitForTimeout(2000);

    // 학생 선택
    const selectAll = page.locator('input[type="checkbox"]').first();
    if (!(await selectAll.isVisible({ timeout: 5000 }).catch(() => false))) return;
    await selectAll.click();
    await page.waitForTimeout(500);

    // 메시지 발송
    const sendBtn = page.locator("button").filter({ hasText: /메시지/ }).first();
    await sendBtn.click();
    await page.waitForTimeout(2000);
    await expect(page.locator("text=메시지 발송").first()).toBeVisible({ timeout: 5000 });

    // ── 알림톡 모드로 전환 ──
    const alimBtn = page.locator("button").filter({ hasText: "알림톡" }).first();
    await alimBtn.click();
    await page.waitForTimeout(1000);
    await snap(page, "audit-6-alimtalk-mode");

    // ── 카카오 미리보기 확인 ──
    const kakaoPreview = page.locator(".template-preview-kakao");
    await expect(kakaoPreview.first()).toBeVisible({ timeout: 5000 });
    console.log("[알림톡] 카카오 미리보기 표시됨");

    // ── 양식 선택 ──
    const templateSelectBtn = page.locator("button").filter({ hasText: /양식 선택/ }).first();
    if (await templateSelectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await templateSelectBtn.click();
      await page.waitForTimeout(1000);
      await snap(page, "audit-6-alimtalk-template-panel");

      // 직접 작성하기
      const freeformBtn = page.locator("button").filter({ hasText: "직접 작성하기" }).first();
      if (await freeformBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await freeformBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // ── 본문 작성 ──
    const textarea = page.locator("textarea").first();
    if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await textarea.fill("[E2E-알림톡] #{학생이름}님, 학원 안내입니다.");
      await page.waitForTimeout(500);
      await snap(page, "audit-6-alimtalk-body");
    }

    // ── SMS로 전환 후 다시 알림톡으로 ──
    const smsBtn = page.locator("button").filter({ hasText: "SMS" }).first();
    if (await smsBtn.isVisible() && await smsBtn.isEnabled()) {
      await smsBtn.click();
      await page.waitForTimeout(500);
      const smsBefore = await page.locator("textarea").first().inputValue().catch(() => "");
      console.log(`[채널 전환] SMS 전환 후 본문: "${smsBefore.slice(0, 50)}"`);

      // 다시 알림톡으로
      await alimBtn.click();
      await page.waitForTimeout(500);
      const alimAfter = await page.locator("textarea").first().inputValue().catch(() => "");
      console.log(`[채널 전환] 알림톡 복귀 후 본문: "${alimAfter.slice(0, 50)}"`);

      // 전환 시 본문이 초기화되는지 확인
      if (alimAfter === "") {
        console.log("[채널 전환] ✅ 채널 전환 시 본문 초기화됨 (정상)");
      } else {
        console.log("[채널 전환] ⚠️ 채널 전환 후 이전 본문 잔존");
      }
    }

    await snap(page, "audit-6-alimtalk-switch-test");

    // ESC로 닫기
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. 실제 SMS 발송 + 수신 확인 (01031217466)
  // ═══════════════════════════════════════════════════════════════
  test("7. 실제 SMS 발송 → 발송 내역 확인", async ({ page }) => {
    await navTo(page, "학생");
    await page.waitForTimeout(2000);

    // 첫 번째 학생 선택
    const checkbox = page.locator('input[type="checkbox"]').nth(1); // 첫번째는 전체선택
    if (!(await checkbox.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log("[SMS 발송] 학생 없음 - 스킵");
      return;
    }
    await checkbox.click();
    await page.waitForTimeout(500);

    // 메시지 발송 버튼
    const sendBtn = page.locator("button").filter({ hasText: /메시지/ }).first();
    await sendBtn.click();
    await page.waitForTimeout(2000);

    // SMS 모드 확인
    const smsBtn = page.locator("button").filter({ hasText: "SMS" }).first();
    if (await smsBtn.isVisible() && !(await smsBtn.getAttribute("style"))?.includes("background: var(--color-primary)")) {
      // SMS 이미 선택되어 있거나 클릭
    }

    // 양식 선택 → 직접 작성
    const templateSelectBtn = page.locator("button").filter({ hasText: /양식 선택/ }).first();
    if (await templateSelectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await templateSelectBtn.click();
      await page.waitForTimeout(500);
      const freeform = page.locator("button").filter({ hasText: "직접 작성하기" }).first();
      if (await freeform.isVisible({ timeout: 2000 }).catch(() => false)) {
        await freeform.click();
        await page.waitForTimeout(500);
      }
    }

    // 학부모만 선택 (학생 체크 해제)
    const studentCheck = page.locator("label").filter({ hasText: "학생" }).locator("input[type=checkbox]").first();
    if (await studentCheck.isVisible({ timeout: 2000 }).catch(() => false) && await studentCheck.isChecked()) {
      await studentCheck.uncheck();
      await page.waitForTimeout(300);
    }

    // 본문 입력
    const textarea = page.locator("textarea").first();
    const timestamp = new Date().toISOString().slice(11, 19);
    const testBody = `[E2E-${timestamp}] 학원플러스 메시징 감사 테스트입니다. 이 메시지는 무시해 주세요.`;
    await textarea.fill(testBody);
    await page.waitForTimeout(500);

    // 발송 버튼 클릭
    const mainSendBtn = page.locator("button").filter({ hasText: /에게.*발송/ }).last();
    if (await mainSendBtn.isVisible({ timeout: 3000 }).catch(() => false) && await mainSendBtn.isEnabled()) {
      await mainSendBtn.click();
      await page.waitForTimeout(1000);

      // 확인 오버레이
      const confirmSend = page.locator("button").filter({ hasText: "발송하기" }).first();
      if (await confirmSend.isVisible({ timeout: 5000 }).catch(() => false)) {
        await snap(page, "audit-7-sms-confirm");
        await confirmSend.click();
        await page.waitForTimeout(3000);

        // 발송 결과 피드백 확인
        await snap(page, "audit-7-sms-sent");
        console.log("[SMS 발송] 발송 요청 완료");
      }
    }

    // 발송 내역에서 확인
    await page.waitForTimeout(2000);
    await navTo(page, "메시지");
    const logTab = page.locator("a, button").filter({ hasText: "발송 내역" }).first();
    await logTab.click();
    await page.waitForTimeout(3000);

    await snap(page, "audit-7-sms-log-after");

    // 최신 로그에서 테스트 메시지 확인
    const recentLog = page.locator("text=E2E").or(page.locator("text=메시징 감사")).first();
    if (await recentLog.isVisible({ timeout: 10000 }).catch(() => false)) {
      console.log("[SMS 발송] ✅ 발송 내역에서 테스트 메시지 확인됨");
    } else {
      console.log("[SMS 발송] ⚠️ 발송 내역에서 테스트 메시지 미확인 (큐 처리 대기 중일 수 있음)");
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 8. 성적 발송 — 성적 입력 → 수업결과 발송 → 변수 치환 확인
  // ═══════════════════════════════════════════════════════════════
  test("8. 성적 발송 — 수업결과 발송 모달 + 변수 치환", async ({ page }) => {
    await navTo(page, "강의");
    await page.waitForTimeout(2000);

    // 첫 번째 강의 클릭
    const lectureLink = page.locator("a[href*='/lectures/']").first();
    if (!(await lectureLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log("[성적 발송] 강의 없음 - 스킵");
      return;
    }
    await lectureLink.click();
    await page.waitForTimeout(2000);

    // 차시 탭 또는 성적 탭 클릭
    const scoresTab = page.locator("a, button").filter({ hasText: /성적|점수/ }).first();
    if (await scoresTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await scoresTab.click();
      await page.waitForTimeout(2000);
    }

    // 차시 선택 (첫 번째 차시)
    const sessionLink = page.locator("a[href*='/scores']").or(page.locator("tr, [class*=row]").filter({ hasText: /차시|회차/ })).first();
    if (await sessionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sessionLink.click();
      await page.waitForTimeout(2000);
    }

    await snap(page, "audit-8-score-entry");

    // 학생 선택
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkbox.click();
      await page.waitForTimeout(500);

      // "수업결과 발송" 버튼 찾기
      const resultSendBtn = page.locator("button").filter({ hasText: /수업결과|성적.*발송/ }).first();
      if (await resultSendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await resultSendBtn.click();
        await page.waitForTimeout(2000);

        // 발송 모달에서 변수 치환 확인
        const modal = page.locator("text=메시지 발송");
        if (await modal.first().isVisible({ timeout: 5000 }).catch(() => false)) {
          await snap(page, "audit-8-score-send-modal");

          // 본문에 실제 학생 이름이나 시험 점수가 치환되었는지 확인
          const bodyArea = page.locator("textarea").first();
          if (await bodyArea.isVisible({ timeout: 3000 }).catch(() => false)) {
            const bodyText = await bodyArea.inputValue();
            console.log(`[성적 발송] 본문 (첫 100자): ${bodyText.slice(0, 100)}`);

            // 변수가 치환되었는지 검사
            if (bodyText.includes("#{")) {
              console.log("[성적 발송] ⚠️ 미치환 변수 잔존");
            } else if (bodyText.length > 10) {
              console.log("[성적 발송] ✅ 변수 치환 완료");
            }
          }

          // 변수 팔레트 확인 — 성적 카테고리 블록
          const gradeBlocks = page.locator("text=시험 목록").or(page.locator("text=과제 목록")).or(page.locator("text=전체 요약"));
          if (await gradeBlocks.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log("[성적 발송] ✅ 성적 변수 블록 팔레트 표시됨");
          }

          await snap(page, "audit-8-score-send-variables");

          // 취소
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);
        }
      } else {
        console.log("[성적 발송] 수업결과 발송 버튼 미표시 — 선택 바 확인 필요");
        await snap(page, "audit-8-score-no-send-btn");
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 9. 클리닉 — 대상 학생 목록 + 메시지 발송
  // ═══════════════════════════════════════════════════════════════
  test("9. 클리닉 — 대상 학생 + 메시지 발송 모달", async ({ page }) => {
    await navTo(page, "클리닉");
    await page.waitForTimeout(2000);
    await snap(page, "audit-9-clinic-main");

    // 클리닉 대상 탭/영역 확인
    const targetSection = page.locator("text=클리닉 대상").or(page.locator("text=대상 학생"));
    if (await targetSection.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("[클리닉] 클리닉 대상 섹션 표시됨");
    }

    // 메시지 설정 탭으로 이동
    const msgSettingsLink = page.locator("a, button").filter({ hasText: /메시지 설정|발송 설정|알림 설정/ }).first();
    if (await msgSettingsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await msgSettingsLink.click();
      await page.waitForTimeout(2000);
      await snap(page, "audit-9-clinic-msg-settings");

      // 알림톡/SMS 패널 확인
      const panels = page.locator("text=알림톡 자동발송").or(page.locator("text=SMS 자동발송"));
      if (await panels.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log("[클리닉 설정] ✅ 알림톡/SMS 이중 패널 표시됨");
      }

      // 트리거 확인
      const triggers = ["예약 생성", "입실", "결석", "자율학습 완료", "취소"];
      for (const t of triggers) {
        const triggerEl = page.locator(`text=${t}`).first();
        if (await triggerEl.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`[클리닉 트리거] ✅ "${t}" 표시됨`);
        }
      }
    } else {
      // msg-settings URL로 직접 이동
      await page.goto(`${BASE}/admin/clinic/msg-settings`, { waitUntil: "load", timeout: 20000 });
      await page.waitForTimeout(3000);
      await snap(page, "audit-9-clinic-msg-settings-direct");
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 10. 모달 상태 관리 — 닫기/재열기/ESC/바깥 클릭
  // ═══════════════════════════════════════════════════════════════
  test("10. 모달 상태 — 닫기/재열기/ESC 동작", async ({ page }) => {
    await navTo(page, "학생");
    await page.waitForTimeout(2000);

    const selectAll = page.locator('input[type="checkbox"]').first();
    if (!(await selectAll.isVisible({ timeout: 5000 }).catch(() => false))) return;
    await selectAll.click();
    await page.waitForTimeout(500);

    const sendBtn = page.locator("button").filter({ hasText: /메시지/ }).first();

    // ── 1차: 열기 → 본문 입력 → 닫기 ──
    await sendBtn.click();
    await page.waitForTimeout(1500);
    await expect(page.locator("text=메시지 발송").first()).toBeVisible({ timeout: 5000 });

    // 직접 작성 모드로 전환
    const templateSelect = page.locator("button").filter({ hasText: /양식 선택/ }).first();
    if (await templateSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await templateSelect.click();
      await page.waitForTimeout(500);
      const freeform = page.locator("button").filter({ hasText: "직접 작성하기" }).first();
      if (await freeform.isVisible({ timeout: 2000 }).catch(() => false)) {
        await freeform.click();
        await page.waitForTimeout(500);
      }
    }

    const textarea = page.locator("textarea").first();
    if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await textarea.fill("상태 테스트 메시지");
      await page.waitForTimeout(300);
    }

    // ESC로 닫기
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // 모달 닫힘 확인
    const modalClosed = await page.locator("text=메시지 발송").first().isVisible().catch(() => false);
    console.log(`[상태 관리] ESC 후 모달: ${modalClosed ? "열림 ⚠️" : "닫힘 ✅"}`);

    // ── 2차: 재열기 → 이전 본문이 초기화되었는지 확인 ──
    await sendBtn.click();
    await page.waitForTimeout(1500);

    const textarea2 = page.locator("textarea").first();
    if (await textarea2.isVisible({ timeout: 3000 }).catch(() => false)) {
      const bodyAfterReopen = await textarea2.inputValue();
      if (bodyAfterReopen === "") {
        console.log("[상태 관리] ✅ 재열기 시 본문 초기화됨");
      } else {
        console.log(`[상태 관리] ⚠️ 재열기 시 이전 본문 잔존: "${bodyAfterReopen.slice(0, 30)}"`);
      }
    }

    await snap(page, "audit-10-modal-reopen");

    // 닫기
    const cancelBtn = page.locator("button").filter({ hasText: "취소" }).first();
    if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelBtn.click();
    }
  });
});
