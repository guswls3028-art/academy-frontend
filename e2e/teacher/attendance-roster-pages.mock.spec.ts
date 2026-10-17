import { expect, test } from "../fixtures/strictTest";
import { guideRecording } from "../helpers/guideRecording";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5179";

if (process.env.GUIDE_MEDIA_CAPTURE === "1") {
  test.use({ viewport: { width: 390, height: 844 }, video: { mode: "on", size: { width: 390, height: 844 } } });
  test("@guide-recording 선생님 모바일 출결 입력", async ({ page }, info) => {
    const recording = await guideRecording(page, info, { id: "teacher-attendance", title: "선생님 모바일 출결 입력", topics: ["teacher/attendance"] });
    await installTenantOneInitScript(page);
    const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
    await page.addInitScript((token) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", `${token}-refresh`);
    }, `e30.${payload}.synthetic`);
    const rows = [
      { id: 777, name: "예시학생 가", status: "UNSET", student_id: 101 },
      { id: 778, name: "예시학생 나", status: "UNSET", student_id: 102 },
      { id: 779, name: "예시학생 다", status: "UNSET", student_id: 103 },
    ];
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
      if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "가이드 예시 학원", is_active: true, feature_flags: {} } });
      if (path === "/core/me/") return route.fulfill({ json: { id: 12, name: "예시 선생님", username: "guide-teacher", is_staff: true, tenantRole: "teacher", must_change_password: false, first_login_guide_required: false } });
      if (path === "/core/subscription/") return route.fulfill({ json: { plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 } });
      if (path === "/lectures/sessions/71/") return route.fulfill({ json: { id: 71, lecture: 7, order: 1, title: "수학 1차시", lecture_title: "예시 수학반" } });
      if (path === "/lectures/attendance/" && request.method() === "GET") return route.fulfill({ json: { count: rows.length, next: null, results: rows } });
      const match = path.match(/^\/lectures\/attendance\/(\d+)\/$/);
      if (match && request.method() === "PATCH") {
        const row = rows.find((item) => item.id === Number(match[1]));
        if (!row) throw new Error("Unexpected recording student");
        row.status = request.postDataJSON().status;
        return route.fulfill({ json: row });
      }
      return route.fulfill({ json: { count: 0, next: null, results: [] } });
    });
    await page.goto(`${process.env.E2E_BASE_URL}/workspace/mobile/attendance/71`);
    const student = page.getByText("예시학생 가", { exact: true });
    await recording.screen("해당 차시의 학생 확인", "강의·차시를 확인하고 학생 카드를 누릅니다.", student);
    await student.click();
    const present = page.getByRole("button", { name: "출석", exact: true });
    await recording.screen("실제 출결 상태 선택", "출석·지각·결석 등 학생의 실제 상태를 선택합니다.", present);
    await present.click();
    await expect.poll(() => rows[0].status).toBe("PRESENT");
    await recording.screen("저장과 요약 확인", "저장 완료 뒤 출석 요약이 바뀌었는지 확인합니다.", page.getByText("출석 1", { exact: true }));
    await page.reload();
    await recording.screen("다시 열어 확인", "차시를 다시 열어 출결이 남아 있는지 확인합니다. 잘못된 상태는 학생 카드를 열어 정정합니다.", student);
    await recording.finish();
  });
}
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local synthetic API only");
test.use({ serviceWorkers: "block" });

const cases = [
  { width: 390, scenario: "complete" },
  { width: 1366, scenario: "complete" },
  ...["http", "duplicate", "truncated", "count-change", "malformed"].map((scenario) => ({ width: 390, scenario })),
];

