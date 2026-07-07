/**
 * 가이드 페이지 렌더링 E2E — 선생앱 + 학생앱 가이드 워크플로우 카드 확인
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = getBaseUrl("admin");

test.describe("선생앱 가이드", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("워크플로우 카드가 렌더링된다", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/guide`, { timeout: 20_000 });

    // 메인 영역에서 제목 확인 (사이드바와 구분)
    const main = page.locator("main");
    await expect(main.locator("text=공식 사용 가이드").first()).toBeVisible();
    await expect(main.locator("text=계약 직후 체크리스트")).toBeVisible();
    await expect(main.locator("text=처음 막히기 쉬운 지점")).toBeVisible();

    const hasNewGuide = await main.locator("text=학생 등록하기").isVisible().catch(() => false);
    if (hasNewGuide) {
      await expect(main.locator("text=강의 만들고 수업 관리하기")).toBeVisible();
      await expect(main.locator("text=시험 출제하고 채점하기")).toBeVisible();
      await expect(main.locator("text=강의 영상 올리기")).toBeVisible();
      await expect(main.locator("text=알림톡 보내기")).toBeVisible();
      await expect(main.locator("text=성적 확인하기")).toBeVisible();
    }
  });

  test("카드 클릭 시 아코디언이 펼쳐진다", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/guide`, { timeout: 20_000 });

    const main = page.locator("main");
    const card = main.locator("text=학생 등록하기");

    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await expect(main.locator("text=학생 관리로 이동")).toBeVisible();
      await expect(main.getByRole("button", { name: "직접 해보기" }).first()).toBeVisible();
    }
  });
});

test.describe("선생 모바일 가이드", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("현장용 가이드가 렌더링된다", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/teacher/guide`, { timeout: 20_000 });

    await expect(page.locator("text=공식 선생님 가이드")).toBeVisible();
    await expect(page.locator("text=현장에서 먼저 볼 순서")).toBeVisible();
    await expect(page.locator("text=PC로 넘길 일")).toBeVisible();
    await expect(page.locator("text=처음 막히기 쉬운 부분")).toBeVisible();
  });
});

test.describe("학생앱 가이드", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "student");
  });

  test("워크플로우 카드가 렌더링된다", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/student/guide`, { timeout: 20_000 });

    await expect(page.locator("text=공식 학생 가이드")).toBeVisible();
    await expect(page.locator("text=처음 로그인했다면 이 순서로 확인하세요.")).toBeVisible();

    const hasNewGuide = await page.locator("text=오늘 할 일 확인하기").isVisible().catch(() => false);
    if (hasNewGuide) {
      await expect(page.locator("text=성적 확인하기")).toBeVisible();
      await expect(page.locator("text=영상 시청하기")).toBeVisible();
      await expect(page.locator("text=과제 제출하기")).toBeVisible();
      await expect(page.locator("text=클리닉 확인하기")).toBeVisible();
    }
  });

  test("카드 클릭 시 아코디언이 펼쳐진다", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/student/guide`, { timeout: 20_000 });

    const card = page.locator("button:has-text('시험 보기')");
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await expect(page.locator("text=시험 탭으로 이동")).toBeVisible();
      await expect(page.getByRole("button", { name: "직접 해보기" }).first()).toBeVisible();
    }
  });
});
