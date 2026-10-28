import type { Page } from "@playwright/test";

import { expect } from "../fixtures/strictTest";

export async function confirmStudentLogout(page: Page): Promise<void> {
  const confirmation = page.getByRole("alertdialog", { name: "로그아웃", exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "로그아웃", exact: true }).click();
}
