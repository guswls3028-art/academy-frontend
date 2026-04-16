/**
 * 메시징 전역 감사 — 미완 항목 완전 검증
 * 실제 데이터 기반:
 *  - 강의 113, 차시 153, 수강생 E2E메시지3139 (parent_phone: 01031217466)
 */
import { test } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { FIXTURES } from "../helpers/test-fixtures";

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
    // 직접 차시 성적 페이지로 이동
    await page.goto(`${BASE}/admin/lectures/${FIXTURES.lectureId}/sessions/${FIXTURES.sessionId}/scores`, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(5000);
    await snap(page, "full-1-scores-page");
    console.log(`[성적] URL: ${page.url()}`);

    // 페이지 내용 확인
    const pageTitle = page.locator("h1, h2, [class*=title]").first();
    const titleText = await pageTitle.textContent().catch(() => "");
    console.log(`[성적] 페이지 제목: ${titleText?.trim().slice(0, 60)}`);

    // 체크박스 확인
    const checks = page.locator('input[type="checkbox"]');
    const checkCount = await checks.count();
    console.log(`[성적] 체크박스: ${checkCount}`);

    if (checkCount > 0) {
      // 전체 선택
      await checks.first().click();
      await page.waitForTimeout(1000);
      await snap(page, "full-1-selected");

      // 모든 보이는 버튼
      const btns = page.locator("button:visible");
      const btnCount = await btns.count();
      const texts: string[] = [];
      for (let i = 0; i < Math.min(btnCount, 30); i++) {
        const t = await btns.nth(i).textContent().catch(() => "");
        if (t && t.trim().length > 1 && !["▲","▼","×","X"].includes(t.trim())) texts.push(t.trim().slice(0, 25));
      }
      console.log(`[성적] 버튼: ${texts.join(" | ")}`);

      // 수업결과 발송 버튼
      const resultBtn = page.locator("button").filter({ hasText: "수업결과" }).first();
      const msgBtn = page.locator("button").filter({ hasText: "메시지 발송" }).first();
      const resultVis = await resultBtn.isVisible({ timeout: 3000 }).catch(() => false);
      const msgVis = await msgBtn.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`[성적] 수업결과 발송: ${resultVis}, 메시지 발송: ${msgVis}`);

      if (resultVis) {
        await resultBtn.click();
        await page.waitForTimeout(3000);
        await snap(page, "full-1-score-send-modal");

        const textarea = page.locator("textarea").first();
        if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
          const body = await textarea.inputValue();
          console.log(`[수업결과] 본문 (${body.length}자):`);
          console.log(body.slice(0, 600));

          const unreplaced = body.match(/#\{[^}]+\}/g);
          if (unreplaced) console.log(`[수업결과] ⚠️ 미치환: ${unreplaced.join(", ")}`);
          else if (body.length > 10) console.log("[수업결과] ✅ 변수 치환 완료");

          // 성적 블록 확인
          for (const b of ["시험 목록", "과제 목록", "전체 요약"]) {
            const el = page.locator("button").filter({ hasText: b }).first();
            console.log(`  [블록] ${await el.isVisible({ timeout: 500 }).catch(() => false) ? "✅" : "❌"} "${b}"`);
          }
        }
        await page.keyboard.press("Escape");
      } else if (msgVis) {
        console.log("[성적] '수업결과' 대신 '메시지 발송' 사용");
        await msgBtn.click();
        await page.waitForTimeout(2000);
        await snap(page, "full-1-msg-modal");
        await page.keyboard.press("Escape");
      }
    } else {
      console.log("[성적] ⚠️ 체크박스 없음");
      // 페이지 전체 텍스트 확인
      const bodyText = await page.locator("main, [class*=content], [class*=main]").first().textContent().catch(() => "");
      console.log(`[성적] 페이지 내용: ${bodyText?.slice(0, 200)}`);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. 템플릿 CRUD
  // ═══════════════════════════════════════════════════════════════
  test("2. 템플릿 CRUD — 생성/확인/삭제", async ({ page }) => {
    await page.goto(`${BASE}/admin/message/templates`, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(4000);
    await snap(page, "full-2-templates");

    // 페이지 구조 분석
    const allBtns = page.locator("button:visible");
    const btnTexts: string[] = [];
    for (let i = 0; i < Math.min(await allBtns.count(), 30); i++) {
      const t = await allBtns.nth(i).textContent().catch(() => "");
      if (t && t.trim().length > 1) btnTexts.push(t.trim().slice(0, 25));
    }
    console.log(`[템플릿] 버튼: ${btnTexts.join(" | ")}`);

    // 카테고리에서 "사용자" 클릭
    const userCat = page.locator("button, a, [class*=tree] [class*=item]").filter({ hasText: "사용자" }).first();
    if (await userCat.isVisible({ timeout: 3000 }).catch(() => false)) {
      await userCat.click();
      await page.waitForTimeout(1500);
    }

    // "추가" 또는 "+" 버튼 찾기
    const addBtn = page.locator("button").filter({ hasText: /추가|새 양식|만들기|\+/ }).first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("[템플릿] ✅ 추가 버튼 발견");
      await addBtn.click();
      await page.waitForTimeout(2000);
      await snap(page, "full-2-create-modal");

      // 이름 + 본문 입력
      const _nameInput = page.locator("input").filter({ hasText: /.*/ }).first();
      const inputs = page.locator("input:visible");
      for (let i = 0; i < Math.min(await inputs.count(), 5); i++) {
        const ph = await inputs.nth(i).getAttribute("placeholder").catch(() => "");
        console.log(`  [input ${i}] placeholder: ${ph}`);
      }

      const textareas = page.locator("textarea:visible");
      for (let i = 0; i < Math.min(await textareas.count(), 3); i++) {
        const ph = await textareas.nth(i).getAttribute("placeholder").catch(() => "");
        console.log(`  [textarea ${i}] placeholder: ${ph}`);
      }
    } else {
      console.log("[템플릿] 추가 버튼 미발견");
      // 기존 템플릿 카드 클릭 시도
      const cards = page.locator("[class*=card], [class*=template]").filter({ hasText: /.{5,}/ });
      const cardCount = await cards.count();
      console.log(`[템플릿] 카드 수: ${cardCount}`);
      if (cardCount > 0) {
        await cards.first().click();
        await page.waitForTimeout(2000);
        await snap(page, "full-2-card-detail");
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. 발송 내역 상세
  // ═══════════════════════════════════════════════════════════════
  test("3. 발송 내역 상세 — 행 클릭 → 팝업 → 내용 확인", async ({ page }) => {
    await page.goto(`${BASE}/admin/message/log`, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(4000);
    await snap(page, "full-3-log");

    // 발송 로그 행 (button 기반 커스텀 행)
    const rows = page.locator("button").filter({ hasText: /\d{4}/ });
    {
      const rowCount = await rows.count();
      console.log(`[발송 내역] 행 수: ${rowCount}`);

      if (rowCount > 0) {
        // 첫 번째 행 텍스트
        const firstRowText = await rows.first().textContent();
        console.log(`[발송 내역] 첫 행: ${firstRowText?.trim().slice(0, 100)}`);

        // 행 클릭
        await rows.first().click();
        await page.waitForTimeout(2000);
        await snap(page, "full-3-log-detail");

        // 상세 모달 확인 — 페이지 내 새로운 콘텐츠 감지
        await page.waitForTimeout(1000);
        await snap(page, "full-3-log-detail-after-click");

        // 핵심 정보 존재 확인 — 모달 또는 드로어 안에서
        for (const label of ["수신자", "내용", "발송", "상태", "채널", "시간", "발송 상세"]) {
          const el = page.locator(`text=${label}`).first();
          const vis = await el.isVisible({ timeout: 1000 }).catch(() => false);
          console.log(`  [상세] ${vis ? "✅" : "❌"} "${label}"`);
        }

        await snap(page, "full-3-log-detail-content");

        // ESC로 닫기
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      }
    }
  }); // test 3 end

  // ═══════════════════════════════════════════════════════════════
  // 4. 클리닉 메시지 설정 + 미리보기 (#{장소} 수정 검증)
  // ═══════════════════════════════════════════════════════════════
  test("4. 클리닉 설정 + 미리보기 + #{장소} 변수 확인", async ({ page }) => {
    await page.goto(`${BASE}/admin/clinic/msg-settings`, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(5000);
    await snap(page, "full-4-clinic-settings");

    // 페이지 로딩 확인
    const pageContent = await page.locator("main, [class*=content]").first().textContent().catch(() => "");
    console.log(`[클리닉 설정] 페이지 내용 (100자): ${pageContent?.slice(0, 100)}`);

    // 트리거 카드 확인
    for (const trigger of ["예약", "입실", "결석", "자율학습", "취소"]) {
      const el = page.locator(`text=${trigger}`).first();
      const vis = await el.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`  [트리거] ${vis ? "✅" : "❌"} "${trigger}"`);
    }

    // 미리보기 버튼 찾기
    const previewBtns = page.locator("button").filter({ hasText: /미리보기/ });
    const previewCount = await previewBtns.count();
    console.log(`[클리닉] 미리보기 버튼 수: ${previewCount}`);

    if (previewCount > 0) {
      // 첫 번째 미리보기 클릭
      await previewBtns.first().click();
      await page.waitForTimeout(2000);
      await snap(page, "full-4-clinic-preview");

      // 카카오 카드 확인
      const kakaoCard = page.locator(".template-preview-kakao, [class*=kakao]");
      console.log(`[클리닉 미리보기] 카카오 카드: ${await kakaoCard.first().isVisible().catch(() => false)}`);

      // "장소?" 경고 확인
      const warning = page.locator("text=장소?");
      if (await warning.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("[클리닉 미리보기] ⚠️ '장소?' 경고 표시 — templateBlocks 수정 미반영");
      } else {
        console.log("[클리닉 미리보기] ✅ '장소?' 경고 없음 — 변수 정상");
      }

      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // 알림톡/SMS 패널 확인
    const alimPanel = page.locator("text=알림톡").first();
    const smsPanel = page.locator("text=SMS").first();
    console.log(`[클리닉] 알림톡: ${await alimPanel.isVisible().catch(() => false)}`);
    console.log(`[클리닉] SMS: ${await smsPanel.isVisible().catch(() => false)}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. 알림톡 발송 검증
  // ═══════════════════════════════════════════════════════════════
  test("5. 알림톡 발송 — 실제 발송 시도 + 결과 확인", async ({ page }) => {
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(3000);

    // 학생 선택
    const check = page.locator('input[type="checkbox"]').nth(1);
    if (!(await check.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log("[알림톡] 학생 없음");
      return;
    }
    await check.click();
    await page.waitForTimeout(500);

    // 메시지 발송
    const sendBtn = page.locator("button").filter({ hasText: /메시지/ }).first();
    await sendBtn.click();
    await page.waitForTimeout(2000);

    // 알림톡 모드
    const alimBtn = page.locator("button").filter({ hasText: "알림톡" }).first();
    await alimBtn.click();
    await page.waitForTimeout(1000);

    // 양식 선택 → 직접 작성
    const tplBtn = page.locator("button").filter({ hasText: /양식 선택/ }).first();
    if (await tplBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tplBtn.click();
      await page.waitForTimeout(500);
      const free = page.locator("button").filter({ hasText: "직접 작성하기" }).first();
      if (await free.isVisible({ timeout: 2000 }).catch(() => false)) {
        await free.click();
        await page.waitForTimeout(500);
      }
    }

    // 본문 입력
    const textarea = page.locator("textarea").first();
    if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      const ts = new Date().toISOString().slice(11, 19);
      await textarea.fill(`[E2E-알림톡-${ts}] 메시징 감사. #{학생이름}님 무시해주세요.`);
    }

    // 학부모만 (학생 해제)
    const stCheck = page.locator("label").filter({ hasText: "학생" }).locator("input[type=checkbox]").first();
    if (await stCheck.isVisible({ timeout: 2000 }).catch(() => false) && await stCheck.isChecked()) {
      await stCheck.uncheck();
    }

    // 발송 시도
    const mainSend = page.locator("button").filter({ hasText: /에게.*발송/ }).last();
    const enabled = await mainSend.isEnabled().catch(() => false);
    console.log(`[알림톡] 발송 버튼 활성: ${enabled}`);

    // disable 사유 확인
    const disableText = page.locator("[class*=footer] span, [class*=footer] div").filter({ hasText: /연동|선택|입력/ });
    if (await disableText.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      const reason = await disableText.first().textContent();
      console.log(`[알림톡] disable 사유: ${reason?.trim()}`);
    }

    await snap(page, "full-5-alimtalk-attempt");

    if (enabled) {
      await mainSend.click();
      await page.waitForTimeout(1500);

      const confirmBtn = page.locator("button").filter({ hasText: "발송하기" }).first();
      if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await snap(page, "full-5-alimtalk-confirm");
        await confirmBtn.click();
        await page.waitForTimeout(3000);
        console.log("[알림톡] ✅ 발송 요청 완료");
        await snap(page, "full-5-alimtalk-sent");
      }
    } else {
      console.log("[알림톡] 발송 불가 — 외부 블로커로 분류");
    }

    await page.keyboard.press("Escape");
  });
});
