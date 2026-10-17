import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { guideRecording } from "../helpers/guideRecording";

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
