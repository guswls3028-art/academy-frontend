import { expect, type Page } from "@playwright/test";

export async function acknowledgeFirstLoginGuideIfVisible(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "계정 안내" });
  if (!await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) return;

  await dialog.getByRole("button", { name: "확인", exact: true }).click();
  await expect(dialog).toBeHidden();
}
