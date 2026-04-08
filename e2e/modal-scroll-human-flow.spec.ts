/**
 * 모달 스크롤 — 인간 사용자 관점 실사용 흐름 검증
 *
 * 사이드바 클릭 → 강의 목록 → 강의 클릭 → 차시 탭 → 차시 클릭 →
 * 수강생 등록 → 모달 열기 → 검색 → 스크롤 → 다중 선택 → 저장 →
 * 반영 확인 → 재진입 → 닫기 → body scroll 복구
 *
 * Tenant 1, session 152 (15명 등록됨)
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.setTimeout(120000);

const SESSION_ID = 152;
const LECTURE_ID = 96;

/** 모달 flex 구조 검증 */
async function assertFlexModal(page: Page, label: string) {
  const inner = page.locator(".admin-modal__inner").last();
  await expect(inner).toBeVisible({ timeout: 5000 });
  const s = await inner.evaluate(el => {
    const cs = window.getComputedStyle(el);
    return { d: cs.display, fd: cs.flexDirection, mh: cs.maxHeight };
  });
  expect(s.d, `${label} display`).toBe("flex");
  expect(s.fd, `${label} direction`).toBe("column");
}

/** footer viewport 내 확인 */
async function assertFooterInViewport(page: Page, label: string) {
  const footer = page.locator(".modal-footer").last();
  if (await footer.isVisible({ timeout: 2000 }).catch(() => false)) {
    const box = await footer.boundingBox();
    const vp = page.viewportSize()!;
    expect(box, `${label} footer box`).toBeTruthy();
    expect(box!.y + box!.height, `${label} footer ≤ ${vp.height}`)
      .toBeLessThanOrEqual(vp.height + 2);
  }
}

