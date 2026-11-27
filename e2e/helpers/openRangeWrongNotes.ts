import { expect, type Page } from "@playwright/test";
import { revealScoreManagement } from "./revealScoreManagement";

/** A populated session puts its score tools inside the mobile task disclosure. */
export async function openRangeWrongNotes(page: Page, width: 390 | 1366) {
  if (width === 390) {
    await expect(page.locator(".scores-management > summary", { hasText: "차시·성적 작업" })).toBeVisible();
    await revealScoreManagement(page);
  }
  await page.getByRole("button", { name: "성적 도구", exact: true }).click();
  await page.getByRole("menuitem", { name: /차시별 오답노트/ }).click();
  const dialog = page.getByRole("dialog", { name: "차시별 오답노트", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
