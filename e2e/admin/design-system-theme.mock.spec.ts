import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { THEMES } from "../../src/shared/theme/themes";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const STORAGE_KEY = "hakwonplus:theme";

async function openAppearance(page: Page) {
  await page.goto(`${BASE}/workspace/settings/appearance`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".theme-card")).toHaveCount(THEMES.length);
}

function themeCard(page: Page, key: string) {
  return page.locator(`.theme-card:has(.theme-preview[data-theme="${key}"])`);
}

async function palettes(page: Page) {
  return page.evaluate(() => {
    function color(parent: Element, token: string) {
      const sample = document.createElement("span");
      sample.style.backgroundColor = `var(${token})`;
      parent.append(sample);
      const result = getComputedStyle(sample).backgroundColor;
      sample.remove();
      return result;
    }
    const tokens = [
      ["--color-brand-primary", "--pv-primary"],
      ["--sidebar-bg", "--pv-sidebar-bg"],
      ["--layout-page-bg", "--pv-page"],
      ["--layout-header-bg", "--pv-header"],
      ["--color-bg-surface", "--pv-panel"],
      ["--color-border-divider", "--pv-border"],
    ];
    return {
      actual: tokens.map(([token]) => color(document.documentElement, token)),
      previews: Object.fromEntries(
        [...document.querySelectorAll<HTMLElement>(".theme-preview")].map((preview) => [
          preview.dataset.theme,
          tokens.map(([, token]) => color(preview, token)),
        ]),
      ),
    };
  });
}

test.beforeEach(async ({ page }) => {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "격리된 로컬 테마 검증 전용");
  await installTenantOneInitScript(page);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const jwt = `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12,
  })}.sig`;
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", token);
  }, jwt);
  await page.route("**/api/v1/**", (route) => route.fulfill({
    status: 200, json: { count: 0, results: [] },
  }));
  await installLocalAuthApiStubs(page);
});

test("12개 미리보기는 상위 테마와 무관하며 실제 적용 팔레트와 일치한다", async ({ page }) => {
  await openAppearance(page);
  await themeCard(page, "modern-white").click();
  const initial = await palettes(page);
  for (const theme of THEMES) {
    const card = themeCard(page, theme.key);
    await card.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme.key);
    await expect(card).toHaveAttribute("aria-pressed", "true");
    const current = await palettes(page);
    expect(current.previews, `${theme.key}: nested preview isolation`).toEqual(initial.previews);
    expect(current.previews[theme.key], `${theme.key}: applied palette`).toEqual(current.actual);
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(theme.key);
  }

  await themeCard(page, "modern-dark").click();
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(["--color-primary-rgb", "--elevation-1", "--ui-hero-bg", "--ui-hero-border"]
      .map((token) => [token, style.getPropertyValue(token).trim()]));
  });
  expect(tokens["--color-primary-rgb"]).toBe("96, 165, 250");
  expect(tokens["--elevation-1"]).toContain("0.24");
  expect(tokens["--ui-hero-bg"]).not.toBe("");
  expect(tokens["--ui-hero-border"]).not.toBe("");
});

for (const width of [1100, 1366, 390]) {
  test(`${width}px에서 전체 이름·키보드 선택·저장 복원을 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openAppearance(page);
    const geometry = await page.locator(".theme-card__name").evaluateAll((names) => names.map((name) => {
      const bounds = name.getBoundingClientRect();
      return { text: name.textContent, fits: name.scrollWidth <= name.clientWidth, left: bounds.left, right: bounds.right };
    }));
    for (const name of geometry) {
      expect(name.fits, name.text ?? "theme name").toBe(true);
      expect(name.left).toBeGreaterThanOrEqual(0);
      expect(name.right).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 390) {
      const boxes = await page.locator(".theme-card").evaluateAll((cards) => cards.slice(0, 3).map((card) => {
        const box = card.getBoundingClientRect();
        return { x: box.x, y: box.y };
      }));
      expect(boxes[0].y).toBe(boxes[1].y);
      expect(boxes[0].x).toBe(boxes[2].x);
      expect(boxes[2].y).toBeGreaterThan(boxes[0].y);
    }

    const dark = themeCard(page, "modern-dark");
    await dark.focus();
    await page.keyboard.press("Enter");
    await expect(dark).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "modern-dark");
    await page.reload();
    await expect(dark).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "modern-dark");
    await expect(page.locator('.theme-card[aria-pressed="true"]')).toHaveCount(1);

    await page.emulateMedia({ reducedMotion: "reduce" });
    const light = themeCard(page, "navy-pro");
    await light.focus();
    await page.keyboard.press("Space");
    await expect(light).toHaveAttribute("aria-pressed", "true");
    const durations = await light.evaluate((button) => getComputedStyle(button).transitionDuration);
    expect(durations.split(",").every((duration) => parseFloat(duration) <= 0.001)).toBe(true);
    await page.reload();
    await expect(light).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "navy-pro");
  });
}

for (const [saved, expected] of [
  ["ivory-office", "mocha-office"],
  ["youtube-studio", "graphite-studio"],
  ["terminal-neon", "deep-ocean"],
]) {
  test(`기존 ${saved} 선택을 ${expected}로 복원한다`, async ({ page }) => {
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: saved });
    await openAppearance(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", expected);
    await expect(themeCard(page, expected)).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(expected);
  });
}
