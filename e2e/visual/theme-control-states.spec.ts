import { expect, test, type Locator, type Page } from "../fixtures/strictTest";
import { THEMES } from "../../src/shared/theme/themes";

const BASE = process.env.THEME_AUDIT_BASE_URL || "http://127.0.0.1:4173";

type ControlState = {
  background: string;
  borderColor: string;
  borderBottomColor: string;
  borderBottomWidth: string;
  boxShadow: string;
  color: string;
  contrast: number;
  cursor: string;
  opacity: number;
  outlineStyle: string;
  outlineWidth: string;
};

async function readState(locator: Locator): Promise<ControlState> {
  return locator.evaluate((element) => {
    const parseColor = (value: string): [number, number, number, number] | null => {
      const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
      if (value.startsWith("color(srgb") && numbers.length >= 3) {
        return [
          Math.round(numbers[0] * 255),
          Math.round(numbers[1] * 255),
          Math.round(numbers[2] * 255),
          numbers[3] ?? 1,
        ];
      }
      if (value.startsWith("rgb") && numbers.length >= 3) {
        return [numbers[0], numbers[1], numbers[2], numbers[3] ?? 1];
      }
      return null;
    };

    const effectiveBackground = (start: Element): [number, number, number, number] => {
      let current: Element | null = start;
      while (current) {
        const parsed = parseColor(getComputedStyle(current).backgroundColor);
        if (parsed && parsed[3] > 0.01) return parsed;
        current = current.parentElement;
      }
      return [255, 255, 255, 1];
    };

    const luminance = ([red, green, blue]: [number, number, number, number]) => {
      const channels = [red, green, blue].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };

    const style = getComputedStyle(element);
    const foreground = parseColor(style.color) ?? [0, 0, 0, 1];
    const background = effectiveBackground(element);
    const foregroundLuminance = luminance(foreground);
    const backgroundLuminance = luminance(background);
    const contrast =
      (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
      (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);

    return {
      background: style.backgroundColor,
      borderColor: style.borderColor,
      borderBottomColor: style.borderBottomColor,
      borderBottomWidth: style.borderBottomWidth,
      boxShadow: style.boxShadow,
      color: style.color,
      contrast,
      cursor: style.cursor,
      opacity: Number(style.opacity),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
}

function visualSignature(state: ControlState): string {
  return [
    state.background,
    state.borderColor,
    state.color,
    state.boxShadow,
  ].join("|");
}

async function mountAuditSurface(page: Page) {
  await page.evaluate(() => {
    document.querySelector("#theme-control-audit")?.remove();
    const appRoot = document.querySelector<HTMLElement>("#root");
    if (appRoot) appRoot.hidden = true;

    const audit = document.createElement("main");
    audit.id = "theme-control-audit";
    audit.dataset.app = "admin";
    audit.innerHTML = `
      <style>
        #theme-control-audit, #theme-control-audit * { box-sizing: border-box; transition: none !important; }
        #theme-control-audit {
          min-height: 100vh;
          padding: 48px;
          background: var(--layout-page-bg);
          color: var(--color-text-primary);
          font-family: var(--app-font-sans);
        }
        #theme-control-audit .audit-surface {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          max-width: 920px;
          padding: 24px;
          border: 1px solid var(--color-border-divider);
          border-radius: var(--radius-lg);
          background: var(--color-bg-surface);
        }
      </style>
      <section class="audit-surface">
        <button class="ds-button" data-size="md" data-intent="primary" data-testid="primary">주요 작업</button>
        <button class="ds-button" data-size="md" data-intent="secondary" data-testid="secondary">보조 작업</button>
        <button class="ds-button" data-size="md" data-intent="secondary" data-testid="pressed" aria-pressed="true">선택됨</button>
        <button class="ds-button" data-size="md" data-intent="ghost" data-testid="ghost">낮은 강조</button>
        <button class="ds-button" data-size="md" data-intent="danger" data-testid="danger">삭제</button>
        <button class="ds-button" data-size="md" data-intent="secondary" data-testid="disabled" disabled>사용 불가</button>
      </section>
      <div class="domain-header__tabs-wrap">
        <div class="ds-tabs ds-tabs--flat" role="tablist">
          <button class="ds-tab" role="tab" data-testid="tab-default">대기</button>
          <button class="ds-tab is-active" role="tab" data-testid="tab-active" aria-selected="true">진행 중</button>
          <button class="ds-tab" role="tab" data-testid="tab-disabled" disabled>완료</button>
        </div>
      </div>
      <div data-app="auth" data-tenant="hakwonplus" hidden>
        <div data-auth-part="ambient" data-testid="hakwonplus-ambient"><span></span><span></span><span></span></div>
      </div>
      <div data-app="auth" data-tenant="movementhui" hidden>
        <div data-auth-part="ambient" data-testid="movementhui-ambient"><span></span><span></span><span></span></div>
      </div>
    `;
    document.body.append(audit);
  });
}

test("12개 테마에서 공용 버튼과 탭의 상태가 명확히 구분된다", async ({ page }, testInfo) => {
  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode: "tchul",
        display_name: "테마 상태 검사",
        ui_config: { login_title: "테마 상태 검사" },
        feature_flags: {},
        is_active: true,
      }),
    });
  });
  await page.route("**/api/v1/core/landing/has-published/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ has_published: false }),
    });
  });
  await page.goto(`${BASE}/login/tchul`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.styleSheets.length > 0);
  await mountAuditSurface(page);

  const results: Array<Record<string, unknown>> = [];

  for (const theme of THEMES) {
    await page.evaluate((themeKey) => {
      document.documentElement.setAttribute("data-theme", themeKey);
    }, theme.key);

    const primary = page.getByTestId("primary");
    const secondary = page.getByTestId("secondary");
    const pressed = page.getByTestId("pressed");
    const disabled = page.getByTestId("disabled");
    const tabDefault = page.getByTestId("tab-default");
    const tabActive = page.getByTestId("tab-active");

    await page.mouse.move(1, 1);
    const primaryDefault = await readState(primary);
    const secondaryDefault = await readState(secondary);
    const pressedDefault = await readState(pressed);
    const disabledDefault = await readState(disabled);
    const tabDefaultState = await readState(tabDefault);
    const tabActiveState = await readState(tabActive);

    await primary.hover();
    const primaryHover = await readState(primary);
    await secondary.hover();
    const secondaryHover = await readState(secondary);
    await page.mouse.move(1, 1);

    await primary.focus();
    const primaryFocus = await readState(primary);
    await tabDefault.focus();
    const tabFocus = await readState(tabDefault);

    expect.soft(primaryDefault.contrast, `${theme.key}: primary contrast`).toBeGreaterThanOrEqual(4.5);
    expect.soft(secondaryDefault.contrast, `${theme.key}: secondary contrast`).toBeGreaterThanOrEqual(4.5);
    expect.soft(pressedDefault.contrast, `${theme.key}: pressed contrast`).toBeGreaterThanOrEqual(4.5);
    expect.soft(tabActiveState.contrast, `${theme.key}: active tab contrast`).toBeGreaterThanOrEqual(4.5);
    expect.soft(visualSignature(primaryHover), `${theme.key}: primary hover`).not.toBe(visualSignature(primaryDefault));
    expect.soft(visualSignature(secondaryHover), `${theme.key}: secondary hover`).not.toBe(visualSignature(secondaryDefault));
    expect.soft(visualSignature(pressedDefault), `${theme.key}: pressed state`).not.toBe(visualSignature(secondaryDefault));
    expect.soft(tabActiveState.borderBottomWidth, `${theme.key}: active tab underline`).not.toBe("0px");
    expect.soft(tabActiveState.borderBottomColor, `${theme.key}: active tab color`).not.toBe(tabDefaultState.borderBottomColor);
    expect.soft(primaryFocus.boxShadow, `${theme.key}: button focus ring`).not.toBe("none");
    expect.soft(tabFocus.outlineStyle, `${theme.key}: tab focus ring`).not.toBe("none");
    expect.soft(tabFocus.outlineWidth, `${theme.key}: tab focus width`).not.toBe("0px");
    expect.soft(disabledDefault.opacity, `${theme.key}: disabled opacity`).toBeGreaterThanOrEqual(0.5);
    expect.soft(disabledDefault.opacity, `${theme.key}: disabled opacity`).toBeLessThan(0.8);
    expect.soft(disabledDefault.cursor, `${theme.key}: disabled cursor`).toBe("not-allowed");

    results.push({
      theme: theme.key,
      primaryContrast: primaryDefault.contrast,
      secondaryContrast: secondaryDefault.contrast,
      pressedContrast: pressedDefault.contrast,
      activeTabContrast: tabActiveState.contrast,
    });
  }

  const ambientDisplays = await page.evaluate(() => ({
    hakwonplus: Array.from(document.querySelectorAll("[data-testid='hakwonplus-ambient'] > span"))
      .map((element) => getComputedStyle(element).display),
    movementhui: Array.from(document.querySelectorAll("[data-testid='movementhui-ambient'] > span"))
      .map((element) => getComputedStyle(element).display),
  }));
  expect(ambientDisplays.hakwonplus).toEqual(["none", "none", "none"]);
  expect(ambientDisplays.movementhui[2]).toBe("none");

  await testInfo.attach("theme-control-contrast.json", {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
});
