import type { Locator, Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { assertInteractiveSurface } from "../helpers/assertInteractiveSurface";
import { contrast } from "../../src/shared/theme/accent";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

async function expectReadableControl(control: Locator) {
  const colors = await control.evaluate((element) => {
    const toHex = (value: string) => {
      const numbers = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      return "#" + numbers.map((channel) => Math.round(value.startsWith("color(srgb") ? channel * 255 : channel)
        .toString(16).padStart(2, "0")).join("");
    };
    let parent: Element | null = element;
    while (parent && getComputedStyle(parent).backgroundColor === "rgba(0, 0, 0, 0)") parent = parent.parentElement;
    return { text: toHex(getComputedStyle(element).color), background: toHex(getComputedStyle(parent ?? element).backgroundColor) };
  });
  expect.soft(contrast(colors.text, colors.background), JSON.stringify(colors)).toBeGreaterThanOrEqual(4.5);
}

async function expectPortalSurface(page: Page, portal: Locator) {
  const surface = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--color-bg-surface)";
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  expect.soft(await portal.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(surface);
}

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function seedLocalAdmin(page: Page): Promise<Array<Record<string, unknown>>> {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 전용");
  const createdLectures: Array<Record<string, unknown>> = [];

  await page.route("**/api/v1/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/lectures/lectures/" && route.request().method() === "POST") {
      createdLectures.push(route.request().postDataJSON() as Record<string, unknown>);
      return json({ id: 901, ...createdLectures[createdLectures.length - 1] });
    }
    if (path === "/lectures/lectures/") return json({ count: 0, results: [] });
    if (path === "/lectures/lectures/instructor-options/") {
      return json([{ name: "관리자", type: "owner" }]);
    }
    if (path === "/staffs/me/") {
      return json({
        is_authenticated: true,
        is_superuser: true,
        is_staff: true,
        is_payroll_manager: true,
        is_owner: true,
        owner_display_name: "관리자",
      });
    }
    return json({ count: 0, results: [] });
  });

  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  return createdLectures;
}

test.describe("강의 생성 반응형 회귀", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("390px에서 색상·과목·시간 컨트롤이 잘리지 않는다", async ({ page }) => {
    await seedLocalAdmin(page);
    await page.goto(`${BASE}/workspace/lectures`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "강의 추가", exact: true }).click();

    const form = page.locator(".lecture-create-modal-form");
    await expect(form).toBeVisible();
    await assertInteractiveSurface(
      page,
      form,
      page.getByRole("button", { name: "등록", exact: true }),
    );
    const metrics = await form.evaluate((element) => {
      const formRect = element.getBoundingClientRect();
      const controls = Array.from(
        element.querySelectorAll<HTMLElement>(
          ".color-picker-field__swatch, .saved-list-field-icon-btn, .shared-time-range-trigger, .shared-time-range-btn",
        ),
      ).filter((control) => {
        const rect = control.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clippedControls: controls
          .map((control) => {
            const rect = control.getBoundingClientRect();
            return {
              label: control.getAttribute("aria-label") ?? control.textContent?.trim() ?? control.className,
              left: rect.left,
              right: rect.right,
            };
          })
          .filter(({ left, right }) => left < formRect.left - 1 || right > formRect.right + 1),
      };
    });

    expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.clippedControls, JSON.stringify(metrics)).toEqual([]);
    await expect(page.getByRole("button", { name: "등록", exact: true })).toBeVisible();
  });

  for (const theme of ["modern-white", "paper", "focus-dark"] as const) {
    for (const width of [390, 1366]) {
      test(`${width}px ${theme} 강의 생성은 읽을 수 있는 팝업과 일정 검토·취소를 거친 뒤 저장한다`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const createdLectures = await seedLocalAdmin(page);
        await page.addInitScript((style) => {
          localStorage.setItem("hakwonplus:appearance", JSON.stringify({ version: 1, theme: style, accent: "#ffedaa" }));
        }, theme);
        await page.goto(`${BASE}/workspace/lectures`, { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "강의 추가", exact: true }).click();

        const modal = page.getByRole("dialog", { name: "강의 추가" });
        await modal.getByLabel("강의 이름 (필수)").fill("고2 물리 안전확인반");
        await modal.getByLabel("과목 (필수)").fill("물리");
        await modal.locator("button.shared-date-picker-trigger").first().click();
        const datePopover = page.getByRole("dialog", { name: "날짜 선택" });
        await expectPortalSurface(page, datePopover);
        await expectReadableControl(datePopover.locator(".shared-date-picker-title"));
        await datePopover.locator(".shared-date-picker-cell-today").click();
        await modal.locator("button.shared-date-picker-trigger").first().click();
        await expectReadableControl(datePopover.locator(".shared-date-picker-cell-selected"));
        if (theme === "focus-dark" && width === 390) await page.screenshot({ path: info.outputPath("dark-date-popup-390.png") });
        await datePopover.locator(".shared-date-picker-cell-selected").click();

        const timePopover = page.getByRole("dialog", { name: "시간 선택" });
        await modal.getByRole("button", { name: "시작 시간 선택", exact: true }).click();
        await expectPortalSurface(page, timePopover);
        await expectReadableControl(timePopover.getByRole("button", { name: "적용", exact: true }));
        if (theme === "focus-dark" && width === 390) await page.screenshot({ path: info.outputPath("dark-time-popup-390.png") });
        await timePopover.getByLabel("분 단위 직접 입력").fill("16:30");
        await timePopover.getByRole("button", { name: "적용", exact: true }).click();
        await modal.getByRole("button", { name: "종료 시간 선택", exact: true }).click();
        await timePopover.getByLabel("분 단위 직접 입력").fill("17:00");
        await timePopover.getByRole("button", { name: "적용", exact: true }).click();

        await modal.getByRole("button", { name: "등록", exact: true }).click();
        const confirmation = page.getByRole("alertdialog", { name: "강의 생성 최종 확인" });
        await expectReadableControl(confirmation.getByRole("button", { name: "확인하고 만들기" }));
        await expect(confirmation.getByText("고2 물리 안전확인반", { exact: true })).toBeVisible();
        await expect(confirmation.getByText("16:30~17:00", { exact: true })).toBeVisible();
        await expect(confirmation.getByRole("button", { name: "다시 확인" })).toBeFocused();
        expect(await confirmation.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
        expect(createdLectures).toHaveLength(0);
        await confirmation.getByRole("button", { name: "다시 확인" }).click();
        expect(createdLectures).toHaveLength(0);

        await modal.getByRole("button", { name: "등록", exact: true }).click();
        await page.getByRole("alertdialog", { name: "강의 생성 최종 확인" })
          .getByRole("button", { name: "확인하고 만들기" })
          .click();
        await expect.poll(() => createdLectures.length).toBe(1);
      });
    }
  }
});
