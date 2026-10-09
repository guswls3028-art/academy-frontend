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
      }, `e30.${payload}.signature`);
      let failing = true;
      const detailIds: string[] = [];
      await page.route("**/api/v1/**", async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
        if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
        if (path === "/core/me/") return route.fulfill({ json: { id: 11, name: "출결 검증", username: "attendance-reader", is_staff: false, tenantRole: role, linkedStudents: role === "parent" ? [{ id: 11, name: "출결 학생" }] : [] } });
        if (path === "/student/me/") return route.fulfill({ json: { id: 11, name: "출결 학생", username: "attendance-student", is_student: true, isParentReadOnly: role === "parent" } });
        if (path === "/student/attendance/summary/") {
          if (failing) return route.fulfill({ status: 400, json: { detail: "QA attendance failure" } });
          if (role === "parent") expect(request.headers()["x-student-id"]).toBe("11");
          return route.fulfill({ json: {
            summary: { total: 4, present: 1, late: 0, early_leave: 1, absent: 0, runaway: 1 },
            recent: [
              { session_id: 24, lecture_title: "현재 수강", session_title: "정규 수업", date: "2026-10-08", status: "PRESENT", can_view_session: true },
              { session_id: 25, lecture_title: "종료된 특강", session_title: "마지막 수업", date: "2026-08-31", status: "EARLY_LEAVE", can_view_session: false },
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
      failing = false;
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
      expect(detailIds.every((path) => path === "/student/sessions/24/")).toBe(true);
    });
  }
}
