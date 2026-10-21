import { expect, type Page } from "@playwright/test";
import { assertInteractiveSurface } from "./assertInteractiveSurface";

/** Read-only journey, shared by mock, isolated real-use and production canaries. */
export async function verifyStudentLearningSummary(page: Page, baseUrl: string): Promise<void> {
  const dashboard = new URL("/student/dashboard", baseUrl).href;
  await page.goto(dashboard, { waitUntil: "domcontentloaded" });
  const card = page.getByRole("region", { name: "학습 현황", exact: true });
  await expect(card).toBeVisible();
  await expect(card).not.toContainText(/확인 중|확인 필요/);
  await expect(card.getByRole("alert")).toHaveCount(0);
  for (const [index, path] of ["/student/sessions", "/student/grades?view=homework", "/student/grades"].entries()) {
    const action = card.locator(`a[href="${path}"]`);
    await assertInteractiveSurface(page, card, action);
    if (index === 0) {
      await action.focus();
      await page.keyboard.press("Enter");
    } else {
      await action.click();
    }
    const url = new URL(path, baseUrl).href;
    await expect(page).toHaveURL(url);
    const ready = index === 0
      ? page.getByRole("button", { name: "내 일정", exact: true })
      : page.getByRole("button", { name: index === 1 ? /^과제 현황/ : /^시험 성적/ });
    await expect(ready).toBeVisible();
    if (index > 0) await expect(ready).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(ready).toBeVisible();
    if (index > 0) await expect(ready).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    await expect(page).toHaveURL(dashboard);
    await expect(card).toBeVisible();
    await expect(card).not.toContainText(/확인 중|확인 필요/);
  }
}
