import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { THEMES } from "../../src/shared/theme/themes";
import { accentVariables, contrast } from "../../src/shared/theme/accent";
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

test("세 가지 미리보기는 상위 테마와 무관하며 실제 적용 팔레트와 일치한다", async ({ page }) => {
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
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(theme.key === "focus-dark" ? "modern-dark" : theme.key === "paper" ? "minimal-mono" : "modern-white");
  }

  await themeCard(page, "focus-dark").click();
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(["--color-primary-rgb", "--elevation-1", "--ui-hero-bg", "--ui-hero-border"]
      .map((token) => [token, style.getPropertyValue(token).trim()]));
  });
  expect(tokens["--color-primary-rgb"]).toMatch(/^\d+, \d+, \d+$/);
  expect(tokens["--elevation-1"]).toBe("none");
  expect(tokens["--ui-hero-bg"]).not.toBe("");
  expect(tokens["--ui-hero-border"]).not.toBe("");
});

for (const width of [1100, 1366, 390]) {
  test(`${width}px에서 전체 이름·키보드 선택·저장 복원을 유지한다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await openAppearance(page);
    await page.screenshot({ path: info.outputPath("appearance-" + width + ".png"), fullPage: true });
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
      expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
      expect(boxes[0].x).toBe(boxes[2].x);
      expect(boxes[2].y).toBeGreaterThan(boxes[0].y);
    }

    const dark = themeCard(page, "focus-dark");
    await dark.focus();
    await page.keyboard.press("Enter");
    await expect(dark).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "focus-dark");
    await page.reload();
    await expect(dark).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "focus-dark");
    await expect(page.locator('.theme-card[aria-pressed="true"]')).toHaveCount(1);

    await page.emulateMedia({ reducedMotion: "reduce" });
    const light = themeCard(page, "modern-white");
    await light.focus();
    await page.keyboard.press("Space");
    await expect(light).toHaveAttribute("aria-pressed", "true");
    const durations = await light.evaluate((button) => getComputedStyle(button).transitionDuration);
    expect(durations.split(",").every((duration) => parseFloat(duration) <= 0.001)).toBe(true);
    await page.reload();
    await expect(light).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "modern-white");
  });
}

for (const [saved, expected] of [
  ["modern-white", "modern-white"], ["navy-pro", "modern-white"],
  ["mocha-office", "paper"], ["minimal-mono", "paper"],
  ["modern-dark", "focus-dark"], ["dark-navy", "focus-dark"],
  ["graphite-studio", "focus-dark"], ["deep-ocean", "focus-dark"],
  ["kakao-business", "modern-white"], ["naver-works", "modern-white"],
  ["samsung-admin", "modern-white"], ["purple-insight", "modern-white"],
  ["ivory-office", "paper"], ["youtube-studio", "focus-dark"], ["terminal-neon", "focus-dark"],
]) {
  test(`기존 ${saved} 선택을 ${expected}로 복원한다`, async ({ page }) => {
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: saved });
    await openAppearance(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", expected);
    await expect(themeCard(page, expected)).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(expected === "focus-dark" ? "modern-dark" : expected === "paper" ? "minimal-mono" : "modern-white");
  });
}
test("강조색 입력·오류·재방문 복원과 기본값 복구", async ({ page }, info) => {
  await openAppearance(page);
  const code = page.getByLabel("색상 코드", { exact: true });
  await code.fill("invalid");
  await page.getByRole("button", { name: "색상 적용", exact: true }).click();
  await expect(code).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").filter({ hasText: "여섯 자리" })).toBeVisible();
  await code.fill("#ffff00");
  await code.press("Enter");
  await expect(code).toHaveAttribute("aria-invalid", "false");
  for (const theme of THEMES) {
    await themeCard(page, theme.key).click();
    const vars = accentVariables(theme.key, "#ffff00");
    expect(contrast(vars["--scale-Primary500"], vars["--color-brand-primary-contrast"])).toBeGreaterThanOrEqual(4.5);
    const actual = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--scale-Primary500").trim());
    expect(actual).toBe(vars["--scale-Primary500"]);
    await page.screenshot({ path: info.outputPath(theme.key + "-custom.png"), fullPage: true });
  }
  await page.reload();
  await expect(code).toHaveValue("#ffff00");
  await expect(themeCard(page, "focus-dark")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "기본값으로 되돌리기", exact: true }).click();
  await expect(code).toHaveValue("#2563eb");
  await page.reload();
  await expect(themeCard(page, "modern-white")).toHaveAttribute("aria-pressed", "true");
  await expect(code).toHaveValue("#2563eb");
});

test("저장 차단 시 현재 적용·안내·재시도가 작동한다", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key: string, value: string) {
      if (key === "hakwonplus:appearance" && !sessionStorage.getItem("qa-allow-appearance")) {
        throw new DOMException("Blocked", "SecurityError");
      }
      return original.call(this, key, value);
    };
  });
  await openAppearance(page);
  await themeCard(page, "paper").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await expect(page.getByRole("status").filter({ hasText: "저장하지 못했습니다" })).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem("qa-allow-appearance", "true"));
  await page.getByRole("button", { name: "저장 다시 시도" }).click();
  await expect(page.getByRole("button", { name: "저장 다시 시도" })).toHaveCount(0);
  await page.reload();
  await expect(themeCard(page, "paper")).toHaveAttribute("aria-pressed", "true");
});

for (const corrupt of ["toString", "__proto__", "not-a-theme"]) {
  test("손상된 취향은 안전하게 기본값으로 진입한다: " + corrupt, async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem("hakwonplus:theme", value);
      localStorage.setItem("hakwonplus:appearance", "{broken");
    }, corrupt);
    await openAppearance(page);
    await expect(themeCard(page, "modern-white")).toHaveAttribute("aria-pressed", "true");
  });
}

for (const width of [390, 1366]) {
  test("선생앱 " + width + "px에서 동일 설정과 익숙한 경로를 유지한다", async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/core/me/", (route) => route.fulfill({ json: {
      id: 12, username: "qa-teacher", name: "예시 선생님", is_staff: true, is_superuser: false,
      tenantRole: "teacher", must_change_password: false, first_login_guide_required: false,
    } }));
    await page.goto(BASE + "/workspace/mobile/settings/appearance");
    await expect(page.locator(".theme-card")).toHaveCount(3);
    await themeCard(page, "focus-dark").click();
    await page.getByLabel("색상 코드", { exact: true }).fill("#ffedaa");
    await page.getByRole("button", { name: "색상 적용", exact: true }).click();
    await page.reload();
    await expect(page.getByLabel("색상 코드", { exact: true })).toHaveValue("#ffedaa");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "focus-dark");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath("teacher-appearance-" + width + ".png"), fullPage: true });
    for (const description of await page.locator(".theme-card").evaluateAll((cards) => cards.map((card) =>
      [...card.querySelectorAll("span")].every((span) => span.scrollWidth <= span.clientWidth + 1)))) {
      expect(description).toBe(true);
    }
  });
}
