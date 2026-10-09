import { expect, test, type Page } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5194";
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local synthetic API only");
test.use({ serviceWorkers: "block" });

async function setup(page: Page, kind: "exam" | "homework", failSecond = false) {
  await installTenantOneInitScript(page);
  const jwt = `e30.${Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url")}.signature`;
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, jwt);
  const label = kind === "exam" ? "시험" : "과제";
  const lecture = { id: 71, title: "QA 평가 강의", name: "QA 교사", is_active: true, subject: "수학" };
  const sessions = [72, 73, 74].map((id, index) => ({ id, lecture: 71, title: ["원본 차시", "대상 차시", "단일 자료 차시"][index],
    order: index + 1, regular_order: index + 1, session_type: "REGULAR", date: "2026-10-01", section: null }));
  const rows = Array.from({ length: 501 }, (_, index) => ({
    id: 1000 + index, title: `QA ${label} ${String(index + 1).padStart(3, "0")}`, session_id: 72,
    exam_type: "regular", homework_type: "regular", max_score: 100, pass_score: 80,
    grading_mode: "SCORE", effective_cutline_mode: "PERCENT", effective_cutline_value: 80,
    created_at: "2026-10-01T09:00:00+09:00",
  }));
  const state = { failSecond, failLectures: false, failSessions: false, pages: [] as number[], created: [] as Record<string, unknown>[] };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = route.request().method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "QA 학원", is_active: true, feature_flags: {} });
    if (path === "/core/me/") return json({ id: 12, name: "QA 교사", username: "qa-owner", tenantRole: "owner", is_staff: true, must_change_password: false, first_login_guide_required: false });
    if (path === "/core/subscription/") return json({ plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 });
    if (path === "/results/admin/dashboard-counts/") return json({ video_failed: 0, qna_pending: 0, counsel_pending: 0, submission_pending: 0 });
    if (path === "/lectures/lectures/") return state.failLectures ? json({ detail: "QA lecture failure" }, 400) : json([lecture]);
    if (path === "/lectures/lectures/71/") return json(lecture);
    if (path === "/lectures/sessions/") return state.failSessions ? json({ detail: "QA session failure" }, 400) : json(sessions);
    if (/^\/lectures\/sessions\/(72|73)\/$/.test(path)) return json(sessions.find((session) => path.includes(`/${session.id}/`)));
    if (/^\/results\/admin\/sessions\/\d+\/exams\/summary\/$/.test(path)) return json({ exams: kind === "exam" ? state.created : [] });
    if (/^\/results\/admin\/sessions\/\d+\/exams\/$/.test(path)) return json(kind === "exam" ? state.created : []);
    if (path === (kind === "exam" ? "/exams/" : "/homeworks/")) {
      if (method === "POST") {
        const payload = route.request().postDataJSON() as Record<string, unknown>;
        const created = { ...payload, id: 9001 + state.created.length, exam_type: "regular" };
        state.created.push(created);
        return json(created, 201);
      }
      if (url.searchParams.get("session_id") === "74") return json({ count: 1, next: null, results: [{ ...rows[0], id: 1700, title: `다음 차시 ${label}`, session_id: 74 }] });
      if (url.searchParams.get("session_id") !== "72") return json({ count: state.created.length, next: null, results: state.created });
      const pageNumber = Number(url.searchParams.get("page") || 1);
      const size = Math.min(500, Number(url.searchParams.get("page_size") || 20));
      state.pages.push(pageNumber);
      if (state.failSecond && pageNumber === 2) return json({ detail: "QA page failure" }, 400);
      return json({ count: rows.length, next: pageNumber * size < rows.length ? `?page=${pageNumber + 1}` : null,
        results: rows.slice((pageNumber - 1) * size, pageNumber * size) });
    }
    if (/^\/(exams|homeworks)\/9001\/$/.test(path)) return json(state.created[0] || {});
    if (path.endsWith("/enrollments/") && method === "PUT") return json({ selected_count: 0 });
    return json({ count: 0, results: [] });
  });
  return state;
}

