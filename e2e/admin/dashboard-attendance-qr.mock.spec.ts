import { readFile } from "node:fs/promises";
import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

test.use({ serviceWorkers: "block" });
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
test.skip(!/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(base), "Synthetic local dashboard");
for (const [width, path] of [[390, "/workspace/mobile"], [1366, "/workspace/dashboard"]] as const) {
  test(`dashboard attendance QR uses the same SVG for download and print ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await installTenantOneInitScript(page);
    let activeSign = width !== 390;
    let studentView = false;
    const recorded: number[] = [];
    const point = { id: 9, label: "교실 출석", lecture_id: 21, kind: "class", token: "12345678-1234-4123-8123-123456789abc", active: true };
    const token = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
    await page.addInitScript(jwt => { localStorage.setItem("access", jwt); localStorage.setItem("refresh", jwt); }, `e30.${token}.sig`);
    await page.route("**/api/v1/**", async route => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace("/api/v1", "");
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
      const json = (body: unknown) => route.fulfill({ json: body });
      if (path === "/core/me/") return json(studentView
        ? { id: 13, name: "학생", is_staff: false, tenantRole: "student" }
        : { id: 12, name: "교사", is_staff: true, is_superuser: true, tenantRole: "admin" });
      if (path === "/student/me/") return json({ id: 13, name: "학생", is_student: true, isParentReadOnly: false });
      if (path === "/student/attendance/qr/resolve/") {
        expect(route.request().postDataJSON().token).toBe(point.token);
        return json({ point: { kind: "class", label: "교실 출석" }, choices: [
          { id: 41, label: "1차시", can_check_in: true },
          { id: 42, label: "함수 보강", can_check_in: true },
        ] });
      }
      if (path === "/student/attendance/qr/record/") {
        const body = route.request().postDataJSON();
        expect(body).toEqual({ token: point.token, target_id: 42, action: "check_in" });
        recorded.push(body.target_id);
        return json({ kind: "class", detail: "출석이 기록되었습니다.", target_id: 42, recorded_at: "2026-11-19T09:05:00+09:00" });
      }
      if (path === "/core/program/") return json({ tenantCode: "hakwonplus", isPlatformAdmin: true, display_name: "학원", feature_flags: {}, is_active: true });
      if (path === "/lectures/attendance/arrival-overview/") return json({ summary: {}, items: [], range_days: 7 });
      if (path === "/lectures/lectures/") return json([{ id: 21, title: "예시 수업", chip_label: "수학", color: "#315da4", is_active: true }, { id: 22, title: "다른 수업", is_active: true }]);
      if (path === "/lectures/sessions/") return json(url.searchParams.get("lecture") === "21" ? [
        { id: 41, lecture: 21, title: "1차시", order: 1, date: "2026-11-18" },
        { id: 42, lecture: 21, title: "함수 보강", session_type: "SUPPLEMENT", order: 2, date: "2026-11-19" },
      ] : []);
      if (path === "/lectures/attendance-qr/") {
        if (route.request().method() === "POST") {
          expect(route.request().postDataJSON()).toMatchObject({ lecture_id: 21, kind: "class" });
          activeSign = true;
          return route.fulfill({ status: 201, json: point });
        }
        expect(url.searchParams.get("lecture_id")).toBe("21");
        expect(url.searchParams.get("kind")).toBe("class");
        return json(activeSign ? [point] : [{ ...point, active: false }]);
      }
      return json([]);
    });
    await page.goto(base + path);
    await page.getByRole("button", { name: "수업 출석 QR" }).click();
    const picker = page.getByRole("dialog", { name: "수업 출석 QR", exact: true });
    const lecture = picker.getByRole("button", { name: "예시 수업", exact: true });
    await expect(lecture.locator("[data-lecture-chip]")).toHaveText("수학");
    await test.info().attach(`qr-lectures-${width}`, { body: await page.screenshot({ animations: "disabled" }), contentType: "image/png" });
    await picker.getByRole("button", { name: "다른 수업", exact: true }).click();
    await expect(picker.getByText("이 강의에 등록된 차시가 없습니다.")).toBeVisible();
    await picker.getByRole("button", { name: "강의 다시 선택" }).click();
    await lecture.click();
    const supplement = picker.getByRole("button", { name: /함수 보강/ });
    await expect(supplement).toHaveClass(/session-block--supplement/);
    await test.info().attach(`qr-sessions-${width}`, { body: await page.screenshot({ animations: "disabled" }), contentType: "image/png" });
    await picker.getByRole("button", { name: /1차시/ }).click();
    await page.getByRole("button", { name: "차시 다시 선택" }).click();
    await supplement.focus();
    await supplement.press("Enter");
    if (!activeSign) await page.getByRole("button", { name: "출석 QR 만들기" }).click();
    const poster = page.getByLabel("출결 QR 인쇄 미리보기");
    const svg = poster.locator("svg");
    await expect(svg).toBeVisible();
    const photo = await poster.locator(".ant-qrcode").screenshot({ animations: "disabled" });
    await expect(poster).toContainText("함수 보강");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await test.info().attach(`qr-scoped-poster-${width}`, { body: await page.screenshot({ animations: "disabled" }), contentType: "image/png" });
    const screenPaths = await svg.locator("path").evaluateAll(nodes => nodes.map(node => node.getAttribute("d")));
    expect(screenPaths.length).toBeGreaterThan(0);
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "QR 다운로드 (SVG)" }).click();
    const download = await pending;
    const xml = await readFile((await download.path())!, "utf8");
    expect(download.suggestedFilename()).toContain("예시 수업");
    expect(download.suggestedFilename()).toContain("함수 보강");
    expect(await page.evaluate(xml => {
      const doc = new DOMParser().parseFromString(xml, "image/svg+xml");
      return Array.from(doc.querySelectorAll("path"), path => path.getAttribute("d"));
    }, xml)).toEqual(screenPaths);
    await page.addInitScript(() => { window.print = () => {}; });
    await page.getByRole("button", { name: "QR 인쇄·PDF 저장" }).click();
    const print = page.frameLocator('iframe[title="출결 QR 인쇄"]').locator("svg path");
    await expect(print).toHaveCount(screenPaths.length);
    expect(await print.evaluateAll(nodes => nodes.map(node => node.getAttribute("d")))).toEqual(screenPaths);
    await page.locator('iframe[title="출결 QR 인쇄"]').evaluate((frame: HTMLIFrameElement) =>
      frame.contentWindow?.dispatchEvent(new Event("afterprint")));
    studentView = true;
    await page.goto(base + "/student/attendance/scan");
    await page.locator('input[type="file"]').setInputFiles({ name: "class.png", mimeType: "image/png", buffer: photo });
    await expect(page.getByRole("heading", { name: "출석이 기록되었습니다." })).toBeVisible();
    await expect(page.getByText("함수 보강", { exact: true })).toBeVisible();
    expect(recorded).toEqual([42]);
  });
}
