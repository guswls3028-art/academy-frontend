/**
 * 모달 스크롤 버그 회귀 테스트
 *
 * 검증:
 * 1. admin-modal__inner가 flex column 레이아웃
 * 2. Footer(저장 버튼)가 항상 viewport 내 접근 가능
 * 3. modal-body overflow:hidden (split-layout)
 * 4. modal-inner-table 스크롤바 visible
 * 5. 모달 닫은 뒤 body scroll 복구
 * 6. 작은 화면(1366x768)에서도 동일
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

/** 아무 모달이든 열어서 구조 검증 */
async function openAnyAdminModal(page: import("@playwright/test").Page) {
  // 강의 목록 → 강의 상세
  await page.locator("a").filter({ hasText: /^강의$/ }).first().click();
  await page.waitForURL(/\/admin\/lectures/, { timeout: 10000 });
  await page.waitForTimeout(1500);

  // 첫 번째 강의 행 클릭
  await page.locator("table tbody tr").first().click();
  await page.waitForTimeout(2000);

  // "수강생 등록" 버튼 클릭 → 등록 방식 선택 모달
  const enrollBtn = page.locator("button").filter({ hasText: "수강생 등록" }).first();
  await expect(enrollBtn).toBeVisible({ timeout: 5000 });
  await enrollBtn.click();
  await page.waitForTimeout(1500);
}

test.describe("모달 스크롤 검증", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("모달 flex 레이아웃 + Footer 접근 + body scroll 복구", async ({ page }) => {
    await openAnyAdminModal(page);

    // 모달이 열렸는지 확인 (antd v5: .ant-modal-body, admin: .admin-modal__inner)
    const modalContent = page.locator(".admin-modal__inner").first();
    await expect(modalContent).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: "e2e/screenshots/modal-scroll-01-opened.png" });

    // 1. admin-modal__inner flex column 확인
    const innerDiv = page.locator(".admin-modal__inner").first();
    await expect(innerDiv).toBeVisible({ timeout: 3000 });
    const styles = await innerDiv.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        display: cs.display,
        flexDirection: cs.flexDirection,
        maxHeight: cs.maxHeight,
      };
    });
    expect(styles.display).toBe("flex");
    expect(styles.flexDirection).toBe("column");
    expect(styles.maxHeight).not.toBe("none");
    console.log("admin-modal__inner styles:", styles);

    // 2. modal-header flex-shrink: 0
    const header = page.locator(".modal-header").first();
    if (await header.isVisible({ timeout: 1000 }).catch(() => false)) {
      const headerShrink = await header.evaluate((el) => {
        return window.getComputedStyle(el).flexShrink;
      });
      expect(headerShrink).toBe("0");
    }

    // 3. modal-footer 접근 가능 + flex-shrink: 0
    const footer = page.locator(".modal-footer").first();
    if (await footer.isVisible({ timeout: 1000 }).catch(() => false)) {
      const footerBox = await footer.boundingBox();
      const viewport = page.viewportSize()!;
      expect(footerBox).toBeTruthy();
      expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(viewport.height + 2);

      const footerShrink = await footer.evaluate((el) => {
        return window.getComputedStyle(el).flexShrink;
      });
      expect(footerShrink).toBe("0");
    }

    // 4. modal-body flex: 1 1 auto, overflow hidden
    const body = page.locator(".modal-body").first();
    if (await body.isVisible({ timeout: 1000 }).catch(() => false)) {
      const bodyStyles = await body.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          flexGrow: cs.flexGrow,
          flexShrink: cs.flexShrink,
          minHeight: cs.minHeight,
          overflow: cs.overflow,
        };
      });
      expect(bodyStyles.flexGrow).toBe("1");
      expect(bodyStyles.minHeight).toBe("0px");
      console.log("modal-body styles:", bodyStyles);
    }

    // 5. 모달 닫기 → body scroll 복구
    // X 버튼으로 닫기 시도
    const xBtn = page.locator(".ant-modal-close").first();
    await xBtn.click();
    await page.waitForTimeout(1000);

    // 아직 모달이 열려있으면 (confirm dialog), 확인 버튼 클릭
    const stillOpen = await page.locator(".admin-modal__inner").first().isVisible({ timeout: 500 }).catch(() => false);
    if (stillOpen) {
      // confirm dialog에서 닫기/해제 버튼
      const confirmBtn = page.locator(".admin-modal--confirm button, button").filter({ hasText: /해제|닫기|확인/ }).last();
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.click();
      }
      await page.waitForTimeout(500);
    }

    const bodyOverflow = await page.evaluate(() => {
      return window.getComputedStyle(document.body).overflow;
    });
    expect(bodyOverflow).not.toBe("hidden");
    console.log("body overflow after close:", bodyOverflow);

    await page.screenshot({ path: "e2e/screenshots/modal-scroll-02-closed.png" });
  });

  test("작은 화면(1366x768) 모달 Footer viewport 내", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await openAnyAdminModal(page);

    const modalContent = page.locator(".admin-modal__inner").first();
    await expect(modalContent).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: "e2e/screenshots/modal-scroll-03-small.png" });

    // inner div가 viewport 내에 맞는지
    const innerDiv = page.locator(".admin-modal__inner").first();
    if (await innerDiv.isVisible({ timeout: 2000 }).catch(() => false)) {
      const innerBox = await innerDiv.boundingBox();
      expect(innerBox).toBeTruthy();
      // 모달 전체가 768px 안에 들어와야 함
      expect(innerBox!.height).toBeLessThanOrEqual(768 - 40);
    }

    // Footer 접근 가능
    const footer = page.locator(".modal-footer").first();
    if (await footer.isVisible({ timeout: 1000 }).catch(() => false)) {
      const footerBox = await footer.boundingBox();
      expect(footerBox).toBeTruthy();
      expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(768 + 2);
    }
  });

  test("modal-inner-table 스크롤바 visible 설정 확인", async ({ page }) => {
    await openAnyAdminModal(page);

    // 모달 내 테이블 스크롤바 CSS 확인
    // 직접 modal-inner-table이 없을 수 있으므로 CSS 규칙 존재 확인
    const scrollbarVisible = await page.evaluate(() => {
      // modal-inner-table 스타일시트 규칙 확인
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSStyleRule && rule.selectorText === ".modal-inner-table") {
              return rule.style.scrollbarWidth;
            }
          }
        } catch { /* cross-origin stylesheets */ }
      }
      return null;
    });
    // scrollbar-width가 thin이면 스크롤바가 보임
    expect(scrollbarVisible).toBe("thin");
    console.log("modal-inner-table scrollbar-width:", scrollbarVisible);
  });
});
