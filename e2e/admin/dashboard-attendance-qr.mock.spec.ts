import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

test.use({ serviceWorkers: "block" });
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
test.skip(!/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(base), "Synthetic local dashboard");
for (const [width, path] of [[390, "/workspace/mobile"], [1366, "/workspace/dashboard"]] as const) {
  test(`dashboard attendance QR uses the same SVG for download and print ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 920 });
    await installTenantOneInitScript(page);
    const token = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
    await page.addInitScript(jwt => { localStorage.setItem("access", jwt); localStorage.setItem("refresh", jwt); }, `e30.${token}.sig`);
    await page.route("**/api/v1/**", async route => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace("/api/v1", "");
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
      const json = (body: unknown) => route.fulfill({ json: body });
      if (path === "/core/me/") return json({ id: 12, name: "교사", is_staff: true, is_superuser: true, tenantRole: "admin" });
      if (path === "/core/program/") return json({ tenantCode: "hakwonplus", isPlatformAdmin: true, display_name: "학원", feature_flags: {}, is_active: true });
      if (path === "/lectures/attendance/arrival-overview/") return json({ summary: {}, items: [], range_days: 7 });
      if (path === "/lectures/lectures/") return json([{ id: 21, title: "예시 수업", is_active: true }, { id: 22, title: "다른 수업", is_active: true }]);
      if (path === "/lectures/attendance-qr/") {
        expect(url.searchParams.get("lecture_id")).toBe("21");
        expect(url.searchParams.get("kind")).toBe("class");
        return json([{ id: 9, label: "교실 출석", lecture_id: 21, kind: "class", token: "12345678-1234-4123-8123-123456789abc", active: true }]);
      }
      return json([]);
    });
    await page.goto(base + path);
    await page.getByRole("button", { name: "수업 출석 QR" }).click();
    await page.getByLabel("출석할 강의").selectOption("21");
    await page.getByRole("button", { name: "QR 열기" }).click();
    const poster = page.getByLabel("출결 QR 인쇄 미리보기");
    const svg = poster.locator("svg");
    await expect(svg).toBeVisible();
    const screenPaths = await svg.locator("path").evaluateAll(nodes => nodes.map(node => node.getAttribute("d")));
    expect(screenPaths.length).toBeGreaterThan(0);
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "QR 다운로드 (SVG)" }).click();
    const download = await pending;
    const xml = await readFile((await download.path())!, "utf8");
    expect(download.suggestedFilename()).toContain("예시 수업");
    expect(await page.evaluate(xml => {
      const doc = new DOMParser().parseFromString(xml, "image/svg+xml");
      return Array.from(doc.querySelectorAll("path"), path => path.getAttribute("d"));
    }, xml)).toEqual(screenPaths);
    await page.addInitScript(() => { window.print = () => {}; });
    await page.getByRole("button", { name: "QR 인쇄·PDF 저장" }).click();
    const print = page.frameLocator('iframe[title="출결 QR 인쇄"]').locator("svg path");
    await expect(print).toHaveCount(screenPaths.length);
    expect(await print.evaluateAll(nodes => nodes.map(node => node.getAttribute("d")))).toEqual(screenPaths);
  });
}
