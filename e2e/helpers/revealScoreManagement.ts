import type { Page } from "@playwright/test";

export async function revealScoreManagement(page: Page): Promise<void> {
  if (!new URL(page.url()).pathname.replace(/\/$/, "").endsWith("/scores")) return;
  if (!await page.evaluate(() => matchMedia("(max-width: 1023px)").matches)) return;
  const workspace = page.locator(".scores-entry-page");
  await workspace.waitFor({ state: "visible" });
  await workspace.getByText("성적 불러오는 중…", { exact: true }).waitFor({ state: "hidden" });
  const collapsed = page.locator(".scores-management:not([open]) > summary")
    .filter({ hasText: "차시·성적 작업" });
  if (await collapsed.isVisible()) await collapsed.click();
}
