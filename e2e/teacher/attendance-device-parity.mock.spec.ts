import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5189";
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local synthetic API only");
test.use({ serviceWorkers: "block" });

const states = [
  ["UNSET", "미입력", "－"], ["PRESENT", "현장", "현"], ["ONLINE", "영상", "영"],
  ["SUPPLEMENT", "보강", "보"], ["LATE", "지각", "지"], ["EARLY_LEAVE", "조퇴", "조"],
  ["ABSENT", "결석", "결"], ["RUNAWAY", "출튀", "출"], ["MATERIAL", "자료", "자"],
  ["INACTIVE", "부재", "부"], ["SECESSION", "퇴원", "퇴"],
] as const;

for (const width of [390, 1366]) {
  test(`PC와 모바일 출결 전체 상태·저장·퇴원 범위·현황표 일치 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installTenantOneInitScript(page);
    const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
    await page.addInitScript((token) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", `${token}-refresh`);
    }, `e30.${payload}.signature`);
    let status = "UNSET";
    let matrixFails = false;
    const changes: Array<Record<string, unknown>> = [];
    await page.route("**/api/v1/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname.replace(/^\/api\/v1/, "");
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
      if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
      if (path === "/core/me/") return route.fulfill({ json: { id: 12, name: "출결 담당자", username: "parity-owner", is_staff: true, tenantRole: "teacher", must_change_password: false, first_login_guide_required: false } });
      if (path === "/core/subscription/") return route.fulfill({ json: { plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 } });
      if (path === "/lectures/attendance/" && req.method() === "GET") return route.fulfill({ json: { count: 1, next: null, results: [{ id: 777, student_id: 41, name: "상태 검증학생", status }] } });
      if (path === "/lectures/attendance/777/" && req.method() === "PATCH") {
        const body = req.postDataJSON();
        changes.push(body);
        status = body.status;
        return route.fulfill({ json: { id: 777, name: "상태 검증학생", status } });
      }
      if (path === "/lectures/attendance/matrix/") {
        if (matrixFails) return route.fulfill({ status: 503, json: { detail: "현황 조회 실패" } });
        return route.fulfill({ json: {
          lecture: { id: 7, title: "검증 강의" },
          sessions: [{ id: 99, order: 1, date: "2026-11-01" }],
          students: states.map(([code], i) => ({ student_id: i + 1, name: `검증학생${i + 1}`, attendance: { "99": { attendance_id: i + 1, status: code } } })),
        } });
      }
      return route.fulfill({ json: { count: 0, next: null, results: [] } });
    });
    await gotoAndSettle(page, `${BASE}/workspace/mobile/attendance/99`);
    const student = page.getByRole("button", { name: "상태 검증학생 출석 상태 변경", exact: true });
    await student.click();
    const sheet = page.getByRole("dialog", { name: "출석 상태", exact: true });
    for (const [, label] of states) await expect(sheet.getByRole("button", { name: label, exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "영상", exact: true }).click();
    await expect.poll(() => status).toBe("ONLINE");
    await expect(student).toContainText("영상");
    await page.reload();
    await expect(student).toContainText("영상");
    for (const [code, label] of states.filter(([code]) => !["ONLINE", "SECESSION"].includes(code))) {
      await student.click();
      await sheet.getByRole("button", { name: label, exact: true }).click();
      await expect.poll(() => status).toBe(code);
      await expect(student).toContainText(label);
    }
    await student.click();
    await sheet.getByRole("button", { name: "퇴원", exact: true }).click();
    const confirm = page.getByRole("dialog");
    await expect(confirm.getByText("퇴원 범위 선택", { exact: true })).toBeVisible();
    const beforeCancel = changes.length;
    await confirm.getByRole("button", { name: "취소", exact: true }).click();
    expect(changes).toHaveLength(beforeCancel);
    await student.click();
    await sheet.getByRole("button", { name: "퇴원", exact: true }).click();
    await confirm.getByRole("radio", { name: /2\. 강의 전체 퇴원/ }).check();
    await confirm.getByRole("button", { name: "강의 전체 퇴원", exact: true }).click();
    await expect.poll(() => status).toBe("SECESSION");
    expect(changes.at(-1)).toEqual({ status: "SECESSION", confirm_secession: true, secession_scope: "lecture" });
    await expect(page.getByRole("button", { name: "되돌리기", exact: true })).toHaveCount(0);
    await page.reload();
    await expect(student).toContainText("퇴원");
    await gotoAndSettle(page, `${BASE}/workspace/mobile/classes/7/attendance-matrix`);
    for (const [, label, short] of states) {
      await expect(page.locator(`[aria-label$=" ${label}"]`)).toHaveText(short);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`attendance-parity-${width}.png`), fullPage: true });
    matrixFails = true;
    await page.reload();
    await expect(page.getByText("출석 현황을 불러오지 못했습니다", { exact: true })).toBeVisible();
    await expect(page.getByText("출석 데이터가 없습니다", { exact: true })).toHaveCount(0);
    matrixFails = false;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(page.locator('[aria-label$=" 영상"]')).toHaveText("영");
  });
}
