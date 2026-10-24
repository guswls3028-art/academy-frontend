import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const LECTURE = 9965;
const students = Array.from({ length: 205 }, (_, index) => ({
  id: index + 1, name: `기존학생${String(index + 1).padStart(3, "0")}`,
  parent_phone: `0108000${String(index + 1).padStart(4, "0")}`,
  phone: null, high_school: "아주긴이름의고등학교", grade: 2,
  is_managed: true, enrollments: [],
}));

type State = {
  statuses: Map<number, string>;
  posts: Array<{ lecture: number; students: number[] }>;
  unexpectedWrites: string[];
  failRoster: boolean;
  failSave: boolean;
  failReadback: boolean;
};

async function openPicker(page: Page) {
  const state: State = {
    statuses: new Map([[1, "ACTIVE"], [2, "INACTIVE"], [3, "PENDING"]]),
    posts: [], unexpectedWrites: [], failRoster: false, failSave: false, failReadback: false,
  };
  await installTenantOneInitScript(page);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, token);
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", isPlatformAdmin: true, display_name: "학원플러스", feature_flags: {}, is_active: true });
    if (path === "/core/me/") return json({ id: 12, username: "admin", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false });
    if (path === `/lectures/lectures/${LECTURE}/`) return json({ id: LECTURE, title: "기말고사 새 강의", name: "기말고사 새 강의", is_active: true });
    if (path === "/enrollments/bulk_create/" && request.method() === "POST") {
      const body = request.postDataJSON() as { lecture: number; students: number[] };
      state.posts.push(body);
      if (state.failSave) return json({ detail: "일시적인 등록 실패" }, 400);
      body.students.forEach((id) => state.statuses.set(id, "ACTIVE"));
      return json(body.students.map((id) => ({ id: 1000 + id, status: "ACTIVE", student: students[id - 1] })), 201);
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      if (/^\/(?:lectures|enrollments|students)\//.test(path)) state.unexpectedWrites.push(`${request.method()} ${path}`);
      return json({});
    }
    if (path === "/students/") {
      const search = url.searchParams.get("search") ?? "";
      const found = students.filter((student) => student.name.includes(search) || student.parent_phone.includes(search));
      const pageNumber = Number(url.searchParams.get("page") || 1);
      return json({ count: found.length, page_size: 50, results: found.slice((pageNumber - 1) * 50, pageNumber * 50) });
    }
    if (path === "/enrollments/") {
      if (state.failRoster || (state.failReadback && state.posts.length)) return json({ count: 1, results: [], next: null });
      return json([...state.statuses].map(([id, status]) => ({ id: 1000 + id, status, student: students[id - 1] })));
    }
    if (path === "/lectures/attendance/matrix/") return json({
      lecture: { id: LECTURE, title: "기말고사 새 강의" }, sessions: [],
      students: [], // The real matrix omits students without a session assignment.
    });
    return json({ count: 0, results: [], next: null });
  });
  await page.goto(`${BASE}/workspace/lectures/${LECTURE}`);
  await page.getByRole("button", { name: "수강생 등록", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "수강생 등록", exact: true });
  await expect(dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true })).toBeEnabled();
  return { state, dialog };
}

