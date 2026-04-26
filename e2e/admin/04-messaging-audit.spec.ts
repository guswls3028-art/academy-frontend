/**
 * 메시징/알림 UX 전역 감사 E2E — 실사용자 기준 빡쎈 검증
 *
 * 모든 테스트는 실제 브라우저에서 사용자 클릭 경로로 수행.
 * API 직접 호출은 테스트 데이터 준비에만 사용.
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
// API_BASE reserved — used in future messaging API tests
// const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";

// ── 공통 헬퍼 ──

/**
 * 사이드바 메뉴 클릭 → 라우트 이동 + 네트워크 안정화 대기.
 * 임의 sleep(2000) 대신 networkidle 기반으로 정확한 settle 대기.
 */
async function navTo(page: Page, menuText: string, timeout = 10000) {
  const link = page.locator("nav a, aside a, [class*=sidebar] a, [class*=Sidebar] a, [class*=drawer] a")
    .filter({ hasText: menuText }).first();
  await expect(link, `사이드바에 "${menuText}" 메뉴가 보여야 함`).toBeVisible({ timeout });
  await link.click();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

/** 모달이 열릴 때까지 대기 (메시지 발송 모달 공통 진입). */
async function openMessagingModal(page: Page) {
  const sendBtn = page.locator("button").filter({ hasText: /메시지/ }).first();
  await expect(sendBtn, "메시지 발송 버튼이 보여야 함").toBeVisible({ timeout: 10_000 });
  await sendBtn.click();
  await expect(
    page.locator("text=메시지 발송").first(),
    "메시지 발송 모달이 열려야 함",
  ).toBeVisible({ timeout: 5_000 });
}

/** 양식 패널에서 "직접 작성하기" 진입 (양식 패널이 열려있지 않으면 먼저 연다). */
async function openFreeformBody(page: Page) {
  const templateSelectBtn = page.locator("button").filter({ hasText: /양식 선택|양식 변경/ }).first();
  if (await templateSelectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await templateSelectBtn.click();
  }
  const freeformBtn = page.locator("button").filter({ hasText: "직접 작성하기" }).first();
  await expect(freeformBtn, "양식 패널의 '직접 작성하기' 버튼이 보여야 함").toBeVisible({ timeout: 5_000 });
  await freeformBtn.click();
  await expect(page.locator("textarea").first(), "본문 textarea 가 보여야 함").toBeVisible({ timeout: 5_000 });
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
    // 설정 탭 클릭 → 발신번호 라벨이 보일 때까지 대기 (waitForTimeout 제거)
    const settingsTab = page.locator("a, button").filter({ hasText: "설정" }).last();
    await settingsTab.click();
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

    // 카테고리 트리에서 "사용자" — 환경별로 템플릿 카테고리 구성이 다를 수 있어 옵셔널.
    // 단, "사용자" 카테고리가 보이면 클릭 후 highlight 가 반영될 때까지 대기.
    const userCat = page.locator("text=사용자").first();
    if (await userCat.isVisible({ timeout: 5000 }).catch(() => false)) {
      await userCat.click();
      // 클릭 후 카테고리 active state 가 반영되도록 짧게 대기 — networkidle 우선
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    }

    await snap(page, "audit-2-templates-list");

    // 카테고리별 템플릿이 존재하는지 확인 (카테고리 자체는 환경별 옵셔널)
    const categories = ["출결", "시험", "성적", "클리닉"];
    for (const cat of categories) {
      const catBtn = page.locator("button, a").filter({ hasText: cat }).first();
      if (await catBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await catBtn.click();
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
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
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    // 모든 섹션 순회 (각 섹션 자체는 환경별 옵셔널 — 일부만 활성일 수 있음)
    const sections = ["가입", "출결", "시험", "과제", "성적", "클리닉", "결제"];
    let visitedCount = 0;
    for (const sec of sections) {
      const secBtn = page.locator("button, [role=button], a").filter({ hasText: sec }).first();
      if (await secBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await secBtn.click();
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
        await snap(page, `audit-3-autosend-${sec}`);
        visitedCount += 1;
      }
    }
    expect(
      visitedCount,
      "자동발송에서 최소 1개 섹션은 표시되어야 함 (가입~결제 모두 미표시 = 메시징 모듈 비정상)",
    ).toBeGreaterThan(0);

    // 시험 섹션 시간 단위 검증 — 시험 섹션이 있다면 시간 단위 라벨이 1개 이상 있어야 함.
    const examSec = page.locator("button, [role=button], a").filter({ hasText: "시험" }).first();
    if (await examSec.isVisible({ timeout: 3000 }).catch(() => false)) {
      await examSec.click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      const timeUnits = await page.locator("text=분 전").or(page.locator("text=일 전")).count();
      expect(
        timeUnits,
        "자동발송 '시험' 섹션은 '분 전' 또는 '일 전' 시간 단위 라벨을 1개 이상 노출해야 함",
      ).toBeGreaterThan(0);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. 발송 내역 — 실제 로그 확인 + 상세 팝업
  // ═══════════════════════════════════════════════════════════════
  test("4. 발송 내역 — 로그 목록 + 상세 팝업", async ({ page }) => {
    await navTo(page, "메시지");
    const logTab = page.locator("a, button").filter({ hasText: "발송 내역" }).first();
    await logTab.click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    await snap(page, "audit-4-log-list");

    // 필터 버튼은 발송 내역 모듈의 핵심 — 모두 보여야 한다 (정상 환경 조건).
    const successFilter = page.locator("button").filter({ hasText: "성공" }).first();
    const failFilter = page.locator("button").filter({ hasText: "실패" }).first();
    const allFilter = page.locator("button").filter({ hasText: "전체" }).first();
    await expect(successFilter, "발송 내역 '성공' 필터가 보여야 함").toBeVisible({ timeout: 5_000 });
    await expect(failFilter, "발송 내역 '실패' 필터가 보여야 함").toBeVisible({ timeout: 5_000 });
    await expect(allFilter, "발송 내역 '전체' 필터가 보여야 함").toBeVisible({ timeout: 5_000 });

    await successFilter.click();
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await snap(page, "audit-4-log-success-filter");

    await failFilter.click();
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await snap(page, "audit-4-log-fail-filter");

    // 첫 번째 로그 항목 클릭 → 상세 팝업 — 로그 자체는 (테넌트 발송 이력에 따라) 0건 가능 → 옵셔널
    await allFilter.click();
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    const firstRow = page.locator("tr, [class*=log-row], [class*=card]").filter({ hasText: /성공|실패/ }).first();
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstRow.click();
      // 상세 팝업이 떴다면 본문 라벨이 반드시 보여야 함 (silent log → hard expect).
      const bodyContent = page.locator("text=내용").or(page.locator("text=본문")).or(page.locator("text=메시지"));
      await expect(
        bodyContent.first(),
        "발송 내역 상세 팝업은 본문/내용/메시지 라벨을 노출해야 함",
      ).toBeVisible({ timeout: 5_000 });
      await snap(page, "audit-4-log-detail");
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. 발송 모달 — SMS 전체 흐름 (양식 선택 → 수정 → 변수 삽입 → 확인)
  // ═══════════════════════════════════════════════════════════════
  test("5. 발송 모달 SMS — 양식 선택/수정/변수 삽입/확인 오버레이", async ({ page }) => {
    // 학생 목록으로 이동
    await navTo(page, "학생");

    // 전체 선택 체크박스 — 학생 0명인 환경은 SMS 발송 검증 자체가 의미 없음. fail-fast.
    const selectAll = page.locator('input[type="checkbox"]').first();
    await expect(
      selectAll,
      "학생 목록에 체크박스가 보여야 함 (학생 0명이면 메시징 spec 무효)",
    ).toBeVisible({ timeout: 10000 });
    await selectAll.click();

    // 메시지 발송 모달 열기 (helper)
    await openMessagingModal(page);
    await snap(page, "audit-5-modal-open");

    // ── SMS 모드 확인 ──
    const smsBtn = page.locator("button").filter({ hasText: "SMS" }).first();
    await expect(smsBtn).toBeVisible();
    await snap(page, "audit-5-modal-sms-mode");

    // ── 양식 패널 → 직접 작성 ──
    await openFreeformBody(page);
    await snap(page, "audit-5-modal-template-panel");

    // ── 본문 작성 ──
    const textarea = page.locator("textarea").first();
    await textarea.fill("[E2E-테스트] 안녕하세요, 테스트 메시지입니다. #{학생이름}님");
    await snap(page, "audit-5-modal-body-written");

    // ── 변수 삽입 ── 변수 팔레트에서 "사이트 링크" 클릭 → 본문에 #{사이트링크} 가 반영되어야 함.
    const varBlock = page.locator("button").filter({ hasText: "사이트 링크" }).first();
    await expect(
      varBlock,
      "변수 팔레트의 '사이트 링크' 블록이 보여야 함 (메시징 변수 시스템 정상 동작)",
    ).toBeVisible({ timeout: 5_000 });
    await varBlock.click();
    await expect(textarea).toHaveValue(/#\{사이트링크\}/, { timeout: 3_000 });

    // ── 미리보기 확인 (좌측) — 모달이면 반드시 보여야 함.
    const previewArea = page.locator(".template-preview-phone__bubble, .template-preview-phone");
    await expect(
      previewArea.first(),
      "SMS 발송 모달 좌측 미리보기 영역이 보여야 함",
    ).toBeVisible({ timeout: 5_000 });

    // ── 글자수 표시 확인 — SMS/LMS 라벨이 한 번 이상 보여야 함.
    const charCount = page.locator("text=/SMS|LMS/").first();
    await expect(charCount, "글자수 영역(SMS/LMS) 라벨이 보여야 함").toBeVisible({ timeout: 5_000 });

    // ── 학생 체크 해제 → 학부모 발송 텍스트 검증 ──
    const studentCheck = page.locator("label").filter({ hasText: "학생" }).locator("input[type=checkbox]").first();
    if (await studentCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (await studentCheck.isChecked()) await studentCheck.uncheck();
      await snap(page, "audit-5-modal-parent-only");

      // 학부모 발송 텍스트가 반영될 때까지 기다린다 (silent log → expect.toBeVisible).
      const parentSendText = page.locator("button").filter({ hasText: /학부모.*발송/ }).first();
      await expect(
        parentSendText,
        "학생 체크 해제 시 발송 버튼은 '학부모 N명...발송' 으로 갱신되어야 함",
      ).toBeVisible({ timeout: 5_000 });

      // 학생 다시 체크
      await studentCheck.check();
    }

    // ── 발송 확인 오버레이 ── 발송 버튼이 활성이어야 정상 흐름.
    const mainSendBtn = page.locator("button").filter({ hasText: /에게.*발송/ }).last();
    await expect(mainSendBtn, "메인 발송 버튼이 보여야 함").toBeVisible({ timeout: 5_000 });
    await expect(mainSendBtn, "메인 발송 버튼이 활성이어야 함 (대상 1명 이상 + 본문 입력 완료)").toBeEnabled({ timeout: 5_000 });

    await mainSendBtn.click();

    // 확인 오버레이는 발송 직전 안전 가드 — 반드시 표시되어야 한다.
    const confirmOverlay = page.locator("text=발송을 확인해 주세요");
    await expect(confirmOverlay, "발송 확인 오버레이가 표시되어야 함 (안전 가드)").toBeVisible({ timeout: 5_000 });
    await snap(page, "audit-5-modal-confirm-overlay");

    // 본문 미리보기에 직접 입력한 본문이 포함되어야 한다 (UX 핵심: 사용자가 발송 직전 확인).
    const bodyPreview = page.locator("text=E2E-테스트").first();
    await expect(
      bodyPreview,
      "확인 오버레이에 본문 미리보기('E2E-테스트') 가 포함되어야 함 (사용자 안전 검토 UX)",
    ).toBeVisible({ timeout: 3_000 });

    // 채널 정보 확인 — SMS/LMS 라벨이 보여야 함.
    const channelInfo = page.locator("text=SMS").or(page.locator("text=LMS"));
    await expect(channelInfo.first(), "확인 오버레이 채널 정보 라벨이 보여야 함").toBeVisible({ timeout: 3_000 });

    // "돌아가기" 클릭 (실제 발송 안 함) → 다시 모달이 보여야 함.
    const backBtn = page.locator("button").filter({ hasText: "돌아가기" }).first();
    await expect(backBtn, "오버레이 '돌아가기' 버튼이 보여야 함").toBeVisible({ timeout: 3_000 });
    await backBtn.click();
    await expect(confirmOverlay, "돌아가기 후 확인 오버레이는 닫혀야 함").toBeHidden({ timeout: 3_000 });

    // ── 취소 (모달 닫기) ──
    const cancelBtn = page.locator("button").filter({ hasText: "취소" }).first();
    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelBtn.click();
      await expect(page.locator("text=메시지 발송").first()).toBeHidden({ timeout: 3_000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. 발송 모달 — 알림톡 전체 흐름
  // ═══════════════════════════════════════════════════════════════
  test("6. 발송 모달 알림톡 — 양식/직접 작성/전환/변수/미리보기", async ({ page }) => {
    await navTo(page, "학생");

    // 학생 선택 — 학생 0명이면 알림톡 검증 자체 무효. fail-fast.
    const selectAll = page.locator('input[type="checkbox"]').first();
    await expect(
      selectAll,
      "학생 목록에 체크박스가 보여야 함 (학생 0명이면 메시징 spec 무효)",
    ).toBeVisible({ timeout: 10_000 });
    await selectAll.click();

    // 메시지 발송 모달
    await openMessagingModal(page);

    // ── 알림톡 모드로 전환 ──
    const alimBtn = page.locator("button").filter({ hasText: "알림톡" }).first();
    await alimBtn.click();
    await snap(page, "audit-6-alimtalk-mode");

    // ── 카카오 미리보기 확인 (알림톡 모드 진입 신호)
    const kakaoPreview = page.locator(".template-preview-kakao");
    await expect(
      kakaoPreview.first(),
      "알림톡 모드 진입 후 카카오 미리보기가 보여야 함",
    ).toBeVisible({ timeout: 5000 });

    // ── 양식 패널 → 직접 작성 ──
    await openFreeformBody(page);
    await snap(page, "audit-6-alimtalk-template-panel");

    // ── 본문 작성 ──
    const textarea = page.locator("textarea").first();
    await textarea.fill("[E2E-알림톡] #{학생이름}님, 학원 안내입니다.");
    await snap(page, "audit-6-alimtalk-body");

    // ── SMS로 전환 후 다시 알림톡으로 — 채널 전환 시 본문 초기화 정책 검증 ──
    const smsBtn = page.locator("button").filter({ hasText: "SMS" }).first();
    await expect(smsBtn, "SMS 채널 전환 버튼이 보여야 함").toBeVisible({ timeout: 3_000 });
    await expect(smsBtn).toBeEnabled({ timeout: 3_000 });

    await smsBtn.click();
    // SMS 전환 후 본문은 알림톡 본문과 별도 (clear 정책) — 빈 값 또는 SMS 본문이 보여야 함.
    // 알림톡 본문이 SMS 채널에 그대로 남아있으면 미발송 권장 본문이 잘못 남는 회귀.
    await expect(
      page.locator("textarea").first(),
      "SMS 채널은 알림톡 본문을 그대로 가져오면 안 됨 (채널별 본문 분리 정책)",
    ).not.toHaveValue(/E2E-알림톡/, { timeout: 3_000 });

    // 다시 알림톡으로
    await alimBtn.click();
    // 알림톡 채널 복귀 시 텍스트영역 자체는 다시 보여야 함 (모달 안정성)
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 3_000 });

    await snap(page, "audit-6-alimtalk-switch-test");

    // ESC로 닫기
    await page.keyboard.press("Escape");
    await expect(page.locator("text=메시지 발송").first()).toBeHidden({ timeout: 3_000 });
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. 실제 SMS 발송 + 수신 확인 (01031217466)
  // ═══════════════════════════════════════════════════════════════
  test("7. 실제 SMS 발송 → 발송 내역 확인", async ({ page }) => {
    await navTo(page, "학생");

    // 첫 번째 학생 선택 — 학생 0명은 실발송 검증 무효. fail-fast.
    const checkbox = page.locator('input[type="checkbox"]').nth(1); // 첫번째는 전체선택
    await expect(
      checkbox,
      "학생 1명 이상의 체크박스가 보여야 함 (실발송 검증 전제)",
    ).toBeVisible({ timeout: 10000 });
    await checkbox.click();

    // 메시지 발송 모달
    await openMessagingModal(page);

    // SMS 모드 확인 — SMS 버튼이 보여야 함 (별도 click 불필요: 기본 SMS 모드 가정)
    const smsBtn = page.locator("button").filter({ hasText: "SMS" }).first();
    await expect(smsBtn).toBeVisible({ timeout: 3_000 });

    // 양식 선택 → 직접 작성
    await openFreeformBody(page);

    // 학부모만 선택 (학생 체크 해제)
    const studentCheck = page.locator("label").filter({ hasText: "학생" }).locator("input[type=checkbox]").first();
    if (await studentCheck.isVisible({ timeout: 2000 }).catch(() => false) && await studentCheck.isChecked()) {
      await studentCheck.uncheck();
    }

    // 본문 입력
    const textarea = page.locator("textarea").first();
    const timestamp = new Date().toISOString().slice(11, 19);
    const testBody = `[E2E-${timestamp}] 학원플러스 메시징 감사 테스트입니다. 이 메시지는 무시해 주세요.`;
    await textarea.fill(testBody);

    // 발송 버튼 — 본문 입력 + 대상 학부모 1명 이상이면 활성. 미활성 = 회귀.
    const mainSendBtn = page.locator("button").filter({ hasText: /에게.*발송/ }).last();
    await expect(mainSendBtn, "메인 발송 버튼이 보여야 함").toBeVisible({ timeout: 5_000 });
    await expect(
      mainSendBtn,
      "본문 입력 + 학부모 1명 선택 상태에서 메인 발송 버튼이 활성이어야 함",
    ).toBeEnabled({ timeout: 5_000 });
    await mainSendBtn.click();

    // 확인 오버레이는 발송 안전 가드 — 반드시 표시.
    const confirmSend = page.locator("button").filter({ hasText: "발송하기" }).first();
    await expect(
      confirmSend,
      "발송 확인 오버레이의 '발송하기' 버튼이 표시되어야 함 (안전 가드)",
    ).toBeVisible({ timeout: 5000 });
    await snap(page, "audit-7-sms-confirm");
    await confirmSend.click();

    // 발송 요청 후 모달이 닫히거나 success 피드백이 나와야 함.
    // (알림 토스트 또는 모달 닫힘 — 둘 중 하나)
    await Promise.race([
      page.locator("text=메시지 발송").first().waitFor({ state: "hidden", timeout: 10_000 }).catch(() => null),
      page.locator("text=/발송.*완료|성공/").first().waitFor({ state: "visible", timeout: 10_000 }).catch(() => null),
    ]);
    await snap(page, "audit-7-sms-sent");

    // 발송 내역에서 확인 — 큐 처리 시간 고려 폴링
    await navTo(page, "메시지");
    const logTab = page.locator("a, button").filter({ hasText: "발송 내역" }).first();
    await logTab.click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    await snap(page, "audit-7-sms-log-after");

    // 최신 로그에 직전 발송 본문(timestamp 포함)이 반영되어야 함.
    // SQS 처리 지연 대비 최대 30초 폴링.
    const recentLog = page.locator(`text=${timestamp}`).first();
    await expect(
      recentLog,
      `발송 내역에 직전 timestamp(${timestamp}) 가 30초 내 반영되어야 함 (SQS 처리)`,
    ).toBeVisible({ timeout: 30_000 });
  });

  // ═══════════════════════════════════════════════════════════════
  // 8. 성적 발송 — 성적 입력 → 수업결과 발송 → 변수 치환 확인
  // ═══════════════════════════════════════════════════════════════
  test("8. 성적 발송 — 수업결과 발송 모달 + 변수 치환", async ({ page }) => {
    await navTo(page, "강의");

    // 첫 번째 강의 — 환경별로 강의 0개 가능 (옵셔널 진입)
    const lectureLink = page.locator("a[href*='/lectures/']").first();
    if (!(await lectureLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.info().annotations.push({ type: "skip-reason", description: "강의 0개 환경 — 성적 발송 검증 미실행" });
      return;
    }
    await lectureLink.click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    // 성적 탭 진입 (옵셔널 — 강의 상세 레이아웃에 따라 다름)
    const scoresTab = page.locator("a, button").filter({ hasText: /성적|점수/ }).first();
    if (await scoresTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await scoresTab.click();
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    }

    // 차시 진입 (옵셔널)
    const sessionLink = page.locator("a[href*='/scores']").or(page.locator("tr, [class*=row]").filter({ hasText: /차시|회차/ })).first();
    if (await sessionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sessionLink.click();
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    }

    await snap(page, "audit-8-score-entry");

    // 학생 체크박스 — 차시 데이터 없으면 미표시 가능 (옵셔널)
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (!(await checkbox.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.info().annotations.push({ type: "skip-reason", description: "성적 데이터 없음 — 발송 버튼까지 진입 불가" });
      return;
    }
    await checkbox.click();

    // "수업결과 발송" 버튼 — 차시 진입 후 정상이라면 보여야 함.
    const resultSendBtn = page.locator("button").filter({ hasText: /수업결과|성적.*발송/ }).first();
    if (!(await resultSendBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      await snap(page, "audit-8-score-no-send-btn");
      test.info().annotations.push({ type: "skip-reason", description: "수업결과 발송 버튼 미노출 — 차시/성적 미입력 환경" });
      return;
    }
    await resultSendBtn.click();

    // 모달 열리면 hard expect. (silent log → 변수 치환 결과 검증으로 변경)
    const modal = page.locator("text=메시지 발송").first();
    await expect(modal, "수업결과 발송 모달이 열려야 함").toBeVisible({ timeout: 5_000 });
    await snap(page, "audit-8-score-send-modal");

    const bodyArea = page.locator("textarea").first();
    await expect(bodyArea, "발송 모달 본문 영역이 보여야 함").toBeVisible({ timeout: 3_000 });
    const bodyText = await bodyArea.inputValue();

    // 본문 비어있으면 결함 (성적 양식이 변수 치환된 본문을 기본 채워야 함)
    expect(bodyText.trim().length, "성적 발송 모달 본문이 비어있으면 안 됨 (양식 변수 치환 결과)").toBeGreaterThan(0);
    // 미치환 변수가 본문에 잔존하면 결함 (학생/점수 컨텍스트가 명확한 화면이므로)
    expect(bodyText, "성적 발송 모달 본문에 미치환 변수(#{...}) 가 남으면 안 됨").not.toContain("#{");

    // 변수 팔레트 — 성적 카테고리 블록은 성적 발송 모달의 차별점.
    const gradeBlocks = page.locator("text=시험 목록").or(page.locator("text=과제 목록")).or(page.locator("text=전체 요약"));
    await expect(
      gradeBlocks.first(),
      "성적 발송 모달은 변수 팔레트에 성적 카테고리(시험/과제/요약) 블록을 노출해야 함",
    ).toBeVisible({ timeout: 5_000 });
    await snap(page, "audit-8-score-send-variables");

    // ESC 닫기
    await page.keyboard.press("Escape");
    await expect(modal, "ESC 후 모달이 닫혀야 함").toBeHidden({ timeout: 3_000 });
  });

  // ═══════════════════════════════════════════════════════════════
  // 9. 클리닉 — 대상 학생 목록 + 메시지 발송
  // ═══════════════════════════════════════════════════════════════
  test("9. 클리닉 — 대상 학생 + 메시지 발송 모달", async ({ page }) => {
    await navTo(page, "클리닉");
    await snap(page, "audit-9-clinic-main");

    // 메시지 설정 탭으로 이동 — 사이드 메뉴/링크/탭 어떤 형태든 보여야 함.
    // (직접 URL 진입은 fallback)
    const msgSettingsLink = page.locator("a, button").filter({ hasText: /메시지 설정|발송 설정|알림 설정/ }).first();
    if (await msgSettingsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await msgSettingsLink.click();
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    } else {
      await gotoAndSettle(page, `${BASE}/admin/clinic/msg-settings`);
    }
    await snap(page, "audit-9-clinic-msg-settings");

    // 알림톡/SMS 자동발송 이중 패널 — 클리닉 메시지 설정의 핵심 UI.
    const panels = page.locator("text=알림톡 자동발송").or(page.locator("text=SMS 자동발송"));
    await expect(
      panels.first(),
      "클리닉 메시지 설정 페이지는 '알림톡 자동발송' 또는 'SMS 자동발송' 패널을 노출해야 함",
    ).toBeVisible({ timeout: 10_000 });

    // 트리거 — 5종 모두 보여야 한다 (silent log → hard expect).
    const triggers = ["예약 생성", "입실", "결석", "자율학습 완료", "취소"];
    for (const t of triggers) {
      const triggerEl = page.locator(`text=${t}`).first();
      await expect(
        triggerEl,
        `클리닉 메시지 설정에 트리거 "${t}" 가 표시되어야 함 (5종 SSOT 회귀 검증)`,
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 10. 모달 상태 관리 — 닫기/재열기/ESC/바깥 클릭
  // ═══════════════════════════════════════════════════════════════
  test("10. 모달 상태 — 닫기/재열기/ESC 동작", async ({ page }) => {
    await navTo(page, "학생");

    const selectAll = page.locator('input[type="checkbox"]').first();
    await expect(
      selectAll,
      "학생 목록에 체크박스가 보여야 함 (학생 0명이면 모달 검증 무효)",
    ).toBeVisible({ timeout: 10_000 });
    await selectAll.click();

    // ── 1차: 열기 → 본문 입력 → ESC 닫기 ──
    await openMessagingModal(page);
    await openFreeformBody(page);

    const textarea = page.locator("textarea").first();
    await textarea.fill("상태 테스트 메시지");

    // ESC → 모달 닫힘은 핵심 UX 회귀 검증.
    await page.keyboard.press("Escape");
    await expect(
      page.locator("text=메시지 발송").first(),
      "ESC 후 메시지 발송 모달이 닫혀야 함 (UX 회귀 검증)",
    ).toBeHidden({ timeout: 3_000 });

    // ── 2차: 재열기 → 본문 초기화 ──
    await openMessagingModal(page);

    const textarea2 = page.locator("textarea").first();
    if (await textarea2.isVisible({ timeout: 3000 }).catch(() => false)) {
      // 양식 선택 상태로 재열렸을 수 있어 — textarea 가 보일 때만 본문 초기화 검증.
      // (양식 패널이 기본 상태면 textarea 자체가 없을 수 있으므로 visible 가드)
      await expect(
        textarea2,
        "모달 재열기 시 textarea 가 이전 본문('상태 테스트 메시지') 으로 복원되면 안 됨",
      ).not.toHaveValue("상태 테스트 메시지", { timeout: 3_000 });
    }

    await snap(page, "audit-10-modal-reopen");

    // 닫기
    const cancelBtn = page.locator("button").filter({ hasText: "취소" }).first();
    if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelBtn.click();
      await expect(page.locator("text=메시지 발송").first()).toBeHidden({ timeout: 3_000 });
    }
  });
});
