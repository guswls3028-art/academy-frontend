import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { getBaseUrl, hasRoleCredentials, loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = getBaseUrl("admin");

async function openHelpAndAssert(
  page: Page,
  buttonName: string,
  dialogName: string,
  expectedText: string,
): Promise<void> {
  const button = page.getByRole("button", { name: buttonName }).first();
  await expect(button).toBeVisible({ timeout: 10_000 });
  await button.click();

  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await expect(dialog).toContainText(expectedText);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden({ timeout: 3_000 });
}

test.describe("컨텍스트 도움말 UI", () => {
  test.skip(
    !hasRoleCredentials("admin") || !hasRoleCredentials("student"),
    "Tenant 1 admin/student E2E credentials are required",
  );

  test("관리자 대시보드 안내 문구는 ? 도움말로 열린다", async ({ page }) => {
    await loginViaUI(page, "admin", { landingPath: "/admin/dashboard" });
    await gotoAndSettle(page, `${BASE}/admin/dashboard`, { settleMs: 500 });

    await expect(page.locator(".domain-layout__description").filter({
      hasText: "학원 운영 현황을 한눈에 확인하세요.",
    })).toHaveCount(0);
    await openHelpAndAssert(
      page,
      "대시보드 도움말",
      "대시보드 안내",
      "학원 운영 현황을 한눈에 확인하세요.",
    );

    await expect(page.locator(".ds-section__description").filter({
      hasText: "아래 항목은 학생/학부모가 기다리고 있습니다.",
    })).toHaveCount(0);
    await openHelpAndAssert(
      page,
      "오늘 처리할 일 도움말",
      "오늘 처리할 일 안내",
      "아래 항목은 학생/학부모가 기다리고 있습니다.",
    );
  });

  test("학생 제출 화면 안내 문구는 ? 도움말로 열린다", async ({ page }) => {
    await loginViaUI(page, "student", { landingPath: "/student/submit" });
    await gotoAndSettle(page, `${BASE}/student/submit`, { settleMs: 500 });

    await expect(page.locator(".student-page-shell__description").filter({
      hasText: "성적표 또는 과제",
    })).toHaveCount(0);
    await openHelpAndAssert(
      page,
      "제출 도움말",
      "제출 안내",
      "성적표 또는 과제",
    );
  });
});
