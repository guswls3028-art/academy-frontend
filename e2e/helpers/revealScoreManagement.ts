import type { Page } from "@playwright/test";

export async function revealScoreManagement(page: Page): Promise<void> {
  const collapsed = page.locator(".scores-management:not([open]) > summary")
    .filter({ hasText: "차시·성적 작업" });
  if (await collapsed.isVisible()) await collapsed.click();
}