for (const { width, scenario } of cases) {
  test(`출석 전체 명단과 저장·복구 ${width}px ${scenario}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installTenantOneInitScript(page);
    const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
    await page.addInitScript((token) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", `${token}-refresh`);
    }, `e30.${payload}.signature`);
    let failing = scenario !== "complete";
    const requestedPages: number[] = [];
    const changes: unknown[] = [];
    const rows = Array.from({ length: 501 }, (_, index) => ({
      id: index + 1, status: "UNSET", name: `출결 검증 ${String(index + 1).padStart(3, "0")}`,
      student_id: index + 101, enrollment_id: index + 1001,
      lecture_title: "출결 검증반", lecture_chip_label: "검증",
    }));
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
      if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
      if (path === "/core/me/") return route.fulfill({ json: { id: 12, name: "출결 담당자", username: "attendance-owner", is_staff: true, tenantRole: "teacher", must_change_password: false, first_login_guide_required: false } });
      if (path === "/core/subscription/") return route.fulfill({ json: { plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 } });
      if (path === "/lectures/sessions/71/") return route.fulfill({ json: { id: 71, lecture: 7, order: 1, title: "출결 검증 차시", lecture_title: "출결 검증반" } });
      if (path === "/enrollments/session-enrollments/") return route.fulfill({ json: rows.map((row) => ({
        id: row.id + 2001, session: 71, enrollment: row.enrollment_id,
        student_id: row.student_id, student_name: row.name, enrollment_status: "ACTIVE",
      })) });
      if (path === "/lectures/attendance/" && request.method() === "GET") {
        expect(url.searchParams.get("session")).toBe("71");
        const pageNumber = Number(url.searchParams.get("page") || 1);
        requestedPages.push(pageNumber);
        const size = Math.min(500, Number(url.searchParams.get("page_size") || 50));
        if (failing && scenario === "http" && pageNumber === 2) return route.fulfill({ status: 503, json: { detail: "QA second page unavailable" } });
        if (failing && scenario === "malformed" && pageNumber === 2) return route.fulfill({ json: { results: "invalid", count: 501, next: null } });
        const items = failing && scenario === "duplicate" && pageNumber === 2
          ? [rows[0]] : rows.slice((pageNumber - 1) * size, pageNumber * size);
        const count = failing && scenario === "count-change" && pageNumber === 2 ? 502 : rows.length;
        const next = failing && scenario === "truncated" ? null : pageNumber * size < rows.length ? `?page=${pageNumber + 1}` : null;
        return route.fulfill({ json: { count, next, results: items } });
      }
      if (path === "/lectures/attendance/501/" && request.method() === "PATCH") {
        const body = request.postDataJSON();
        changes.push(body);
        rows[500].status = body.status;
        return route.fulfill({ json: rows[500] });
      }
      if (path === "/lectures/attendance/bulk_set_present/" && request.method() === "POST") {
        expect(request.postDataJSON()).toEqual({ session: 71 });
        changes.push("bulk");
        const updated = rows.filter((row) => row.status !== "PRESENT").length;
        rows.forEach((row) => { row.status = "PRESENT"; });
        return route.fulfill({ json: { updated, session: 71, undo_token: null, undo_expires_in: null } });
      }
      return route.fulfill({ json: { count: 0, next: null, results: [] } });
    });

    await gotoAndSettle(page, `${BASE}/workspace/mobile/attendance/71`);
    if (failing) {
      await expect(page.getByText("출석 명단을 불러오지 못했습니다", { exact: true })).toBeVisible();
      await expect(page.getByText("출결 검증 001", { exact: true })).toHaveCount(0);
      await expect(page.getByText("출석 데이터가 없습니다", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "전체출석", exact: true })).toBeDisabled();
      expect(changes).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`attendance-error-${scenario}.png`), animations: "disabled" });
      const requestCount = requestedPages.length;
      failing = false;
      await page.getByRole("button", { name: "다시 시도", exact: true }).click();
      await expect(page.getByText("총 501명", { exact: true })).toBeVisible();
      expect(requestedPages.slice(requestCount)).toEqual([1, 2]);
    }
    await expect(page.getByText("총 501명", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "전체출석", exact: true })).toBeEnabled();
    await page.screenshot({ path: test.info().outputPath(`attendance-summary-${width}.png`), animations: "disabled" });
    const lastStudent = page.getByText("출결 검증 501", { exact: true });
    await lastStudent.scrollIntoViewIfNeeded();
    await lastStudent.click();
    await page.getByRole("button", { name: "결석", exact: true }).click();
    await expect.poll(() => rows[500].status).toBe("ABSENT");
    await expect(page.getByText("결석 1", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("총 501명", { exact: true })).toBeVisible();
    await expect(page.getByText("결석 1", { exact: true })).toBeVisible();
    await gotoAndSettle(page, `${BASE}/workspace/mobile/classes/7/sessions/71`);
    const lastStudentRow = page.getByRole("button").filter({ has: page.getByText("출결 검증 501", { exact: true }) });
    await expect(lastStudentRow).toContainText("결석");
    await page.reload();
    await expect(lastStudentRow).toContainText("결석");
    await page.getByRole("button", { name: "출석 체크", exact: true }).click();
    await expect(page.getByText("총 501명", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "전체출석", exact: true }).click();
    await expect(page.getByText("출석 501", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("출석 501", { exact: true })).toBeVisible();
    await lastStudent.scrollIntoViewIfNeeded();
    await waitForRenderSettled(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: test.info().outputPath(`attendance-roster-${width}-${scenario}.png`), animations: "disabled" });
    expect(changes).toEqual([{ status: "ABSENT" }, "bulk"]);
  });
}