for (const width of [1366, 1100, 390]) {
  test(`${width}px 차시 없이 기존 학생을 검색·다중 선택하고 저장·reload한다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { state, dialog } = await openPicker(page);
    await expect(dialog.getByRole("checkbox", { name: "기존학생001 선택", exact: true })).toBeDisabled();
    await dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true }).check();
    await dialog.getByRole("checkbox", { name: "기존학생003 선택", exact: true }).check();
    await dialog.getByRole("button", { name: "다음", exact: true }).click();
    await dialog.getByRole("checkbox", { name: "기존학생051 선택", exact: true }).check();
    await dialog.getByRole("textbox", { name: "학생 검색" }).fill("010-8000-0052");
    await dialog.getByRole("checkbox", { name: "기존학생052 선택", exact: true }).check();
    await expect(dialog.getByRole("status")).toHaveText("4명 선택");
    await dialog.screenshot({ path: info.outputPath(`lecture-picker-${width}.png`) });
    await dialog.getByRole("textbox", { name: "학생 검색" }).fill("없는학생");
    await expect(dialog.getByText("검색 결과가 없습니다", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "4명 강의에 추가", exact: true })).toBeEnabled();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    await expect.poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await dialog.getByRole("button", { name: "4명 강의에 추가", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(state.posts).toEqual([{ lecture: LECTURE, students: [2, 3, 51, 52] }]);
    expect(state.unexpectedWrites).toEqual([]);
    await page.reload();
    for (const id of [2, 3, 51, 52]) await expect(page.getByText(students[id - 1].name, { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "수강생 등록", exact: true }).first().click();
    await expect(dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("status")).toHaveText("0명 선택");
  });
}

test("저장 확인 실패 후 선택을 보존하고 중복 없이 재시도한다", async ({ page }) => {
  const { state, dialog } = await openPicker(page);
  await dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true }).check();
  state.failReadback = true;
  await dialog.getByRole("button", { name: "1명 강의에 추가", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("저장된 명단을 확인하지 못했습니다");
  await expect(dialog.getByRole("status")).toHaveText("1명 선택");
  state.failReadback = false;
  await dialog.getByRole("button", { name: "1명 강의에 추가", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.posts).toHaveLength(2);
  expect([...state.statuses].filter(([id, status]) => id === 2 && status === "ACTIVE")).toHaveLength(1);
});

test("검색 후 일괄 선택과 이탈 취소, 200명 한도를 지킨다", async ({ page }) => {
  const { dialog } = await openPicker(page);
  await dialog.getByRole("button", { name: "현재 페이지 선택", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("49명 선택");
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "취소", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("49명 선택");
  for (const first of [51, 101, 151]) {
    await dialog.getByRole("button", { name: "다음", exact: true }).click();
    await expect(dialog.getByRole("checkbox", { name: `기존학생${String(first).padStart(3, "0")} 선택`, exact: true })).toBeEnabled();
    await dialog.getByRole("button", { name: "현재 페이지 선택", exact: true }).click();
  }
  await expect(dialog.getByRole("status")).toHaveText("199명 선택");
  await dialog.getByRole("button", { name: "다음", exact: true }).click();
  await dialog.getByRole("checkbox", { name: "기존학생201 선택", exact: true }).check();
  await dialog.getByRole("checkbox", { name: "기존학생202 선택", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "기존학생202 선택", exact: true })).not.toBeChecked();
  await expect(dialog.getByText(/한 번에 200명까지 등록할 수 있습니다/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "200명 강의에 추가", exact: true })).toBeEnabled();
});

test("명단 불완전 응답과 등록 실패를 표시하고 선택을 보존해 복구한다", async ({ page }) => {
  const { state, dialog } = await openPicker(page);
  await dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true }).check();
  state.failSave = true;
  const failure = page.waitForResponse((response) => response.url().endsWith("/enrollments/bulk_create/") && response.status() === 400);
  await dialog.getByRole("button", { name: "1명 강의에 추가", exact: true }).click();
  await failure;
  await expect(dialog.getByRole("alert")).toContainText("등록을 완료하지 못했습니다");
  await expect(dialog.getByRole("status")).toHaveText("1명 선택");
  state.failSave = false;
  await dialog.getByRole("button", { name: "1명 강의에 추가", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  state.failRoster = true;
  await page.getByRole("button", { name: "수강생 등록", exact: true }).first().click();
  await expect(dialog.getByText("학생 명단을 불러오지 못했습니다", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByRole("button", { name: "0명 강의에 추가", exact: true })).toBeDisabled();
  state.failRoster = false;
  await dialog.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("checkbox", { name: "기존학생003 선택", exact: true })).toBeEnabled();
});
