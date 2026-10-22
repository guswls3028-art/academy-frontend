import type { Page } from "@playwright/test";

import { expect } from "../fixtures/strictTest";

/** Select exact named rows even when multi-field search returns other students. */
export async function openTeacherAlimtalkComposer(page: Page, studentNames: string[]) {
  expect(studentNames.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "선택", exact: true }).click();
  await expect(page.getByRole("button", { name: "선택 취소", exact: true })).toBeVisible();
  for (const name of studentNames) {
    const row = page.getByRole("button").filter({ has: page.getByText(name, { exact: true }) });
    await expect(row).toHaveCount(1);
    await row.click();
  }
  await page.getByRole("button", { name: "알림톡", exact: true }).click();
  const compose = page.getByRole("dialog", { name: `${studentNames.length}명에게 알림톡`, exact: true });
  await expect(compose).toBeVisible();
  return compose;
}
