import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const DETAIL = "/workspace/videos/tree?videoId=901&lectureId=701&sessionId=801";
const title = "중간고사 수학 복습 · 긴 영상 제목의 줄바꿈 확인";
const studentName = "누적시간확인학생긴이름";

type MockState = { reportFailure: boolean; activityFailure: boolean; durationMissing?: boolean };

async function installAllowance(page: Page) {
  await install(page);
  const state = { limit: 5_040_000, used: 5_040_000, revision: "allowance-1", fail: false, reportFail: false, canAdjust: true, writes: [] as Record<string, unknown>[] };
  await page.route("**/api/v1/media/videos/901/review-watch/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS") return route.fallback();
    if (path.endsWith("/report/") && state.reportFail) return route.fulfill({ status: 503, json: { detail: "합성 기록 갱신 실패" } });
    if (path.endsWith("/report/")) return route.fulfill({ json: { enabled: true, duration: 3600, threshold_ms: 5_040_000,
      students: [{ student_id: 501, student_name: studentName, used_ms: state.used, started_at: state.used ? "2026-11-01T00:00:00Z" : null, applicable: true, can_adjust: state.canAdjust,
        limit_ms: state.limit, remaining_ms: Math.max(0, state.limit - state.used), exhausted: state.used >= state.limit, revision: state.revision }],
    } });
    if (path.endsWith("/students/501/allowance/") && route.request().method() === "PATCH") {
      const body = route.request().postDataJSON(); state.writes.push(body);
      const summary = () => ({ enabled: true, applicable: true, limit_ms: state.limit, used_ms: state.used,
        remaining_ms: Math.max(0, state.limit - state.used), exhausted: state.used >= state.limit, revision: state.revision });
      if (state.fail) return route.fulfill({ status: 503, json: { detail: "합성 저장 실패" } });
      if (body.expected_revision !== state.revision) return route.fulfill({ status: 409, json: summary() });
      state.limit = body.limit_ms ?? 5_040_000;
      state.revision = `${state.revision}-next`;
      return route.fulfill({ json: summary() });
    }
    return route.fallback();
  });
  return state;
}

