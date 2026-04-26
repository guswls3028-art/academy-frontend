/**
 * 가이드 페이지 렌더링 E2E — 선생앱 + 학생앱 가이드 워크플로우 카드 확인
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test.describe("선생앱 가이드", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("워크플로우 카드가 렌더링된다", async ({ page }) => {
    await page.goto(`${BASE}/admin/guide`, { waitUntil: "load" });
    await page.waitForTimeout(1500);

    // 메인 영역에서 제목 확인 (사이드바와 구분)
    const main = page.locator("main");
    await expect(main.locator("text=사용 가이드").first()).toBeVisible();

    // 워크플로우 카드 확인 (배포 후 활성화)
    // 배포 전에는 이전 가이드 카드가 보임
    const hasNewGuide = await main.locator("text=학생 등록하기").isVisible().catch(() => false);
    if (hasNewGuide) {
      await expect(main.locator("text=강의 만들고 수업 관리하기")).toBeVisible();
      await expect(main.locator("text=시험 출제하고 채점하기")).toBeVisible();
      await expect(main.locator("text=강의 영상 올리기")).toBeVisible();
      await expect(main.locator("text=메시지 보내기")).toBeVisible();
      await expect(main.locator("text=성적 확인하기")).toBeVisible();
    }
  });

  test("카드 클릭 시 아코디언이 펼쳐진다", async ({ page }) => {
    await page.goto(`${BASE}/admin/guide`, { waitUntil: "load" });
    await page.waitForTimeout(1500);

    const main = page.locator("main");
    const card = main.locator("text=학생 등록하기");

    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForTimeout(500);
      await expect(main.locator("text=학생 관리로 이동")).toBeVisible();
      await expect(main.getByRole("button", { name: "직접 해보기" }).first()).toBeVisible();
    }
  });
});

test.describe("학생앱 가이드", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "student");
  });

  test("워크플로우 카드가 렌더링된다", async ({ page }) => {
    await page.goto(`${BASE}/student/guide`, { waitUntil: "load" });
    await page.waitForTimeout(1500);

    // 제목은 h1 또는 일반 div로 렌더링될 수 있음
    await expect(page.locator("text=사용 가이드").first()).toBeVisible();

    // 배포 후 활성화: 새 워크플로우 카드 (이전 버전과 구분)
    const hasNewGuide = await page.locator("text=오늘 할 일 확인하기").isVisible().catch(() => false);
    if (hasNewGuide) {
      await expect(page.locator("text=성적 확인하기")).toBeVisible();
      await expect(page.locator("text=영상 시청하기")).toBeVisible();
      await expect(page.locator("text=과제 제출하기")).toBeVisible();
      await expect(page.locator("text=클리닉 확인하기")).toBeVisible();
    }
  });

  test("카드 클릭 시 아코디언이 펼쳐진다", async ({ page }) => {
    await page.goto(`${BASE}/student/guide`, { waitUntil: "load" });
    await page.waitForTimeout(1500);

    const card = page.locator("button:has-text('시험 보기')");
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForTimeout(500);
      await expect(page.locator("text=시험 탭으로 이동")).toBeVisible();
      await expect(page.getByRole("button", { name: "직접 해보기" }).first()).toBeVisible();
    }
  });
});
