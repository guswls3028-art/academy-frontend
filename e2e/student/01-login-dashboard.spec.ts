import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

test.describe("학생 로그인 → 대시보드", () => {
  test("hakwonplus 테넌트 학생이 로그인하면 학생 대시보드가 표시된다", async ({ page }) => {
    await loginViaUI(page, "student");
    expect(page.url()).toContain("/student");

    await expect(page.locator("[data-app='student']")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "하단 메뉴" })).toBeVisible();
    await expect(page.getByText("오늘 할 일").first()).toBeVisible();
    await expect(page.getByText("자주 쓰는 일").first()).toBeVisible();
    await expect(page.locator("text=Not Found")).not.toBeVisible();
  });
});
