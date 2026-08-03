import { expect, test } from "../fixtures/strictTest";
import { getBaseUrl, loginViaUI } from "../helpers/auth";

test("community list cards stay readable in the compact admin layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const base = getBaseUrl("admin").replace(/\/+$/, "");
  await loginViaUI(page, "admin", { landingPath: "/workspace/community/notice" });
  await page.goto(`${base}/workspace/community/notice`, { waitUntil: "domcontentloaded" });

  const card = page.locator(".cms-list-card").first();
  await expect(card).toBeVisible();
  await expect.poll(() => card.evaluate((element) => element.clientHeight)).toBeGreaterThan(40);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test("community desktop panes stay bounded to the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const base = getBaseUrl("admin").replace(/\/+$/, "");
  await loginViaUI(page, "admin", { landingPath: "/workspace/community/notice" });
  await page.goto(`${base}/workspace/community/notice`, { waitUntil: "domcontentloaded" });

  const tree = page.locator(".notice-tree--viewport");
  await expect(tree).toBeVisible();
  await expect.poll(() => tree.evaluate((element) => element.clientHeight)).toBeLessThanOrEqual(550);
  await expect(page.locator(".notice-tree > .qna-inbox__list .qna-inbox__list-body")).toHaveCSS("overflow-y", "auto");
});
