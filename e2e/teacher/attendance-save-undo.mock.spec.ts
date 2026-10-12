import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5189";
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local synthetic API only");
test.use({ serviceWorkers: "block" });

for (const { width, scenario } of [
  { width: 390, scenario: "slow-save" }, { width: 1366, scenario: "slow-save" },
  { width: 390, scenario: "save-error" }, { width: 390, scenario: "undo-error" },
  { width: 390, scenario: "bulk-after-save" },
]) {
  test(`출결 저장 확인과 되돌리기 복구 ${width}px ${scenario}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installTenantOneInitScript(page);
    const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
    await page.addInitScript((token) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", `${token}-refresh`);
    }, `e30.${payload}.signature`);
    let currentStatus = "SECESSION";
    let failing = scenario === "save-error";
    let releaseSave: () => void = () => {};
    const saveGate = new Promise<void>((resolve) => { releaseSave = resolve; });
    let releaseBulkRead: () => void = () => {};
    const bulkReadGate = new Promise<void>((resolve) => { releaseBulkRead = resolve; });
    let bulkSaved = false;
    const changes: Array<Record<string, unknown>> = [];
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
      if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
      if (path === "/core/me/") return route.fulfill({ json: { id: 12, name: "출결 담당자", username: "attendance-owner", is_staff: true, tenantRole: "teacher", must_change_password: false, first_login_guide_required: false } });
      if (path === "/core/subscription/") return route.fulfill({ json: { plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 } });
      if (path === "/lectures/attendance/" && request.method() === "GET") {
        if (bulkSaved) await bulkReadGate;
        return route.fulfill({ json: { count: 1, next: null, results: [{ id: 777, name: "되돌리기 검증학생", status: currentStatus }] } });
      }
      if (path === "/lectures/attendance/bulk_set_present/" && request.method() === "POST") {
        expect(request.postDataJSON()).toEqual({ session: 99 });
        currentStatus = "PRESENT";
        bulkSaved = true;
        return route.fulfill({ json: { session: 99, updated: 1 } });
      }
      if (path === "/lectures/attendance/777/" && request.method() === "PATCH") {
        const body = request.postDataJSON();
        changes.push(body);
        if (scenario === "slow-save" && changes.length === 1) await saveGate;
        if (failing) return route.fulfill({ status: 503, json: { detail: "출결 저장을 잠시 사용할 수 없습니다." } });
        currentStatus = body.status;
        return route.fulfill({ json: { id: 777, name: "되돌리기 검증학생", status: currentStatus } });
      }
      return route.fulfill({ json: { count: 0, next: null, results: [] } });
    });
    await gotoAndSettle(page, `${BASE}/workspace/mobile/attendance/99`);
    const student = page.getByText("되돌리기 검증학생", { exact: true });
    await expect(student).toBeVisible();
    await student.click();
    await page.getByRole("button", { name: "결석", exact: true }).click();
    await expect.poll(() => changes.length).toBe(1);
    if (scenario === "slow-save") {
      try {
        expect(await page.getByText("상태가 변경되었습니다", { exact: true }).count()).toBe(0);
        expect(await page.getByRole("button", { name: "되돌리기", exact: true }).count()).toBe(0);
        await expect(page.getByText("출결 저장 중…", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "전체출석", exact: true })).toBeDisabled();
        await student.click();
        expect(await page.getByText("출석 상태", { exact: true }).count()).toBe(0);
        // eslint-disable-next-line no-restricted-syntax -- Verify that slow responses do not consume the 3-second undo window.
        await page.waitForTimeout(3200); // Exceed the old timer while the server has not accepted the save.
        expect(currentStatus).toBe("SECESSION");
      } finally { releaseSave(); }
    }
    if (scenario === "save-error") {
      await expect(page.getByText("출결 저장을 잠시 사용할 수 없습니다.", { exact: true })).toBeVisible();
      expect(await page.getByText("상태가 변경되었습니다", { exact: true }).count()).toBe(0);
      expect(await page.getByRole("button", { name: "되돌리기", exact: true }).count()).toBe(0);
      expect(currentStatus).toBe("SECESSION");
      failing = false;
      await student.click();
      await page.getByRole("button", { name: "결석", exact: true }).click();
    }
    await expect(page.getByText("결석 1", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "되돌리기", exact: true })).toBeVisible();
    if (scenario === "bulk-after-save") {
      await page.getByRole("button", { name: "전체출석", exact: true }).click();
      await expect.poll(() => bulkSaved).toBe(true);
      try {
        await expect(page.getByText("출결 저장 중…", { exact: true })).toBeVisible();
        await student.click();
        expect(await page.getByText("출석 상태", { exact: true }).count()).toBe(0);
        expect(changes).toHaveLength(1);
        await expect(page.getByRole("button", { name: "되돌리기", exact: true })).toHaveCount(0);
      } finally { releaseBulkRead(); }
      await expect(page.getByText("출석 1", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "전체출석", exact: true })).toBeEnabled();
      await page.reload();
      await expect(page.getByText("출석 1", { exact: true })).toBeVisible();
      expect(currentStatus).toBe("PRESENT");
      return;
    }
    failing = scenario === "undo-error";
    await page.getByRole("button", { name: "되돌리기", exact: true }).click();
    if (scenario === "undo-error") {
      await expect(page.getByText("출결 저장을 잠시 사용할 수 없습니다.", { exact: true })).toBeVisible();
      expect(currentStatus).toBe("ABSENT");
      // eslint-disable-next-line no-restricted-syntax -- Verify failed undo survives its original 3-second expiry.
      await page.waitForTimeout(3200); // A rejected undo must remain retryable after the original snackbar deadline.
      await expect(page.getByRole("button", { name: "되돌리기", exact: true })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath("undo-retry-390.png"), animations: "disabled" });
      failing = false;
      await page.getByRole("button", { name: "되돌리기", exact: true }).click();
    }
    await expect.poll(() => currentStatus).toBe("SECESSION");
    expect(changes.at(-1)).toEqual({ status: "SECESSION", confirm_secession: true });
    await expect(page.getByText("기타 1", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "되돌리기", exact: true })).toHaveCount(0);
    await page.reload();
    await expect(student).toBeVisible();
    await expect(page.getByText("기타 1", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`undo-restored-${width}.png`), animations: "disabled" });
  });
}
