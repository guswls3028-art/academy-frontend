import { expect, type Locator, type Page } from "@playwright/test";

export async function assertInteractiveSurface(
  page: Page,
  surface: Locator,
  primaryAction: Locator,
): Promise<void> {
  await expect(surface).toBeVisible();
  await expect(primaryAction).toBeVisible();

  const metrics = await surface.evaluate((element) => {
    const surfaceRect = element.getBoundingClientRect();
    const controls = Array.from(element.querySelectorAll<HTMLElement>(
      "button, input, select, textarea, a[href], [role='button']",
    )).filter((control) => {
      const style = getComputedStyle(control);
      const rect = control.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });

    return {
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      surfaceOverflow: element.scrollWidth - element.clientWidth,
      surfaceOutsideViewport: {
        left: Math.max(0, -surfaceRect.left),
        right: Math.max(0, surfaceRect.right - window.innerWidth),
      },
      clippedControls: controls.flatMap((control) => {
        const rect = control.getBoundingClientRect();
        const clipped = rect.left < Math.max(0, surfaceRect.left) - 1
          || rect.right > Math.min(window.innerWidth, surfaceRect.right) + 1;
        return clipped
          ? [{
              label: control.getAttribute("aria-label") ?? control.textContent?.trim() ?? control.tagName,
              left: rect.left,
              right: rect.right,
            }]
          : [];
      }),
      focusableCount: controls.filter((control) => (
        !control.hasAttribute("disabled") && control.getAttribute("aria-disabled") !== "true"
      )).length,
    };
  });

  expect(metrics.documentOverflow, JSON.stringify(metrics)).toBeLessThanOrEqual(1);
  expect(metrics.surfaceOverflow, JSON.stringify(metrics)).toBeLessThanOrEqual(1);
  expect(metrics.surfaceOutsideViewport, JSON.stringify(metrics)).toEqual({ left: 0, right: 0 });
  expect(metrics.clippedControls, JSON.stringify(metrics)).toEqual([]);
  expect(metrics.focusableCount, JSON.stringify(metrics)).toBeGreaterThan(0);

  const actionBox = await primaryAction.boundingBox();
  expect(actionBox, "primary action must have a layout box").not.toBeNull();
  expect(actionBox!.x).toBeGreaterThanOrEqual(-1);
  expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(
    (await page.evaluate(() => window.innerWidth)) + 1,
  );
  const focusTarget = surface.locator(
    "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href]",
  ).first();
  await expect(focusTarget).toBeVisible();
  await focusTarget.focus();
  await expect(focusTarget).toBeFocused();
}
