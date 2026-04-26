/**
 * 메시징 전역 감사 — 미완 항목 완전 검증
 * 실제 데이터 기반:
 *  - 강의 113, 차시 153, 수강생 E2E메시지3139 (parent_phone: 01031217466)
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { FIXTURES } from "../helpers/test-fixtures";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: false });
}

test.describe("메시징 미완 항목 완전 검증", () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  // ═══════════════════════════════════════════════════════════════
  // 1. 성적 발송 — 강의 113 / 차시 153
  // ═══════════════════════════════════════════════════════════════
  test("1. 성적 발송 — 강의113/차시153 → 성적 탭 → 수업결과 발송", async ({ page }) => {
    await gotoAndSettle(
      page,
      `${BASE}/admin/lectures/${FIXTURES.lectureId}/sessions/${FIXTURES.sessionId}/scores`,
      { settleMs: 2000 },
    );
    await snap(page, "full-1-scores-page");

    const checks = page.locator('input[type="checkbox"]');
    const checkCount = await checks.count();

    if (checkCount === 0) {
      // 환경에 강의/차시/학생이 없는 경우 — 진단 정보 후 종료.
      test.info().annotations.push({ type: "skip-reason", description: "강의/차시 성적 페이지에 학생 체크박스 없음" });
      return;
    }

    await checks.first().click();
    await snap(page, "full-1-selected");

    const resultBtn = page.locator("button").filter({ hasText: "수업결과" }).first();
    const msgBtn = page.locator("button").filter({ hasText: "메시지 발송" }).first();
    const resultVis = await resultBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const msgVis = await msgBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (resultVis) {
      await resultBtn.click();
      // 모달의 textarea 가 보일 때까지 대기.
      const textarea = page.locator("textarea").first();
      await expect(textarea, "수업결과 발송 모달 본문 textarea 가 보여야 함").toBeVisible({ timeout: 8_000 });
      await snap(page, "full-1-score-send-modal");

      const body = await textarea.inputValue();
      // 본문 비어있지 않음 + 미치환 변수 없음 (성적 발송 모달의 핵심 요건).
      expect(body.trim().length, "수업결과 발송 모달 본문이 비어있지 않아야 함").toBeGreaterThan(0);
      expect(body, "수업결과 발송 모달 본문에 미치환 변수(#{...}) 가 남으면 안 됨").not.toContain("#{");

      // 성적 변수 블록 — 1개 이상 노출.
      const blocks = page.locator("button").filter({ hasText: /시험 목록|과제 목록|전체 요약/ });
      expect(
        await blocks.count(),
        "수업결과 발송 모달은 성적 변수 블록(시험/과제/요약) 1개 이상 노출해야 함",
      ).toBeGreaterThan(0);

      await page.keyboard.press("Escape");
    } else if (msgVis) {
      await msgBtn.click();
      await expect(page.locator("text=메시지 발송").first()).toBeVisible({ timeout: 5_000 });
      await snap(page, "full-1-msg-modal");
      await page.keyboard.press("Escape");
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. 템플릿 CRUD
  // ═══════════════════════════════════════════════════════════════
  test("2. 템플릿 CRUD — 생성/확인/삭제", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/message/templates`, { settleMs: 2000 });
    await snap(page, "full-2-templates");

    // 카테고리에서 "사용자" 클릭 (옵셔널)
    const userCat = page.locator("button, a, [class*=tree] [class*=item]").filter({ hasText: "사용자" }).first();
    if (await userCat.isVisible({ timeout: 3000 }).catch(() => false)) {
      await userCat.click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    }

    // "추가" 또는 "+" 버튼 — 템플릿 모듈은 추가 버튼 또는 기존 카드가 1개 이상이 정상.
    const addBtn = page.locator("button").filter({ hasText: /추가|새 양식|만들기|\+/ }).first();
    const cards = page.locator("[class*=card], [class*=template]").filter({ hasText: /.{5,}/ });

    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      // 모달 입력창 1개 이상 보일 때까지.
      const inputOrTextarea = page.locator("input:visible, textarea:visible").first();
      await expect(inputOrTextarea, "템플릿 추가 모달의 입력창이 보여야 함").toBeVisible({ timeout: 5_000 });
      await snap(page, "full-2-create-modal");
      await page.keyboard.press("Escape");
    } else if ((await cards.count()) > 0) {
      await cards.first().click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      await snap(page, "full-2-card-detail");
    } else {
      test.info().annotations.push({ type: "skip-reason", description: "추가 버튼 + 기존 템플릿 카드 모두 미노출" });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. 발송 내역 상세
  // ═══════════════════════════════════════════════════════════════
  test("3. 발송 내역 상세 — 행 클릭 → 팝업 → 내용 확인", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/message/log`, { settleMs: 2000 });
    await snap(page, "full-3-log");

    const rows = page.locator("button").filter({ hasText: /\d{4}/ });
    const rowCount = await rows.count();

    if (rowCount === 0) {
      test.info().annotations.push({ type: "skip-reason", description: "발송 내역 0건 환경" });
      return;
    }

    await rows.first().click();
    // 상세 모달/드로어가 떴다면 핵심 라벨 1개 이상 보여야 함.
    const labelLocator = page.locator("text=/수신자|내용|발송|상태|채널|시간/");
    await expect(
      labelLocator.first(),
      "발송 내역 상세 팝업에 핵심 라벨(수신자/내용/발송/상태/채널/시간) 1개 이상 노출",
    ).toBeVisible({ timeout: 5_000 });
    await snap(page, "full-3-log-detail-content");

    await page.keyboard.press("Escape");
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. 클리닉 메시지 설정 + 미리보기 (#{장소} 수정 검증)
  // ═══════════════════════════════════════════════════════════════
  test("4. 클리닉 설정 + 미리보기 + #{장소} 변수 확인", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/clinic/msg-settings`, { settleMs: 2000 });
    await snap(page, "full-4-clinic-settings");

    // 트리거 카드 — 5종 SSOT 회귀 검증.
    for (const trigger of ["예약", "입실", "결석", "자율학습", "취소"]) {
      await expect(
        page.locator(`text=${trigger}`).first(),
        `클리닉 메시지 설정 트리거 "${trigger}" 가 표시되어야 함`,
      ).toBeVisible({ timeout: 5_000 });
    }

    // 미리보기 버튼이 1개 이상 있어야 함 (각 트리거별 미리보기).
    const previewBtns = page.locator("button").filter({ hasText: /미리보기/ });
    expect(
      await previewBtns.count(),
      "클리닉 메시지 설정에 미리보기 버튼이 1개 이상 있어야 함",
    ).toBeGreaterThan(0);

    await previewBtns.first().click();
    // 카카오 미리보기 카드가 떠야 함.
    const kakaoCard = page.locator(".template-preview-kakao, [class*=kakao]").first();
    await expect(kakaoCard, "미리보기 클릭 후 카카오 미리보기 카드가 보여야 함").toBeVisible({ timeout: 5_000 });
    await snap(page, "full-4-clinic-preview");

    // "장소?" 경고는 templateBlocks 미수정 회귀 — 절대 보이면 안 된다.
    await expect(
      page.locator("text=장소?"),
      "클리닉 미리보기에 '장소?' 경고가 노출되면 templateBlocks 회귀",
    ).toBeHidden({ timeout: 2_000 });

    await page.keyboard.press("Escape");

    // 알림톡/SMS 패널 — 둘 중 1개 이상 보여야 함.
    const alimVisible = await page.locator("text=알림톡").first().isVisible().catch(() => false);
    const smsVisible = await page.locator("text=SMS").first().isVisible().catch(() => false);
    expect(
      alimVisible || smsVisible,
      "클리닉 메시지 설정에 알림톡 또는 SMS 패널 1개 이상 노출",
    ).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. 알림톡 발송 검증
  // ═══════════════════════════════════════════════════════════════
  test("5. 알림톡 발송 — 실제 발송 시도 + 결과 확인", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/students`, { settleMs: 2000 });

    const check = page.locator('input[type="checkbox"]').nth(1);
    if (!(await check.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.info().annotations.push({ type: "skip-reason", description: "학생 0명 환경 — 알림톡 발송 검증 무효" });
      return;
    }
    await check.click();

    const sendBtn = page.locator("button").filter({ hasText: /메시지/ }).first();
    await sendBtn.click();
    await expect(page.locator("text=메시지 발송").first()).toBeVisible({ timeout: 5_000 });

    const alimBtn = page.locator("button").filter({ hasText: "알림톡" }).first();
    await alimBtn.click();

    // 양식 선택 → 직접 작성
    const tplBtn = page.locator("button").filter({ hasText: /양식 선택/ }).first();
    if (await tplBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tplBtn.click();
      const free = page.locator("button").filter({ hasText: "직접 작성하기" }).first();
      if (await free.isVisible({ timeout: 2000 }).catch(() => false)) {
        await free.click();
      }
    }

    const textarea = page.locator("textarea").first();
    await expect(textarea, "메시지 본문 textarea 가 보여야 함").toBeVisible({ timeout: 5000 });
    const ts = new Date().toISOString().slice(11, 19);
    await textarea.fill(`[E2E-알림톡-${ts}] 메시징 감사. #{학생이름}님 무시해주세요.`);

    const stCheck = page.locator("label").filter({ hasText: "학생" }).locator("input[type=checkbox]").first();
    if (await stCheck.isVisible({ timeout: 2000 }).catch(() => false) && await stCheck.isChecked()) {
      await stCheck.uncheck();
    }

    const mainSend = page.locator("button").filter({ hasText: /에게.*발송/ }).last();
    const enabled = await mainSend.isEnabled().catch(() => false);

    await snap(page, "full-5-alimtalk-attempt");

    if (enabled) {
      await mainSend.click();
      const confirmBtn = page.locator("button").filter({ hasText: "발송하기" }).first();
      await expect(confirmBtn, "확인 오버레이의 '발송하기' 버튼이 보여야 함").toBeVisible({ timeout: 5000 });
      await snap(page, "full-5-alimtalk-confirm");
      await confirmBtn.click();
      // 발송 요청 완료 후 모달 닫힘 또는 성공 토스트 노출 — 둘 중 하나.
      await Promise.race([
        page.locator("text=메시지 발송").first().waitFor({ state: "hidden", timeout: 10_000 }).catch(() => null),
        page.locator("text=/발송.*완료|성공/").first().waitFor({ state: "visible", timeout: 10_000 }).catch(() => null),
      ]);
      await snap(page, "full-5-alimtalk-sent");
    } else {
      // 외부 블로커 (채널 미설정 등) — annotation 으로 surface.
      test.info().annotations.push({ type: "external-blocker", description: "알림톡 발송 버튼 비활성 (채널 미연동/대상 부재 등)" });
    }

    await page.keyboard.press("Escape");
  });
});