for (const width of [1366, 390]) {
  test(`teacher adjusts review allowance with saved usage preserved and retry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await installAllowance(page);
    await page.goto(`${BASE}${width === 390 ? "/workspace/mobile" : "/workspace"}/videos/901/logs/501`);
    const editor = page.getByRole("region", { name: "학생 복습 한도 조정" });
    await editor.getByRole("button", { name: "복습 한도 조정", exact: true }).click();
    await editor.getByRole("button", { name: "+10분", exact: true }).click();
    await expect(editor).toContainText("남음 10분 0초");
    state.fail = true;
    await editor.getByRole("button", { name: "한도 저장", exact: true }).click();
    await expect(editor.getByRole("alert")).toContainText("저장 결과를 확인하지 못했습니다");
    await expect(editor.getByLabel("총 허용시간 (분 또는 분:초)")).toHaveValue("94:00");
    state.fail = false;
    await editor.getByRole("button", { name: "한도 저장", exact: true }).click();
    await expect(editor.getByRole("status")).toContainText("복습 한도를 저장했습니다");
    expect(state.writes).toEqual([{ limit_ms: 5_640_000, expected_revision: "allowance-1" }, { limit_ms: 5_640_000, expected_revision: "allowance-1" }]);
    expect(state.used).toBe(5_040_000);
    await page.reload();
    await expect(page.getByRole("region", { name: "복습 시청시간", exact: true })).toContainText("10분 0초 남음");
    await page.screenshot({ path: `test-results/teacher-video-allowance-${width}.png`, fullPage: true });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await editor.getByRole("button", { name: "복습 한도 조정", exact: true }).click();
    await editor.getByLabel("총 허용시간 (분 또는 분:초)").fill("0");
    await expect(editor).toContainText("추가 복습 재생이 중단됩니다");
    await editor.getByRole("button", { name: "한도 저장", exact: true }).click();
    await expect(editor.getByRole("status")).toBeVisible();
    expect(state.limit).toBe(0); expect(state.used).toBe(5_040_000);
    await editor.getByRole("button", { name: "복습 한도 조정", exact: true }).click();
    await editor.getByRole("button", { name: "기본 1.4배 적용", exact: true }).click();
    await editor.getByRole("button", { name: "한도 저장", exact: true }).click();
    await expect(editor.getByRole("status")).toBeVisible();
    expect(state.writes.at(-1)?.limit_ms).toBeNull(); expect(state.limit).toBe(5_040_000);
  });
}

test("teacher review allowance rejects stale edits and resumes with the current revision", async ({ page }) => {
  const state = await installAllowance(page);
  await page.goto(`${BASE}/workspace/videos/901/logs/501`);
  const editor = page.getByRole("region", { name: "학생 복습 한도 조정" });
  await editor.getByRole("button", { name: "복습 한도 조정", exact: true }).click();
  await editor.getByRole("button", { name: "+30분", exact: true }).click();
  state.limit = 6_000_000; state.revision = "another-teacher";
  await editor.getByRole("button", { name: "한도 저장", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("다른 선생님");
  await expect(editor.getByRole("button", { name: "한도 저장", exact: true })).toBeDisabled();
  expect(state.limit).toBe(6_000_000);
  await editor.getByRole("button", { name: "현재 한도로 다시 편집", exact: true }).click();
  await expect(editor.getByLabel("총 허용시간 (분 또는 분:초)")).toHaveValue("100:00");
  await editor.getByRole("button", { name: "+10분", exact: true }).click();
  await editor.getByRole("button", { name: "한도 저장", exact: true }).click();
  await expect(editor.getByRole("status")).toBeVisible();
  expect(state.writes.at(-1)).toEqual({ limit_ms: 6_600_000, expected_revision: "another-teacher" });
});

test("unused students remain visible and exhausted filter uses the current allowance", async ({ page }) => {
  const state = await installAllowance(page);
  state.used = 0;
  await page.goto(`${BASE}/workspace/videos/901/logs`);
  const row = page.getByRole("link").filter({ hasText: studentName });
  await expect(row).toBeVisible();
  await page.getByLabel("시간 소진 학생만").check();
  await expect(row).toHaveCount(0);
  state.limit = 0;
  await page.reload();
  await expect(page.getByLabel("시간 소진 학생만")).toBeChecked();
  await expect(row).toContainText("시간 소진");
  await row.click();
  const editor = page.getByRole("region", { name: "학생 복습 한도 조정" });
  await editor.getByRole("button", { name: "복습 한도 조정", exact: true }).click();
  await editor.getByRole("button", { name: "+10분", exact: true }).click();
  await editor.getByRole("button", { name: "한도 저장", exact: true }).click();
  await expect(editor.getByRole("status")).toBeVisible();
  expect(state.used).toBe(0);
  await page.getByRole("link", { name: "← 학생 목록으로" }).click();
  await expect(row).toHaveCount(0);
  await page.getByLabel("시간 소진 학생만").uncheck();
  await row.click();
  state.canAdjust = false;
  await page.reload();
  await expect(editor.getByRole("button", { name: "복습 한도 조정", exact: true })).toHaveCount(0);
  await expect(editor).toContainText("현재 수강·시청 권한을 확인");
});

test("allowance edits survive failed save and failed background report refresh", async ({ page }) => {
  const state = await installAllowance(page);
  await page.goto(`${BASE}/workspace/videos/901/logs/501`);
  const editor = page.getByRole("region", { name: "학생 복습 한도 조정" });
  await editor.getByRole("button", { name: "복습 한도 조정", exact: true }).click();
  await editor.getByLabel("총 허용시간 (분 또는 분:초)").fill("101:30");
  state.fail = true; state.reportFail = true;
  await editor.getByRole("button", { name: "한도 저장", exact: true }).click();
  await expect(page.getByText("최신 기록을 불러오지 못했습니다. 마지막으로 확인한 기록과 입력을 유지하고 있습니다.")).toBeVisible();
  await expect(editor.getByLabel("총 허용시간 (분 또는 분:초)")).toHaveValue("101:30");
  await expect(editor.getByRole("alert")).toContainText("저장 결과를 확인하지 못했습니다");
  state.fail = false; state.reportFail = false;
  await editor.getByRole("button", { name: "한도 저장", exact: true }).click();
  await expect(editor.getByRole("status")).toBeVisible();
  await expect(page.getByRole("region", { name: "복습 시청시간", exact: true })).toContainText("17분 30초 남음");
  await page.reload();
  await expect(page.getByRole("region", { name: "복습 시청시간", exact: true })).toContainText("17분 30초 남음");
  expect(state.used).toBe(5_040_000);
});

test("quick additions preserve exact server milliseconds and successful save survives report failure", async ({ page }) => {
  const state = await installAllowance(page);
  state.limit = 841400; state.used = 0;
  await page.goto(`${BASE}/workspace/videos/901/logs/501`);
  const editor = page.getByRole("region", { name: "학생 복습 한도 조정" });
  await editor.getByRole("button", { name: "복습 한도 조정", exact: true }).click();
  await editor.getByRole("button", { name: "+10분", exact: true }).click();
  state.reportFail = true;
  await editor.getByRole("button", { name: "한도 저장", exact: true }).click();
  await expect(editor.getByRole("status")).toBeVisible();
  expect(state.writes[0]?.limit_ms).toBe(1441400);
  await expect(page.getByRole("region", { name: "복습 시청시간", exact: true })).toContainText("사용 0분 0초 / 허용 24분 1초");
  state.reportFail = false;
  await page.getByRole("button", { name: "최신 기록 다시 불러오기" }).click();
  await expect(page.getByText("최신 기록을 불러오지 못했습니다.", { exact: false })).toHaveCount(0);
});

async function install(page: Page, state: MockState = { reportFailure: false, activityFailure: false }) {
  await installTenantOneInitScript(page);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
  await page.addInitScript(access => { localStorage.setItem("access", access); localStorage.setItem("refresh", `${access}-refresh`); }, token);
  const requests: string[] = [];
  const video = { id: 901, session: 801, session_id: 801, title, duration: 3600, status: "READY", source_type: "file", order: 1, allow_skip: true, max_speed: 2, show_watermark: false, created_at: "2026-11-01T00:00:00Z" };
  const handler = async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "검증 학원", feature_flags: {}, is_active: true });
    if (path === "/core/me/") return json({ id: 12, username: "admin", name: "검증 선생님", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false });
    if (path === "/media/videos/901/") return json(video);
    if (path === "/media/videos/901/stats/") return json({ video, students: [{ enrollment: 7001, student_id: 501, student_name: studentName, progress: 0.5, completed: false, access_mode: "FREE_REVIEW", effective_rule: "free" }] });
    if (state.reportFailure && path === "/media/videos/901/review-watch/report/") return route.fulfill({ status: 503, contentType: "application/json", body: '{"detail":"temporary failure"}' });
    if (path === "/media/videos/901/review-watch/report/") return json({ enabled: false, duration: state.durationMissing ? null : 3600, threshold_ms: state.durationMissing ? 0 : 5040000, students: [
      { student_id: 501, student_name: studentName, used_ms: 6300000, started_at: "2026-11-01T00:00:00Z" },
      { student_id: 502, student_name: "두번째학생", used_ms: 60000, started_at: "2026-11-02T00:00:00Z" },
    ] });
    if (path === "/media/video-playback-events/") {
      requests.push(url.search);
      if (state.activityFailure) return route.fulfill({ status: 503, contentType: "application/json", body: '{"detail":"temporary failure"}' });
      return json({ count: 1, results: [{ id: 1, student_name: studentName, event_type: "SEEK_ATTEMPT", violated: true, violation_reason: "seek_not_allowed", occurred_at: "2026-11-03T00:00:00Z", event_payload: { from: 10, to: 30 }, policy_snapshot: { allow_skip: false } }] });
    }
    if (path === "/media/videos/901/engagement/") return json({ view_count: 0, like_count: 0, comment_count: 0 });
    if (path === "/media/videos/901/comments/") return json({ comments: [], total: 0 });
    if (path === "/lectures/701/") return json({ id: 701, title: "검증 강의", name: "검증 강의" });
    if (path === "/lectures/sessions/801/") return json({ id: 801, lecture: 701, title: "1차시", order: 1 });
    if (path === "/media/videos/public-session/") return json(null);
    return json([]);
  };
  await page.route("**/api/v1/**", handler);
  return requests;
}

for (const width of [1366, 390]) {
  test(`시청 로그 진입 → 학생 상세 → 새로고침과 목록 복귀 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const requests = await install(page);
    await page.goto(`${BASE}${DETAIL}`);
    const logsEntry = page.getByRole("region", { name: "학생 시청 현황" }).getByRole("button", { name: "시청 로그", exact: true });
    await expect(logsEntry).toBeVisible({ timeout: 60_000 });
    await logsEntry.click();
    await expect(page.getByRole("heading", { name: "시청 로그", exact: true })).toBeVisible();
    expect(requests).toHaveLength(0);
    await page.getByLabel("원본의 1.4배 이상만").check();
    await page.getByRole("searchbox", { name: "학생 이름 검색" }).fill("누적시간");
    const row = page.getByRole("link").filter({ hasText: studentName });
    await expect(row).toContainText("1시간 45분 0초");
    await expect(row).toContainText("1.75배");
    await row.click();
    await expect(page.getByRole("heading", { name: `${studentName} · 시청 상세` })).toBeVisible();
    await expect(page.getByRole("region", { name: "학생 누적 재생 요약" })).toContainText("꺼짐");
    await expect.poll(() => requests.some(search => new URLSearchParams(search).get("student") === "501")).toBe(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: `${studentName} · 시청 상세` })).toBeVisible();
    await page.getByText("재생 위치 이동 시도", { exact: true }).click();
    await expect(page.getByText("원본 기록 보기", { exact: true })).toBeVisible();
    await page.getByText("원본 기록 보기", { exact: true }).click();
    await expect(page.locator("pre")).toContainText('"from": 10');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/watch-log-detail-${width}.png`, fullPage: true });
    await page.getByRole("link", { name: "← 학생 목록으로" }).click();
    await expect(page.getByRole("searchbox", { name: "학생 이름 검색" })).toHaveValue("누적시간");
    await expect(page.getByLabel("원본의 1.4배 이상만")).toBeChecked();
    await page.screenshot({ path: `test-results/watch-log-list-${width}.png`, fullPage: true });
    await page.getByRole("link", { name: "영상 상세", exact: true }).click();
    await expect(page.getByRole("region", { name: "학생 시청 현황" })).toBeVisible();
  });
}

test("간편 업무 로그에서 학생 상세와 영상으로 돌아가기", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await install(page);
  await page.goto(`${BASE}/workspace/mobile/videos/901`);
  await expect(page.getByRole("link", { name: "시청 로그" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: "시청 로그" }).click();
  await expect(page).toHaveURL(/\/workspace\/mobile\/videos\/901\/logs/);
  await page.getByRole("link").filter({ hasText: studentName }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: `${studentName} · 시청 상세` })).toBeVisible();
  await page.getByRole("link", { name: "영상 상세", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/mobile\/videos\/901$/);
});

test("조회 실패는 빈 기록과 구분하고 필터를 보존해 복구한다", async ({ page }) => {
  const state = { reportFailure: true, activityFailure: true };
  await install(page, state);
  await page.goto(`${BASE}/workspace/videos/901/logs?q=${encodeURIComponent("누적시간")}&reached=1`);
  await expect(page.getByRole("heading", { name: "시청 로그", exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("alert")).toContainText("시청 기록을 불러오지 못했습니다");
  await expect(page.getByText("아직 누적 재생 기록이 없습니다")).toHaveCount(0);
  state.reportFailure = false;
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "학생 이름 검색" })).toHaveValue("누적시간");
  await page.getByRole("link").filter({ hasText: studentName }).click();
  await expect(page.getByRole("alert")).toContainText("활동 기록을 불러오지 못했습니다");
  state.activityFailure = false;
  await page.getByRole("button", { name: "활동 기록 다시 불러오기" }).click();
  await expect(page.getByText("재생 위치 이동 시도", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "← 학생 목록으로" }).click();
  await page.getByRole("searchbox", { name: "학생 이름 검색" }).fill("찾을수없는이름");
  await expect(page.getByRole("heading", { name: "조건에 맞는 학생이 없습니다" })).toBeVisible();
  await page.getByRole("button", { name: "필터 초기화" }).click();
  await expect(page.getByRole("link").filter({ hasText: "두번째학생" })).toBeVisible();
});

test("원본 길이 미확인 영상도 누적 시간을 확인할 수 있다", async ({ page }) => {
  await install(page, { reportFailure: false, activityFailure: false, durationMissing: true });
  await page.goto(`${BASE}/workspace/videos/901/logs?reached=1`);
  await expect(page.getByRole("heading", { name: "시청 로그", exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByLabel("원본의 1.4배 이상만")).toBeDisabled();
  await expect(page.getByText("원본 길이를 확인하면 배율로 비교할 수 있습니다.")).toBeVisible();
  await expect(page.getByRole("link").filter({ hasText: studentName })).toContainText("1시간 45분 0초");
  await page.getByRole("link").filter({ hasText: studentName }).click();
  await expect(page.getByRole("region", { name: "학생 누적 재생 요약" })).toContainText("원본 길이 미확인");
});