for (const width of [390, 1366]) {
  test(`관리자 시험 목록은 다음 페이지까지 표시한다 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await setup(page, "exam", true);
    await gotoAndSettle(page, `${BASE}/workspace/exams`);
    await expect(page.getByText("시험 목록을 불러올 수 없습니다", { exact: true })).toBeVisible();
    await expect(page.getByText("QA 시험 001", { exact: true })).toHaveCount(0);
    state.failSecond = false;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(page.getByText("QA 시험 501", { exact: true })).toBeVisible();
    expect(state.pages.slice(-2)).toEqual([1, 2]);
    await page.reload();
    await expect(page.getByText("QA 시험 501", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });

  for (const kind of ["exam", "homework"] as const) {
    for (const failSecond of [false, true]) {
      test(`평가 복사는 검색 결과만 선택하고 목록 오류를 복구한다 ${width}px ${kind} failure=${failSecond}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const state = await setup(page, kind, failSecond);
        const label = kind === "exam" ? "시험" : "과제";
        await gotoAndSettle(page, `${BASE}/workspace/lectures/71/sessions/73/${kind === "exam" ? "exams" : "assignments"}`);
        await page.getByRole("button", { name: `${label} 추가`, exact: true }).first().click();
        const dialog = page.getByRole("dialog").filter({ hasText: "다른 차시에서 복사" });
        await dialog.getByText("다른 차시에서 복사", { exact: true }).click();
        await dialog.getByRole("combobox", { name: "강의 선택", exact: true }).selectOption("71");
        await dialog.getByRole("combobox", { name: "차시 선택", exact: true }).selectOption("72");
        if (failSecond) {
          await expect(dialog.getByText(`${label} 목록을 불러오지 못했습니다.`, { exact: false })).toBeVisible();
          await expect(dialog.getByRole("button", { name: "불러오기", exact: true })).toHaveCount(0);
          expect(state.created).toHaveLength(0);
          state.failSecond = false;
          await dialog.getByRole("button", { name: "목록 다시 불러오기", exact: true }).click();
        }
        await dialog.getByRole("textbox", { name: "항목 검색", exact: true }).fill(`QA ${label} 501`);
        await expect(dialog.getByText(`QA ${label} 501`, { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "검색 결과 선택", exact: true }).click();
        await expect(dialog.getByText("1개 선택됨", { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "검색 결과 해제", exact: true }).click();
        await expect(dialog.getByRole("button", { name: "불러오기", exact: true })).toHaveCount(0);
        await dialog.getByRole("button", { name: "검색 결과 선택", exact: true }).click();
        if (!failSecond) await page.screenshot({ path: test.info().outputPath(`assessment-copy-${kind}-${width}.png`), animations: "disabled" });
        await dialog.getByRole("button", { name: "불러오기", exact: true }).click();
        await expect.poll(() => state.created.length).toBe(1);
        expect(state.created[0]).toMatchObject({ title: `QA ${label} 501`, session_id: 73 });
        if (kind === "exam") expect(state.created[0].source_exam_id).toBe(1500);
        expect(state.pages).toContain(2);
        await expect(dialog).toHaveCount(0);
        await expect(page.getByText(`QA ${label} 501`, { exact: true }).first()).toBeVisible();
        await page.reload();
        await expect(page.getByText(`QA ${label} 501`, { exact: true }).first()).toBeVisible();
        expect(state.created).toHaveLength(1);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      });
    }

    test(`평가 복사 검색과 강의·차시 전환은 이전 선택을 격리한다 ${width}px ${kind}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const state = await setup(page, kind);
      const label = kind === "exam" ? "시험" : "과제";
      await gotoAndSettle(page, `${BASE}/workspace/lectures/71/sessions/73/${kind === "exam" ? "exams" : "assignments"}`);
      await page.getByRole("button", { name: `${label} 추가`, exact: true }).first().click();
      const dialog = page.getByRole("dialog").filter({ hasText: "다른 차시에서 복사" });
      state.failLectures = true;
      await dialog.getByText("다른 차시에서 복사", { exact: true }).click();
      await expect(dialog.getByText("강의 목록을 불러오지 못했습니다.", { exact: false })).toBeVisible();
      state.failLectures = false;
      await dialog.getByRole("button", { name: "강의 다시 불러오기", exact: true }).click();
      state.failSessions = true;
      await dialog.getByRole("combobox", { name: "강의 선택", exact: true }).selectOption("71");
      await expect(dialog.getByText("차시 목록을 불러오지 못했습니다.", { exact: false })).toBeVisible();
      state.failSessions = false;
      await dialog.getByRole("button", { name: "차시 다시 불러오기", exact: true }).click();
      await dialog.getByRole("combobox", { name: "차시 선택", exact: true }).selectOption("72");
      const search = dialog.getByRole("textbox", { name: "항목 검색", exact: true });
      await search.fill(`QA ${label} 001`);
      await dialog.getByRole("button", { name: "검색 결과 선택", exact: true }).click();
      await search.fill(`QA ${label} 501`);
      await dialog.getByRole("button", { name: "검색 결과 선택", exact: true }).click();
      await expect(dialog.getByText("2개 선택됨", { exact: true })).toBeVisible();
      await dialog.getByRole("button", { name: "검색 결과 해제", exact: true }).click();
      await expect(dialog.getByText("1개 선택됨", { exact: true })).toBeVisible();
      await search.fill(`QA ${label} 001`);
      await expect(dialog.getByRole("checkbox")).toBeChecked();
      await dialog.getByRole("combobox", { name: "차시 선택", exact: true }).selectOption("74");
      await expect(dialog.getByText(`다음 차시 ${label}`, { exact: true })).toBeVisible();
      await expect(dialog.getByRole("checkbox")).not.toBeChecked();
      await expect(dialog.getByRole("button", { name: "불러오기", exact: true })).toHaveCount(0);
      await dialog.getByRole("checkbox").check();
      await dialog.getByRole("combobox", { name: "강의 선택", exact: true }).selectOption("");
      await expect(dialog.getByRole("combobox", { name: "차시 선택", exact: true })).toHaveCount(0);
      await expect(dialog.getByText(`다음 차시 ${label}`, { exact: true })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "불러오기", exact: true })).toHaveCount(0);
      expect(state.created).toHaveLength(0);
    });
  }
}
