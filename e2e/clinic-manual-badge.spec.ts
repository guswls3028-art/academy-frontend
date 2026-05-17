import { test, expect } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "./helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "./helpers/localAuthApiStubs";

const TS = Date.now();

test.describe("클리닉 대상자 — 수동 지정 음영(딱지 제거)", () => {
  test("single column: 수동 텍스트 딱지 없음 + 옅은 음영만", async ({ page }) => {
    await installLocalAuthApiStubs(page);
    await installTenantOneInitScript(page);
    await loginViaUI(page, "admin");
    await page.goto(`${getBaseUrl("admin")}/admin/tools/clinic`, { waitUntil: "load" });

    await page.locator("#clinic-paste-ta").fill(
      `시험: [E2E-${TS}]김철수, [E2E-${TS}]이영희\n과제: [E2E-${TS}]박민수`,
    );
    await page.getByRole("button", { name: "생성", exact: true }).click();

    // 수동 대상 추가: examOnly(시험) 카테고리에 한 명
    await page.getByRole("button", { name: "시험", exact: true }).first().click();
    await page.getByPlaceholder("학생 이름").first().fill(`[E2E-${TS}]정한길`);
    await page.getByRole("button", { name: "수동 대상 추가" }).click();

    const frame = page.frameLocator("#cprev");
    await expect(frame.locator(".manual-name")).toHaveCount(1, { timeout: 8000 });

    // 1) 텍스트 딱지(.manual-mark) 완전 부재
    await expect(frame.locator(".manual-mark")).toHaveCount(0);
    await expect(frame.locator(".columns")).not.toContainText("수동");

    // 2) 수동 행은 옅은 음영만 (background 톤 차이)
    const bg = await frame.locator(".manual-name").first().evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    const shadow = await frame.locator(".manual-name").first().evaluate(
      (el) => getComputedStyle(el).boxShadow,
    );
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("transparent");
    // 스타크한 #111 3px 막대가 아니라 옅은 accent
    expect(shadow).not.toContain("rgb(17, 17, 17)");

    // tip-box / footer 에 "수동" 노출 안 됨
    await expect(frame.locator(".tip-box")).not.toContainText("수동");
    await expect(frame.locator(".footer")).not.toContainText("수동");

    await frame.locator(".page").screenshot({ path: `e2e-out/clinic-manual-single-${TS}.png` });
  });

  test("2-column(>15): 딱지 제거로 줄바꿈 깨짐 없음", async ({ page }) => {
    await installLocalAuthApiStubs(page);
    await installTenantOneInitScript(page);
    await loginViaUI(page, "admin");
    await page.goto(`${getBaseUrl("admin")}/admin/tools/clinic`, { waitUntil: "load" });

    const many = Array.from({ length: 22 }, (_, i) => `[E2E-${TS}]학생${String(i + 1).padStart(2, "0")}`).join(", ");
    await page.locator("#clinic-paste-ta").fill(`시험: ${many}`);
    await page.getByRole("button", { name: "생성", exact: true }).click();

    await page.getByRole("button", { name: "시험", exact: true }).first().click();
    await page.getByPlaceholder("학생 이름").first().fill(`[E2E-${TS}]추가학생`);
    await page.getByRole("button", { name: "수동 대상 추가" }).click();

    const frame = page.frameLocator("#cprev");
    // 2-column 경로: .name-cell 사용
    await expect(frame.locator(".name-cell").first()).toBeVisible({ timeout: 8000 });
    await expect(frame.locator(".manual-mark")).toHaveCount(0);
    await expect(frame.locator(".manual-name")).toHaveCount(1);

    // 수동 셀이 단일 행 높이를 유지 (딱지로 인한 2줄 wrap 없음)
    const cellH = await frame.locator(".manual-name").first().evaluate((el) => el.clientHeight);
    const normH = await frame.locator(".name-cell:not(.manual-name)").first().evaluate((el) => el.clientHeight);
    expect(Math.abs(cellH - normH)).toBeLessThanOrEqual(2);

    await frame.locator(".page").screenshot({ path: `e2e-out/clinic-manual-2col-${TS}.png` });
  });
});
