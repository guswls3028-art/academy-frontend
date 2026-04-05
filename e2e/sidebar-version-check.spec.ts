// 운영 사이트 최신 배포 확인 + 브라우저별 사이드바 테스트
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test("verify latest deployment has modal-taskbar CSS", async ({ page }) => {
  await loginViaUI(page, "admin");
  await page.waitForSelector(".sidebar .nav-item", { timeout: 15000 });

  // modal-taskbar.css가 로드되었는지 확인 (최신 커밋 be9c6cc2의 변경사항)
  const hasModalTaskbarCSS = await page.evaluate(() => {
    // .modal-header에 cursor: grab이 적용되어 있는지 체크
    const testEl = document.createElement("div");
    testEl.className = "modal-header";
    testEl.style.display = "none";
    document.body.appendChild(testEl);
    const style = getComputedStyle(testEl);
    const cursor = style.cursor;
    document.body.removeChild(testEl);
    return cursor;
  });
  console.log("modal-header cursor style:", hasModalTaskbarCSS);
  // "grab"이면 최신 코드 배포됨, 아니면 이전 버전

  // z-index.css가 로드되었는지 확인
  const hasZIndexCSS = await page.evaluate(() => {
    return getComputedStyle(document.documentElement).getPropertyValue("--z-taskbar").trim();
  });
  console.log("--z-taskbar value:", hasZIndexCSS);

  // ModalWindowProvider가 마운트되었는지 확인
  const hasModalProvider = await page.evaluate(() => {
    // React 컴포넌트 트리에서 확인하기 어려우므로, 전역 DOM에서 힌트를 찾음
    // ModalTaskbar는 minimized modals가 없을 때 null 리턴하므로 DOM에 없을 수 있음
    return {
      hasZIndex: !!getComputedStyle(document.documentElement).getPropertyValue("--z-taskbar"),
      hasMinimizeZone: !!getComputedStyle(document.documentElement).getPropertyValue("--z-minimize-zone"),
    };
  });
  console.log("CSS variables present:", JSON.stringify(hasModalProvider));

  if (hasModalTaskbarCSS === "grab") {
    console.log("✓ Latest deployment confirmed (modal-taskbar.css loaded)");
  } else {
    console.log("✗ WARNING: modal-taskbar.css may not be loaded — possible stale deployment");
  }
});

test("safari-like user agent sidebar test", async ({ page, context }) => {
  // iPhone Safari-like viewport and UA
  await page.setViewportSize({ width: 393, height: 852 });
  await page.setExtraHTTPHeaders({
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  });

  await loginViaUI(page, "admin");
  await page.waitForTimeout(3000);
  console.log("Safari-like start:", page.url());

  // 모바일 메뉴 클릭
  const menuBtn = page.locator('.teacher-tabbar button').filter({ hasText: "메뉴" });
  if (await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await menuBtn.click();
    await page.waitForTimeout(1000);

    // 드로어 내 시험 메뉴 클릭
    const examLink = page.locator('.ant-drawer-body .nav-item[href="/admin/exams"]');
    if (await examLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await examLink.click();
      await page.waitForTimeout(2000);
      console.log("Safari-like after exams:", page.url());
    }

    // 하단 탭으로 학생 이동
    const studentTab = page.locator('.teacher-tabbar a[href="/admin/students"]');
    if (await studentTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await studentTab.click();
      await page.waitForTimeout(2000);
      console.log("Safari-like after students tab:", page.url());
    }
  }
});

test("check all tenants sidebar", async ({ page }) => {
  // hakwonplus
  await loginViaUI(page, "admin");
  await page.waitForSelector(".sidebar .nav-item", { timeout: 15000 });
  await page.locator('.sidebar .nav-item[href="/admin/students"]').click();
  await page.waitForTimeout(1500);
  console.log("hakwonplus:", page.url());

  // tchul
  await loginViaUI(page, "tchul-admin");
  await page.waitForSelector(".sidebar .nav-item", { timeout: 15000 });
  await page.locator('.sidebar .nav-item[href="/admin/students"]').click();
  await page.waitForTimeout(1500);
  console.log("tchul:", page.url());
});
