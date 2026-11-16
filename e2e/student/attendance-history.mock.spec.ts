import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5181";
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local synthetic API only");
test.use({ serviceWorkers: "block" });

for (const role of ["student", "parent"]) {
  for (const width of [390, 1366]) {
    test(`출결 이력·상태·접근 가능 차시와 재시도 ${role} ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 11, tenant_code: "hakwonplus" })).toString("base64url");
      await page.addInitScript((token) => {
        localStorage.setItem("access", token);
        localStorage.setItem("refresh", `${token}-refresh`);
        localStorage.setItem("tenant_code", "hakwonplus");
        sessionStorage.setItem("tenantCode", "hakwonplus");
        localStorage.setItem("parent_selected_student_id_hakwonplus_11", "11");
      }, `e30.${payload}.signature`);
      let attendanceStatus = 400;
      let historyTitle = "종료된 특강";
      let holdOldChild = false;
      let releaseOldChild: () => void = () => undefined;
      const oldChildResponse = new Promise<void>(resolve => { releaseOldChild = resolve; });
      let oldChildPending = false;
      let oldChildSettled = false;
      const detailIds: string[] = [];
      await page.route("**/api/v1/**", async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
        if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
        if (path === "/core/me/") return route.fulfill({ json: { id: 11, name: "출결 검증", username: "attendance-reader", is_staff: false, tenantRole: role, linkedStudents: role === "parent" ? [{ id: 11, name: "출결 학생" }, { id: 12, name: "다른 학생" }] : [] } });
        if (path === "/student/me/") return route.fulfill({ json: { id: 11, name: "출결 학생", username: "attendance-student", is_student: true, isParentReadOnly: role === "parent" } });
        if (path === "/student/attendance/summary/") {
          const selected = request.headers()["x-student-id"];
          if (role === "parent") expect(["11", "12"]).toContain(selected);
          if (selected === "12") return route.fulfill({ json: {
            summary: { total: 1, present: 1, late: 0, early_leave: 0, absent: 0, runaway: 0 },
            recent: [{ session_id: 28, lecture_title: "둘째의 출결", session_title: "둘째 차시", date: null, status: "PRESENT" }],
          } });
          if (holdOldChild) {
            oldChildPending = true;
            await oldChildResponse;
            await route.fulfill({ status: 403, json: { detail: "Old child validation failed" } }).catch(() => undefined);
            oldChildSettled = true;
            return;
          }
          if (attendanceStatus !== 200) return route.fulfill({ status: attendanceStatus, json: { detail: "QA attendance failure" } });
          return route.fulfill({ json: {
            summary: { total: 4, present: 1, late: 0, early_leave: 1, absent: 0, runaway: 1 },
            recent: [
              { session_id: 24, lecture_title: "현재 수강", session_title: "정규 수업", date: "2026-10-08", status: "PRESENT", can_view_session: true },
              { session_id: 25, lecture_title: historyTitle, session_title: "마지막 수업", date: "2026-08-31", status: "EARLY_LEAVE", can_view_session: false },
              { session_id: 26, lecture_title: "다음 수업", session_title: "출결 확인 대기", date: "2026-10-09", status: "UNSET", can_view_session: true },
              { session_id: 27, lecture_title: "보존된 출결", session_title: "이전 수업", date: "2026-08-30", status: "RUNAWAY", can_view_session: false },
            ],
          } });
        }
        if (/^\/student\/sessions\/\d+\/$/.test(path)) {
          detailIds.push(path);
          return route.fulfill({ json: { id: 24, title: "정규 수업", date: "2026-10-08", exam_ids: [], type: "session" } });
        }
        return route.fulfill({ json: { results: [], count: 0, next: null, notices: [], today_sessions: [], badges: {} } });
      });
      await gotoAndSettle(page, `${BASE}/student/attendance`);
      await expect(page.getByText("출결 정보를 불러오지 못했습니다", { exact: true })).toBeVisible();
      attendanceStatus = 200;
      await page.getByRole("button", { name: "다시 시도", exact: true }).click();
      await expect(page.getByText("종료된 특강", { exact: true })).toBeVisible();
      await expect.soft(page.getByText("미입력", { exact: true })).toBeVisible();
      await expect.soft(page.getByText("지각·조퇴", { exact: true })).toBeVisible();
      await expect.soft(page.getByText("결석·이탈", { exact: true })).toBeVisible();
      await expect.soft(page.locator('a[href="/student/sessions/25"]')).toHaveCount(0);
      await expect.soft(page.locator('a[href="/student/sessions/27"]')).toHaveCount(0);
      await waitForRenderSettled(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: test.info().outputPath(`attendance-${role}-${width}.png`), animations: "disabled", fullPage: true });
      await page.locator('a[href="/student/sessions/24"]').click();
      await expect(page.getByRole("heading", { name: "정규 수업", exact: true })).toBeVisible();
      await page.goBack();
      await page.reload();
      await expect(page.getByText("종료된 특강", { exact: true })).toBeVisible();
      await expect(page.locator('a[href="/student/sessions/25"]')).toHaveCount(0);
      const agedBack = async () => {
        const origin = await page.evaluate(() => performance.timeOrigin);
        await page.locator('a[href="/student/sessions/24"]').click();
        await expect(page.getByRole("heading", { name: "정규 수업", exact: true })).toBeVisible();
        await page.evaluate(() => {
          const now = Date.now.bind(Date);
          Date.now = () => now() + 31_000;
        });
        await page.goBack();
        await expect(page).toHaveURL(/\/student\/attendance$/);
        expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
      };
      const oldHistory = page.getByText("종료된 특강", { exact: true });
      const retry = page.getByRole("button", { name: "다시 시도", exact: true });
      attendanceStatus = 503;
      await agedBack();
      await expect(page.getByRole("status").filter({ hasText: "이전에 확인한 출결을 표시합니다" })).toBeVisible({ timeout: 20_000 });
      await expect(oldHistory).toBeVisible();
      attendanceStatus = 200;
      historyTitle = "갱신된 출결";
      await retry.click();
      const freshHistory = page.getByText("갱신된 출결", { exact: true });
      await expect(freshHistory).toBeVisible();
      await expect(oldHistory).toHaveCount(0);

      attendanceStatus = role === "parent" ? 403 : 404;
      await agedBack();
      await expect(page.getByText("출결 정보를 불러오지 못했습니다", { exact: true })).toBeVisible();
      await expect(freshHistory).toHaveCount(0);
      attendanceStatus = 503;
      await Promise.all([
        page.waitForResponse(response => response.request().method() === "GET"
          && new URL(response.url()).pathname === "/api/v1/student/attendance/summary/" && response.status() === 503),
        retry.click(),
      ]);
      await expect(page.getByText("출결 정보를 불러오지 못했습니다", { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(freshHistory).toHaveCount(0);
      await expect(page.getByText(/이전에 확인한 출결을 표시합니다/)).toHaveCount(0);

      if (role === "parent") {
        attendanceStatus = 200;
        await retry.click();
        await expect(freshHistory).toBeVisible();
        holdOldChild = true;
        try {
          await agedBack();
          await expect.poll(() => oldChildPending).toBe(true);
          await page.getByRole("tablist", { name: "자녀 선택" }).getByRole("tab", { name: "다른 학생" }).click();
          await expect(page).toHaveURL(/\/student\/dashboard/);
          await page.goto(`${BASE}/student/attendance`, { waitUntil: "domcontentloaded" });
          const secondHistory = page.getByText("둘째의 출결", { exact: true });
          await expect(secondHistory).toBeVisible();
          await expect(freshHistory).toHaveCount(0);
          releaseOldChild();
          await expect.poll(() => oldChildSettled).toBe(true);
          await expect(secondHistory).toBeVisible();
          await expect(freshHistory).toHaveCount(0);
        } finally {
          releaseOldChild();
        }
      }
      expect(detailIds.every((path) => path === "/student/sessions/24/")).toBe(true);
    });
  }
}
