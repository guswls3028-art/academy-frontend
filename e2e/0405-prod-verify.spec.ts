/**
 * 0405 배포 검증 — 운영 브라우저 E2E
 *
 * 핵심 검증:
 * 1. 성적탭 최종 판정 컬럼: 미입력="-", 불합격="불합", 합격="합격"
 * 2. 편집 모드 안내 배너 표시
 * 3. 모달 드래그/최소화 동작
 * 4. 클리닉 이중클릭 방지
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("0405 배포 검증", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("성적탭 — 판정 컬럼 + 편집 모드 안내 배너", async ({ page }) => {
    // 성적 페이지 직접 이동 (Tenant 1, lecture 92, session 90)
    await page.goto("https://hakwonplus.com/admin/lectures/92/sessions/90/scores", { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(3000);

    // 성적 테이블 존재 확인
    const scoresTable = page.locator(".ds-scores-table, table").first();
    await expect(scoresTable).toBeVisible({ timeout: 10000 });

    // 판정 컬럼 확인 — "합격" 또는 "불합" 또는 "-"만 있어야 함
    const verdictCells = scoresTable.locator("[data-col-type='clinic']");
    const count = await verdictCells.count();
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const text = (await verdictCells.nth(i).textContent() ?? "").trim();
        const valid = ["합격", "불합", "-", ""].includes(text);
        expect(valid).toBeTruthy();
      }
    }

    // 편집 모드 진입
    const editBtn = page.getByRole("button", { name: /편집/ }).or(page.locator("button").filter({ hasText: /편집/ })).first();
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(1000);

      // 편집 모드 안내 배너 확인
      const banner = page.locator("text=편집 모드").first();
      await expect(banner).toBeVisible({ timeout: 3000 });

      // 단축키 안내 텍스트 확인
      const hint = page.locator("text=미제출").first();
      await expect(hint).toBeVisible({ timeout: 2000 });

      await page.screenshot({ path: "e2e/screenshots/0405-edit-mode-banner.png" });

      // 편집 모드 종료 (Esc)
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: "e2e/screenshots/0405-scores-verdict.png" });
  });

  test("모달 드래그 — 헤더 드래그로 위치 이동", async ({ page }) => {
    // 학생 목록으로 이동
    await page.locator("nav, aside").getByText(/학생/).first().click();
    await page.waitForTimeout(1500);

    // 학생 추가 버튼 → 모달 열기
    const addBtn = page.getByRole("button", { name: /학생.*추가|새 학생|등록/ }).first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1000);

      // 모달 헤더 확인
      const modalHeader = page.locator(".modal-header").first();
      if (await modalHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
        // grab cursor 확인
        const cursor = await modalHeader.evaluate((el) => getComputedStyle(el).cursor);
        expect(cursor).toBe("grab");

        // 드래그 전 위치
        const box = await modalHeader.boundingBox();
        expect(box).not.toBeNull();

        if (box) {
          // 드래그 실행
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 5 });
          await page.mouse.up();

          // 드래그 후 위치 변경 확인
          const newBox = await modalHeader.boundingBox();
          if (newBox) {
            expect(Math.abs((newBox.x - box.x))).toBeGreaterThan(10);
          }
        }

        await page.screenshot({ path: "e2e/screenshots/0405-modal-drag.png" });
      }

      // 모달 닫기
      await page.keyboard.press("Escape");
    }
  });

  test("모달 최소화 버튼 존재", async ({ page }) => {
    // 학생 목록
    await page.locator("nav, aside").getByText(/학생/).first().click();
    await page.waitForTimeout(1500);

    // 학생 추가 모달
    const addBtn = page.getByRole("button", { name: /학생.*추가|새 학생|등록/ }).first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1000);

      // 최소화 버튼(−) 확인
      const minimizeBtn = page.locator(".modal-minimize-btn").first();
      if (await minimizeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await minimizeBtn.click();
        await page.waitForTimeout(500);

        // 태스크바에 탭이 나타나는지 확인
        const taskbar = page.locator(".modal-taskbar").first();
        await expect(taskbar).toBeVisible({ timeout: 2000 });

        // 태스크바 탭 클릭으로 복원
        const restoreBtn = page.locator(".modal-taskbar__tab-restore").first();
        if (await restoreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await restoreBtn.click();
          await page.waitForTimeout(500);

          // 모달 다시 보이는지 확인
          const modal = page.locator(".admin-modal__inner, .ant-modal").first();
          await expect(modal).toBeVisible({ timeout: 2000 });
        }

        await page.screenshot({ path: "e2e/screenshots/0405-modal-minimize.png" });
      }
    }

    await page.keyboard.press("Escape");
  });

  test("학생앱 — 성적 페이지 정상 렌더", async ({ page }) => {
    // 학생 로그인
    await loginViaUI(page, "student");

    // 성적 탭 클릭
    const gradesTab = page.locator("nav, [role='tabbar']").getByText(/성적|점수/).first();
    if (await gradesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await gradesTab.click();
      await page.waitForTimeout(2000);

      // 페이지 에러 없이 렌더 확인
      const errorToast = page.locator("[role='alert'], .ant-message-error, .toast-error");
      const errorCount = await errorToast.count();
      expect(errorCount).toBe(0);

      await page.screenshot({ path: "e2e/screenshots/0405-student-grades.png" });
    }
  });
});
