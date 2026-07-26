import { expect, test } from "../fixtures/strictTest";
import { hasRoleCredentials, loginViaUI } from "../helpers/auth";

test.describe("관리자 운영 대시보드", () => {
  test.skip(!hasRoleCredentials("admin"), "Tenant 1 admin E2E credentials are required");

  test("오늘 현황과 우선 업무를 시각적으로 구분하고 모바일에서도 넘치지 않는다", async ({ page }) => {
    await loginViaUI(page, "admin", { landingPath: "/admin/dashboard" });

    await expect(page.getByRole("heading", { name: "오늘 학원 운영" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "오늘 처리할 일" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "기록이 이어지는 순서" })).toBeVisible();
    const messagingCard = page.locator("section[data-status]", {
      has: page.getByText("알림톡 상태", { exact: true }),
    });
    await expect(messagingCard).toHaveAttribute("data-status", /ready|disconnected/);
    await expect(
      page.getByRole("heading", { name: /알림톡 안내 준비|발송 준비를 확인해 주세요/ }),
    ).toBeVisible();

    for (const label of ["운영 강의", "운영 중 시험", "오늘 학생 제출", "미답변 질문"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    for (const action of ["답변하기", "채점하기", "관리하기", "설정 열기"]) {
      await expect(page.getByText(action, { exact: true }).first()).toBeVisible();
    }

    await expect.poll(
      () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "오늘 학원 운영" })).toBeVisible();
    await expect.poll(
      () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test("알림톡 상태 조회 실패를 준비 완료로 표시하지 않는다", async ({ page }) => {
    await page.route("**/messaging/info/**", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "temporary unavailable" }),
      });
    });

    await loginViaUI(page, "admin", { landingPath: "/admin/dashboard" });

    const messagingCard = page.locator('section[data-status="error"]');
    await expect(messagingCard).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "알림톡 상태를 확인하지 못했습니다" }),
    ).toBeVisible();
    await expect(page.getByText("알림톡 안내 준비", { exact: true })).toHaveCount(0);
  });
});
