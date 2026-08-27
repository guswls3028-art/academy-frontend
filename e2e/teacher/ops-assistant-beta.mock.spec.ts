import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const jwt = () => `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.sig`;

test.skip(!/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE), "local route mock only");
test.use({ serviceWorkers: "block" });

test("선생님이 사진 실행표를 390px에서 확인하고 ONLINE 영상 권한을 확정한다", async ({ page }) => {
  const analyzeBodies: string[] = [];
  const analyticsEvents: Array<Record<string, unknown>> = [];
  let analyzeCount = 0;
  await page.setViewportSize({ width: 390, height: 844 });
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => { localStorage.setItem("access", token); localStorage.setItem("refresh", token); }, jwt());
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()); const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown) => route.fulfill({ json: body });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "테스트 학원", feature_flags: { product_usage_analytics_enabled: true }, is_active: true });
    if (path === "/core/me/") return json({ id: 7, username: "teacher", name: "담당교사", is_staff: true, tenantRole: "teacher", must_change_password: false });
    if (path === "/core/product-analytics/events/batch/" && route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { events?: Array<Record<string, unknown>> };
      analyticsEvents.push(...(body.events ?? []));
      return route.fulfill({ status: 202, json: { accepted: body.events?.length ?? 0 } });
    }
    if (path === "/teacher-app/ops-assistant/analyze/") {
      analyzeBodies.push(route.request().postData() || "");
      analyzeCount += 1;
      return json({ proposal_token: `signed-preview-${analyzeCount}`, privacy: "원본 사진은 저장하지 않았습니다.", lecture_options: [{ id: 31, title: "해솔고1 과학반" }], rows: [{ row_id: "synthetic-row", name: "가온별", student_phone: "01033334444", parent_phone: "01011112222", school: "해솔고", school_type: "HIGH", grade: "1", selected_lecture_id: 31, session_order: 1, remove_enrollment_id: null, actions: { register_student: true, enroll_lecture: true, open_video: true, send_account_notice: true, correct_enrollment: false }, student_match: { status: "existing", id: 81, basis: ["name", "parent_phone", "school"] }, profile_changes: ["student.phone", "student.ps_number", "user.phone"], attendance_target: "ONLINE", correction_options: [], issues: [], can_confirm: true }] });
    }
    if (path === "/teacher-app/ops-assistant/confirm/") return json({ execution_id: "00000000-0000-0000-0000-000000000001", idempotent_replay: false, provider_receipt_note: "공급사 접수와 카카오 열람은 다릅니다.", rows: [{ row_id: "synthetic-row", account_creation: "not_created", profile_link: { state: "updated" }, enrollment: { correct_active_count: 1, wrong_active_removed: false }, attendance: { status: "ONLINE" }, video_access: [{ access_mode: "PROCTORED_CLASS", monitoring: true }], account_notice: { state: "provider_received", provider_evidence: { accepted_count: 2, expected_count: 2 } }, real_playback_canary: { state: "not_run", reason: "separate_safe_boundary_required" } }] });
    if (path.includes("/teacher-app/ops-assistant/executions/")) return json({ status: "succeeded", rows: [] });
    return json({ count: 0, results: [] });
  });
  await page.goto(`${BASE}/workspace/mobile/assistant`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "학생 업무 도우미" })).toBeVisible();
  await expect.poll(() => analyticsEvents.find((event) => event.event_type === "screen_view"), { timeout: 8_000 }).toMatchObject({
    event_type: "screen_view",
    feature_id: "students.directory",
    screen_id: "teacher.students.assistant",
    surface: "teacher",
    route_template: "/workspace/mobile/assistant",
    synthetic: false,
  });
  const screenView = analyticsEvents.find((event) => event.event_type === "screen_view");
  expect(screenView).not.toHaveProperty("user_id");
  expect(screenView).not.toHaveProperty("username");
  expect(screenView).not.toHaveProperty("tenant_id");
  await page.locator('input[type="file"]').setInputFiles({ name: "student.png", mimeType: "image/png", buffer: Buffer.from("synthetic-image") });
  await page.getByPlaceholder(/숙명에 등록/).fill("신규 여부 먼저 확인하고 영상 열어줘");
  await page.getByRole("button", { name: "실행표 만들기" }).click();
  await expect(page.getByText("기존 학생 · name + parent_phone + school")).toBeVisible();
  await expect(page.getByText("ONLINE · 모니터링")).toBeVisible();
  expect(analyzeBodies[0]).not.toContain("previous_proposal_token");
  await page.getByPlaceholder(/숙명에 등록/).fill("새 사진을 독립적으로 확인해줘");
  await page.getByRole("button", { name: "실행표 만들기" }).click();
  await expect.poll(() => analyzeBodies.length).toBe(2);
  expect(analyzeBodies[1]).not.toContain("previous_proposal_token");
  await page.getByPlaceholder(/숙명에 등록/).fill("이 친구도 영상 열어줘");
  await page.getByRole("button", { name: "실행표 만들기" }).click();
  await expect.poll(() => analyzeBodies.length).toBe(3);
  expect(analyzeBodies[2]).toContain("previous_proposal_token");
  expect(analyzeBodies[2]).toContain("signed-preview-2");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "1명 확정하고 실행" }).click();
  await expect(page.getByText("기존 연결 복구")).toBeVisible();
  await expect(page.getByText("ONLINE · PROCTORED_CLASS · monitoring=true")).toBeVisible();
  await expect(page.getByText("알림톡 공급사 접수 2/2")).toBeVisible();
  await expect(page.getByText("이번 실행에서 미검증")).toBeVisible();
  await page.setViewportSize({ width: 1366, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