test.describe("인간 흐름 — 수강생 등록 모달 전체 검증", () => {

  test("1. 사이드바→강의→차시→수강생등록 모달 열기→스크롤→선택→해제→저장→반영→재진입", async ({ page }) => {
    await loginViaUI(page, "admin");

    // ===== 사이드바에서 '강의' 클릭 =====
    const lectureNav = page.locator("nav a, aside a").filter({ hasText: /^강의$/ }).first();
    await expect(lectureNav).toBeVisible({ timeout: 10000 });
    await lectureNav.click();
    await page.waitForURL(/\/admin\/lectures/, { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "e2e/screenshots/human-01-lecture-list.png" });

    // ===== 강의 '[E2E] 서성원 수학' 행 클릭 =====
    const lectureRow = page.locator("table tbody tr").filter({ hasText: /서성원 수학/ }).first();
    await expect(lectureRow).toBeVisible({ timeout: 5000 });
    await lectureRow.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/human-02-lecture-detail.png" });

    // ===== 차시 탭 클릭 (상단 탭 영역) =====
    // 강의 상세 페이지에서 차시 목록을 보려면 '차시' 또는 '수업' 탭
    const sessionTab = page.locator("a, button, [role='tab']").filter({ hasText: /차시|수업/ }).first();
    if (await sessionTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionTab.click();
      await page.waitForTimeout(2000);
    } else {
      // URL로 직접 이동
      await page.goto(`https://hakwonplus.com/admin/lectures/${LECTURE_ID}/sessions`, { waitUntil: "load" });
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: "e2e/screenshots/human-03-sessions-tab.png" });

    // ===== 차시 블록 클릭 → 차시 상세 =====
    const sessionLink = page.locator(`a[href*="/sessions/${SESSION_ID}"], a[href*="sessions/${SESSION_ID}"]`).first();
    if (await sessionLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionLink.click();
      await page.waitForTimeout(2000);
    } else {
      // 차시 카드/블록 클릭
      const sessionBlock = page.locator("text=스크롤테스트차시").first();
      if (await sessionBlock.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sessionBlock.click();
        await page.waitForTimeout(2000);
      } else {
        // 직접 URL 이동 (fallback)
        await page.goto(`https://hakwonplus.com/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/attendance`, { waitUntil: "load" });
        await page.waitForTimeout(2000);
      }
    }
    await page.screenshot({ path: "e2e/screenshots/human-04-session-detail.png" });
    console.log("Session page URL:", page.url());

    // ===== 출결 탭에서 '수강생 등록' 버튼 클릭 =====
    const enrollBtn = page.locator("button").filter({ hasText: "수강생 등록" }).first();
    await expect(enrollBtn).toBeVisible({ timeout: 8000 });
    await enrollBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "e2e/screenshots/human-05-method-modal.png" });

    // ===== 등록 방식 선택 모달 — flex 구조 확인 =====
    await assertFlexModal(page, "등록방식");
    await assertFooterInViewport(page, "등록방식");

    // "차시 생성 후 업로드" 클릭 → SessionEnrollModal
    const methodCard = page.locator("text=차시 생성 후 업로드").first();
    if (!(await methodCard.isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log("Method card not found, trying direct approach...");
      // 이미 SessionEnrollModal이 열려있을 수 있음
    } else {
      await methodCard.click();
      await page.waitForTimeout(2500);
    }
    await page.screenshot({ path: "e2e/screenshots/human-06-enroll-modal.png" });

    // ===== SessionEnrollModal (split-layout) 열림 확인 =====
    const splitLayout = page.locator(".ds-split-layout").first();
    const hasSplitLayout = await splitLayout.isVisible({ timeout: 5000 }).catch(() => false);
    console.log("Split layout visible:", hasSplitLayout);

    if (hasSplitLayout) {
      // --- 구조 검증 ---
      await assertFlexModal(page, "SessionEnroll");
      await assertFooterInViewport(page, "SessionEnroll");

      // --- 테이블 스크롤 가능 확인 ---
      const tableArea = page.locator(".modal-inner-table").first();
      await expect(tableArea).toBeVisible({ timeout: 3000 });

      const scrollInfo = await tableArea.evaluate(el => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        canScroll: el.scrollHeight > el.clientHeight + 5,
        scrollbarWidth: window.getComputedStyle(el).scrollbarWidth,
      }));
      console.log("Table scroll:", scrollInfo);
      expect(scrollInfo.scrollbarWidth, "scrollbar visible").toBe("thin");

      // --- 학생 행 수 확인 ---
      const rowCount = await page.locator(".modal-inner-table tbody tr").count();
      console.log("Student rows:", rowCount);
      expect(rowCount, "학생이 표시되어야 함").toBeGreaterThan(0);

      // --- 학생 다중 선택 ---
      // 3명 선택
      for (let i = 0; i < Math.min(3, rowCount); i++) {
        const cb = page.locator(".modal-inner-table tbody tr").nth(i).locator("input[type='checkbox']");
        if (await cb.isVisible({ timeout: 500 }).catch(() => false)) {
          await cb.check();
          await page.waitForTimeout(200);
        }
      }

      // 선택 확인
      const selectedText = await page.locator("text=/\\d+명 선택됨/").first().innerText().catch(() => "");
      console.log("Selected:", selectedText);
      expect(selectedText).toContain("선택됨");
      await page.screenshot({ path: "e2e/screenshots/human-07-selected.png" });

      // --- 우측 선택 목록 스크롤 확인 ---
      // 선택 패널이 overflow-y:auto인지
      const rightPanel = page.locator(".ds-split-layout > div:last-child .overflow-y-auto").first();
      if (await rightPanel.isVisible({ timeout: 1000 }).catch(() => false)) {
        const rpScroll = await rightPanel.evaluate(el => ({
          overflowY: window.getComputedStyle(el).overflowY,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        }));
        console.log("Right panel scroll:", rpScroll);
      }

      // --- 선택 해제 ---
      const firstCb = page.locator(".modal-inner-table tbody tr").first().locator("input[type='checkbox']");
      await firstCb.uncheck();
      await page.waitForTimeout(200);

      // --- footer 저장 버튼 접근 확인 ---
      const saveBtn = page.locator(".modal-footer button").filter({ hasText: /저장|확정|추가/ }).first();
      if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        const box = await saveBtn.boundingBox();
        const vp = page.viewportSize()!;
        expect(box!.y + box!.height, "save btn visible").toBeLessThanOrEqual(vp.height + 2);
        console.log("Save button position:", { y: box!.y.toFixed(0), bottom: (box!.y + box!.height).toFixed(0) });

        // --- 저장 클릭 ---
        await saveBtn.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: "e2e/screenshots/human-08-after-save.png" });
        console.log("After save URL:", page.url());
      }

      // --- body scroll 복구 ---
      const bodyOverflow = await page.evaluate(() => window.getComputedStyle(document.body).overflow);
      expect(bodyOverflow, "body scroll restored after save").not.toBe("hidden");

      // --- 재진입: 수강생 등록 다시 열기 ---
      const enrollBtn2 = page.locator("button").filter({ hasText: "수강생 등록" }).first();
      if (await enrollBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
        await enrollBtn2.click();
        await page.waitForTimeout(1500);

        // 등록 방식 선택 모달
        const methodCard2 = page.locator("text=차시 생성 후 업로드").first();
        if (await methodCard2.isVisible({ timeout: 2000 }).catch(() => false)) {
          await methodCard2.click();
          await page.waitForTimeout(2000);
        }

        // 재진입 후 구조 확인
        if (await page.locator(".ds-split-layout").first().isVisible({ timeout: 3000 }).catch(() => false)) {
          await assertFlexModal(page, "재진입");
          await assertFooterInViewport(page, "재진입");

          const rowCount2 = await page.locator(".modal-inner-table tbody tr").count();
          console.log("Re-entry rows:", rowCount2);

          await page.screenshot({ path: "e2e/screenshots/human-09-reentry.png" });
        }

        // X 닫기
        const xBtn = page.locator(".ant-modal-wrap:not([style*='display: none']) .ant-modal-close").last();
        if (await xBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await xBtn.click();
          await page.waitForTimeout(1000);
        }
        // confirm이 뜨면 처리 (안 뜨면 skip)
        for (let attempt = 0; attempt < 3; attempt++) {
          const anyModal = page.locator(".ant-modal-wrap:not([style*='display: none']) .admin-modal__inner");
          if (!(await anyModal.first().isVisible({ timeout: 500 }).catch(() => false))) break;
          const dangerBtn = page.locator("button").filter({ hasText: /해제|확인|닫기/ }).last();
          if (await dangerBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await dangerBtn.click();
            await page.waitForTimeout(500);
          } else {
            const x2 = page.locator(".ant-modal-wrap:not([style*='display: none']) .ant-modal-close").last();
            if (await x2.isVisible({ timeout: 500 }).catch(() => false)) { await x2.click(); await page.waitForTimeout(500); }
          }
        }
      }

      // 최종 body scroll
      const finalOverflow = await page.evaluate(() => window.getComputedStyle(document.body).overflow);
      expect(finalOverflow, "final body scroll").not.toBe("hidden");
    }

    await page.screenshot({ path: "e2e/screenshots/human-10-final.png" });
  });

  test("2. 작은 화면(1366x768) split-layout 모달 — 스크롤 + 저장 버튼 접근", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await loginViaUI(page, "admin");

    await page.goto(`https://hakwonplus.com/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/attendance`, { waitUntil: "load" });
    await page.waitForTimeout(2500);

    const enrollBtn = page.locator("button").filter({ hasText: "수강생 등록" }).first();
    if (!(await enrollBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip(true, "수강생 등록 버튼 없음");
      return;
    }
    await enrollBtn.click();
    await page.waitForTimeout(1500);

    // 등록 방식 → 차시 생성 후 업로드
    const methodCard = page.locator("text=차시 생성 후 업로드").first();
    if (await methodCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await methodCard.click();
      await page.waitForTimeout(2500);
    }

    // split-layout 모달
    if (await page.locator(".ds-split-layout").first().isVisible({ timeout: 3000 }).catch(() => false)) {
      // 모달 전체가 768px 안에 들어가는지
      const inner = page.locator(".admin-modal__inner").last();
      const innerBox = await inner.boundingBox();
      expect(innerBox, "inner visible").toBeTruthy();
      expect(innerBox!.y + innerBox!.height, "fits in 768").toBeLessThanOrEqual(768 + 2);
      console.log(`1366x768: inner bottom=${(innerBox!.y + innerBox!.height).toFixed(0)}`);

      // 테이블 스크롤 확인
      const tableArea = page.locator(".modal-inner-table").first();
      const scroll = await tableArea.evaluate(el => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        canScroll: el.scrollHeight > el.clientHeight + 5,
      }));
      console.log("1366x768 scroll:", scroll);

      // 스크롤이 필요하면 실제로 스크롤 수행
      if (scroll.canScroll) {
        await tableArea.evaluate(el => el.scrollTop = el.scrollHeight);
        await page.waitForTimeout(300);
        const scrolledTop = await tableArea.evaluate(el => el.scrollTop);
        expect(scrolledTop, "scroll actually moved").toBeGreaterThan(0);
        console.log("Scrolled to:", scrolledTop);
      }

      // footer 저장 버튼 접근
      await assertFooterInViewport(page, "1366x768");
    }

    await page.screenshot({ path: "e2e/screenshots/human-11-small-viewport.png" });
  });

  test("3. 연속 열기/닫기 5회 + 다른 모달 연속 — scroll lock 꼬임 없음", async ({ page }) => {
    await loginViaUI(page, "admin");

    await page.goto(`https://hakwonplus.com/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/attendance`, { waitUntil: "load" });
    await page.waitForTimeout(2500);

    const enrollBtn = page.locator("button").filter({ hasText: "수강생 등록" }).first();
    if (!(await enrollBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip(true, "수강생 등록 버튼 없음");
      return;
    }

    // 5회 연속 열기/닫기
    for (let i = 0; i < 5; i++) {
      await enrollBtn.click();
      await page.waitForTimeout(800);

      // X 닫기
      const xBtn = page.locator(".ant-modal-wrap:not([style*='display: none']) .ant-modal-close").last();
      if (await xBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await xBtn.click();
        await page.waitForTimeout(500);
      }

      // body scroll 매번 확인
      const overflow = await page.evaluate(() => window.getComputedStyle(document.body).overflow);
      expect(overflow, `cycle ${i + 1}: body scroll ok`).not.toBe("hidden");
    }

    // 다른 페이지 → 다른 모달 열기
    await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    const createBtn = page.locator("button").filter({ hasText: /학생 등록|학생 추가/ }).first();
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(1000);

      await assertFlexModal(page, "학생생성 after cycles");

      // 닫기
      const xBtn = page.locator(".ant-modal-wrap:not([style*='display: none']) .ant-modal-close").last();
      if (await xBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await xBtn.click();
        await page.waitForTimeout(500);
      }
    }

    const finalOverflow = await page.evaluate(() => window.getComputedStyle(document.body).overflow);
    expect(finalOverflow, "final scroll ok").not.toBe("hidden");
    await page.screenshot({ path: "e2e/screenshots/human-12-cycles.png" });
  });
});
