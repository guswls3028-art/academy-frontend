import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { waitForRenderSettled } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const LECTURE = 9965;
const students = Array.from({ length: 205 }, (_, index) => ({
  id: index + 1, name: `기존학생${String(index + 1).padStart(3, "0")}`,
  parent_phone: `0108000${String(index + 1).padStart(4, "0")}`,
  phone: null, high_school: "아주긴이름의고등학교", middle_school: "", elementary_school: "", school_type: "HIGH", grade: 2,
  is_managed: true, enrollments: [],
}));

type State = {
  statuses: Map<number, string>;
  posts: Array<{ lecture: number; students: number[] }>;
  unexpectedWrites: string[];
  failRoster: boolean;
  failSave: boolean;
  failReadback: boolean;
  saveGate: Promise<void> | null;
  searchGate: Promise<void> | null;
  searchRequests: Array<{ search: string; page: number; schoolType?: string; grade?: number }>;
  failSearch: boolean;
  matrixGate: Promise<void> | null;
};

async function openPicker(page: Page, names: Record<number, string> = {},
  options: { schools?: Record<number, Partial<typeof students[number]>>; elementary?: boolean } = {}) {
  const roster = students.map((student) => ({ ...student, name: names[student.id] ?? student.name, ...options.schools?.[student.id] }));
  const state: State = {
    statuses: new Map([[1, "ACTIVE"], [2, "INACTIVE"], [3, "PENDING"]]),
    posts: [], unexpectedWrites: [], failRoster: false, failSave: false, failReadback: false, saveGate: null,
    searchGate: null, searchRequests: [], failSearch: false, matrixGate: null,
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
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", isPlatformAdmin: true, display_name: "학원플러스", feature_flags: options.elementary ? { school_level_mode: "elementary_middle" } : {}, is_active: true });
    if (path === "/core/me/") return json({ id: 12, username: "admin", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false });
    if (path === "/staffs/currently-working/") return json([]);
    if (path === `/lectures/lectures/${LECTURE}/`) return json({ id: LECTURE, title: "기말고사 새 강의", name: "기말고사 새 강의", is_active: true });
    if (path === "/enrollments/bulk_create/" && request.method() === "POST") {
      const body = request.postDataJSON() as { lecture: number; students: number[] };
      state.posts.push(body);
      if (state.saveGate) await state.saveGate;
      if (state.failSave) return json({ detail: "일시적인 등록 실패" }, 400);
      body.students.forEach((id) => state.statuses.set(id, "ACTIVE"));
      return json(body.students.map((id) => ({ id: 1000 + id, status: "ACTIVE", student: roster[id - 1] })), 201);
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      if (/^\/(?:lectures|enrollments|students)\//.test(path)) state.unexpectedWrites.push(`${request.method()} ${path}`);
      return json({});
    }
    if (path === "/students/") {
      const search = url.searchParams.get("search") ?? "";
      const pageNumber = Number(url.searchParams.get("page") || 1);
      const schoolType = url.searchParams.get("school_type");
      const grade = Number(url.searchParams.get("grade"));
      state.searchRequests.push({ search, page: pageNumber, ...(schoolType ? { schoolType } : {}), ...(grade ? { grade } : {}) });
      if ((search || schoolType || grade) && state.searchGate) await state.searchGate;
      if ((search || schoolType || grade) && state.failSearch) return json({ detail: "검색 실패" }, 503);
      const found = roster.filter((student) =>
        (!schoolType || student.school_type === schoolType) && (!grade || student.grade === grade)
        && [student.name, student.parent_phone, student.high_school, student.middle_school, student.elementary_school].some((value) => value.includes(search)));
      return json({ count: found.length, page_size: 50, results: found.slice((pageNumber - 1) * 50, pageNumber * 50) });
    }
    if (path === "/enrollments/") {
      if (state.failRoster || (state.failReadback && state.posts.length)) return json({ count: 1, results: [], next: null });
      return json([...state.statuses].map(([id, status]) => ({ id: 1000 + id, status, student: roster[id - 1] })));
    }
    if (path === "/lectures/attendance/matrix/") {
      if (state.matrixGate) await state.matrixGate;
      return json({ lecture: { id: LECTURE, title: "기말고사 새 강의" }, sessions: [], students: [] });
    }
    return json({ count: 0, results: [], next: null });
  });
  await page.goto(`${BASE}/workspace/lectures/${LECTURE}`);
  await waitForRenderSettled(page);
  await page.getByRole("button", { name: "수강생 등록", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "수강생 등록", exact: true });
  await expect(dialog.getByRole("checkbox", { name: `${roster[1].name} 선택`, exact: true }).first()).toBeEnabled();
  return { state, dialog };
}

for (const width of [1366, 390]) {
  test(`${width}px 학교 검색과 학년 조건으로 학생을 구분하고 선택·저장·reload한다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const { state, dialog } = await openPicker(page, {}, { schools: {
      52: { high_school: "언남고등학교", grade: 1 },
      53: { high_school: "언남고등학교", grade: 2 },
      54: { high_school: "", middle_school: "언남중학교", school_type: "MIDDLE", grade: 1 },
    } });
    await dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true }).check();
    await dialog.getByRole("button", { name: "다음", exact: true }).click();
    await expect(dialog.getByText("2 / 5 페이지", { exact: true })).toBeVisible();
    await dialog.getByRole("textbox", { name: "학생 검색" }).fill("언남");
    await expect(dialog.getByText("검색 결과 3명", { exact: true })).toBeVisible();
    await dialog.getByRole("combobox", { name: "학교 구분", exact: true }).selectOption("HIGH");
    await dialog.getByRole("combobox", { name: "학년", exact: true }).selectOption("1");
    await expect(dialog.getByText("검색 결과 1명", { exact: true })).toBeVisible();
    await expect(dialog.getByText("1 / 1 페이지", { exact: true })).toBeVisible();
    await expect(dialog.locator(".lecture-enroll-picker__identity strong")).toHaveText("기존학생052");
    expect(state.searchRequests.at(-1)).toEqual({ search: "언남", schoolType: "HIGH", grade: 1, page: 1 });
    await dialog.getByRole("button", { name: "이 페이지 전체 선택", exact: true }).click();
    await expect(dialog.getByRole("status")).toHaveText("2명 선택");
    await expect(dialog.getByRole("combobox", { name: "학년", exact: true })).toBeInViewport();
    await expect(dialog.getByRole("button", { name: "2명 강의에 추가", exact: true })).toBeInViewport();
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await dialog.screenshot({ path: info.outputPath(`lecture-picker-conditions-${width}.png`) });
    await dialog.getByRole("combobox", { name: "학년", exact: true }).selectOption("2");
    await expect(dialog.locator(".lecture-enroll-picker__identity strong")).toHaveText("기존학생053");
    await dialog.getByRole("button", { name: "이 페이지 전체 선택", exact: true }).click();
    await dialog.getByRole("combobox", { name: "학년", exact: true }).selectOption("3");
    await expect(dialog.getByText("검색 결과가 없습니다", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("status")).toHaveText("3명 선택");
    await dialog.getByRole("button", { name: "조건 초기화", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "학생 검색" })).toHaveValue("언남");
    await expect(dialog.getByText("검색 결과 3명", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: "기존학생054 선택", exact: true })).not.toBeChecked();
    await dialog.getByRole("button", { name: "3명 강의에 추가", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(state.posts).toEqual([{ lecture: LECTURE, students: [2, 52, 53] }]);
    expect(state.unexpectedWrites).toEqual([]);
    await waitForRenderSettled(page);
    await page.reload();
    for (const id of [2, 52, 53]) await expect(page.getByText(students[id - 1].name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("기존학생054", { exact: true })).toHaveCount(0);
  });
}

test("학교급 변경 시 유효하지 않은 초등 학년을 해제하고 조건 조회 실패에서 복구한다", async ({ page }) => {
  const { state, dialog } = await openPicker(page, {}, { elementary: true, schools: {
    52: { high_school: "", elementary_school: "언남초등학교", school_type: "ELEMENTARY", grade: 6 },
    53: { high_school: "", middle_school: "언남중학교", school_type: "MIDDLE", grade: 1 },
  } });
  await dialog.getByRole("combobox", { name: "학교 구분", exact: true }).selectOption("ELEMENTARY");
  await dialog.getByRole("combobox", { name: "학년", exact: true }).selectOption("6");
  await dialog.getByRole("checkbox", { name: "기존학생052 선택", exact: true }).check();
  let finishSearch: () => void = () => {};
  state.searchGate = new Promise<void>((resolve) => { finishSearch = resolve; });
  state.failSearch = true;
  try {
    await dialog.getByRole("combobox", { name: "학교 구분", exact: true }).selectOption("MIDDLE");
    await expect(dialog.getByRole("combobox", { name: "학년", exact: true })).toHaveValue("0");
    await expect(dialog.getByText("검색 중…", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "이 페이지 선택 해제", exact: true })).toBeDisabled();
  } finally { finishSearch(); state.searchGate = null; }
  await expect(dialog.getByText("학생 명단을 불러오지 못했습니다", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByRole("status")).toHaveText("1명 선택");
  state.failSearch = false;
  await dialog.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expect(dialog.locator(".lecture-enroll-picker__identity strong")).toHaveText("기존학생053");
  await dialog.getByRole("checkbox", { name: "기존학생053 선택", exact: true }).check();
  await expect(dialog.getByRole("status")).toHaveText("2명 선택");
  expect(state.searchRequests.at(-1)).toEqual({ search: "", schoolType: "MIDDLE", page: 1 });
});

for (const width of [1366, 1100, 390]) {
  test(`${width}px 차시 없이 기존 학생을 검색·다중 선택하고 저장·reload한다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const { state, dialog } = await openPicker(page);
    await expect(dialog.getByRole("checkbox", { name: "기존학생001 선택", exact: true })).toBeDisabled();
    await dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true }).check();
    await dialog.getByRole("checkbox", { name: "기존학생003 선택", exact: true }).check();
    const searchBox = await dialog.getByRole("textbox", { name: "학생 검색" }).boundingBox();
    expect(searchBox!.height).toBeGreaterThanOrEqual(width === 390 ? 44 : 40);
    const body = dialog.locator(".modal-body");
    expect(await body.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    await expect(dialog.getByRole("textbox", { name: "학생 검색" })).toBeInViewport();
    await expect(dialog.getByRole("button", { name: "2명 강의에 추가", exact: true })).toBeInViewport();
    await dialog.screenshot({ path: info.outputPath(`lecture-picker-list-${width}.png`) });
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
    // Let the roster refresh and shell reads finish before crossing documents.
    // WebKit can report a canceled in-flight mock as an access-control error.
    await waitForRenderSettled(page);
    await page.reload();
    await waitForRenderSettled(page);
    for (const id of [2, 3, 51, 52]) await expect(page.getByText(students[id - 1].name, { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "수강생 등록", exact: true }).first().click();
    await expect(dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("status")).toHaveText("0명 선택");
  });
}

test("저장 확인 실패 후 선택을 보존하고 등록 요청 없이 결과만 재조회한다", async ({ page }) => {
  const { state, dialog } = await openPicker(page);
  await dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true }).check();
  state.failReadback = true;
  await dialog.getByRole("button", { name: "1명 강의에 추가", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("저장된 명단을 확인하지 못했습니다");
  await expect(dialog.getByRole("status")).toHaveText("1명 선택");
  state.failReadback = false;
  await dialog.getByRole("button", { name: "등록 결과 다시 확인", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.posts).toHaveLength(1);
  expect([...state.statuses].filter(([id, status]) => id === 2 && status === "ACTIVE")).toHaveLength(1);
});

test("검색 후 일괄 선택과 이탈 취소, 200명 한도를 지킨다", async ({ page }) => {
  const { dialog } = await openPicker(page);
  await dialog.getByRole("button", { name: "이 페이지 전체 선택", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("49명 선택");
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "취소", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("49명 선택");
  for (const first of [51, 101, 151]) {
    await dialog.getByRole("button", { name: "다음", exact: true }).click();
    await expect(dialog.getByRole("checkbox", { name: `기존학생${String(first).padStart(3, "0")} 선택`, exact: true })).toBeEnabled();
    await dialog.getByRole("button", { name: "이 페이지 전체 선택", exact: true }).click();
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
  await expect(dialog.getByRole("button", { name: "학생을 선택하세요", exact: true })).toBeDisabled();
  state.failRoster = false;
  await dialog.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("checkbox", { name: "기존학생003 선택", exact: true })).toBeEnabled();
});

test("키보드 선택과 지연된 등록 중 중복 제출·닫기를 막는다", async ({ page }) => {
  const { state, dialog } = await openPicker(page);
  const checkbox = dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true });
  await checkbox.focus();
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
  let finishSave: () => void = () => {};
  state.saveGate = new Promise<void>((resolve) => { finishSave = resolve; });
  try {
    await dialog.getByRole("button", { name: "1명 강의에 추가", exact: true }).evaluate((element) => {
      (element as HTMLButtonElement).click();
      (element as HTMLButtonElement).click();
    });
    await expect.poll(() => state.posts.length).toBe(1);
    await expect(dialog.getByRole("button", { name: "등록 확인 중…", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
  } finally {
    finishSave();
  }
  await expect(dialog).toHaveCount(0);
  expect(state.posts).toHaveLength(1);
});

test("검색 중 이전 명단을 잠그고 페이지 캐시·현재 페이지 해제로 빠르게 선택한다", async ({ page }) => {
  const { state, dialog } = await openPicker(page);
  const initialPageRequests = state.searchRequests.filter((request) => request.search === "" && request.page === 1).length;
  await dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true }).check();
  await dialog.getByRole("button", { name: "다음", exact: true }).click();
  await dialog.getByRole("checkbox", { name: "기존학생051 선택", exact: true }).check();
  await dialog.getByRole("button", { name: "이 페이지 전체 선택", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("51명 선택");
  await dialog.getByRole("button", { name: "이 페이지 선택 해제", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("1명 선택");
  await dialog.getByRole("button", { name: "이전", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true })).toBeChecked();
  expect(state.searchRequests.filter((request) => request.search === "" && request.page === 1)).toHaveLength(initialPageRequests);
  let finishSearch: () => void = () => {};
  state.searchGate = new Promise<void>((resolve) => { finishSearch = resolve; });
  try {
    await dialog.getByRole("textbox", { name: "학생 검색" }).fill("기존학생052");
    await expect(dialog.getByText("검색 중…", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: "기존학생003 선택", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "이 페이지 전체 선택", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "1명 강의에 추가", exact: true })).toBeEnabled();
  } finally { finishSearch(); }
  await dialog.getByRole("checkbox", { name: "기존학생052 선택", exact: true }).check();
  await dialog.getByRole("button", { name: "검색어 지우기", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: "학생 검색" })).toBeFocused();
  await expect(dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true })).toBeChecked();
  await expect(dialog.getByRole("status")).toHaveText("2명 선택");
});

for (const width of [1366, 390]) {
  test(`${width}px 한글 마지막 글자가 조합 중이어도 추가 클릭 없이 검색·선택한다`, async ({ page }, info) => {
    await page.clock.install();
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const { state, dialog } = await openPicker(page, { 52: "김가학생" });
    const input = dialog.getByRole("textbox", { name: "학생 검색" });
    // Locator latency must not advance the simulated typing intervals.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
    await input.dispatchEvent("compositionstart");
    for (const value of ["김", "김가", "김가학", "김가학생"]) {
      await input.fill(value);
      await page.clock.runFor(100);
    }
    expect(state.searchRequests.filter((request) => request.search !== "")).toHaveLength(0);
    await page.clock.runFor(300);
    await expect.poll(() => state.searchRequests.filter((request) => request.search !== "").length).toBe(1);
    // Keep only typing intervals frozen; query notifications need live timers.
    await page.clock.resume();
    const result = dialog.getByRole("checkbox", { name: "김가학생 선택", exact: true });
    await expect(result).toBeEnabled();
    await expect(input).toBeFocused();
    await expect(dialog.getByText("검색 결과 1명", { exact: true })).toBeVisible();
    expect(state.searchRequests.filter((request) => request.search !== "")).toEqual([{ search: "김가학생", page: 1 }]);
    await info.attach(`lecture-picker-ime-${width}.png`, {
      body: await dialog.screenshot(), contentType: "image/png",
    });
    // Committing the unchanged syllable must not duplicate the query or lock results.
    await input.dispatchEvent("compositionend");
    await page.clock.runFor(300);
    expect(state.searchRequests.filter((request) => request.search !== "")).toHaveLength(1);
    await result.check();
    await expect(dialog.getByRole("status")).toHaveText("1명 선택");
  });
}

test("조합 중 검색을 바꿔도 늦은 이전 응답이 새 결과를 덮지 않는다", async ({ page }) => {
  await page.clock.install();
  const { state, dialog } = await openPicker(page);
  const input = dialog.getByRole("textbox", { name: "학생 검색" });
  await input.dispatchEvent("compositionstart");
  let finishSearch: () => void = () => {};
  state.searchGate = new Promise<void>((resolve) => { finishSearch = resolve; });
  try {
    await input.fill("기존학생052");
    await page.clock.runFor(300);
    await expect.poll(() => state.searchRequests.some((request) => request.search === "기존학생052")).toBe(true);
    state.searchGate = null;
    await input.fill("기존학생053");
    await page.clock.runFor(300);
    await expect(dialog.getByRole("checkbox", { name: "기존학생053 선택", exact: true })).toBeEnabled();
  } finally { finishSearch(); }
  await expect(dialog.getByRole("checkbox", { name: "기존학생052 선택", exact: true })).toHaveCount(0);
  await expect(input).toBeFocused();
  await dialog.getByRole("checkbox", { name: "기존학생053 선택", exact: true }).check();
  await expect(dialog.getByRole("status")).toHaveText("1명 선택");
});

test("학생 검색 실패와 느린 출결 갱신이 선택한 학생의 저장 완료를 막지 않는다", async ({ page }) => {
  const { state, dialog } = await openPicker(page);
  await dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true }).check();
  state.failSearch = true;
  await dialog.getByRole("textbox", { name: "학생 검색" }).fill("없는학생");
  await expect(dialog.getByText("학생 명단을 불러오지 못했습니다", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByRole("button", { name: "1명 강의에 추가", exact: true })).toBeEnabled();
  let finishMatrix: () => void = () => {};
  state.matrixGate = new Promise<void>((resolve) => { finishMatrix = resolve; });
  try {
    await dialog.getByRole("button", { name: "1명 강의에 추가", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("기존학생002", { exact: true }).first()).toBeVisible();
  } finally { finishMatrix(); }
  await page.reload();
  await expect(page.getByText("기존학생002", { exact: true }).first()).toBeVisible();
  expect(state.posts).toHaveLength(1);
});

test("저장 후 강의 명단의 한글·숫자 포함 이름과 전화번호 검색이 정확하다", async ({ page }) => {
  const { dialog } = await openPicker(page);
  await dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true }).check();
  await dialog.getByRole("checkbox", { name: "기존학생003 선택", exact: true }).check();
  await dialog.getByRole("button", { name: "2명 강의에 추가", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const input = page.getByPlaceholder("이름 / 전화번호 검색", { exact: true });
  await input.fill("없는학생");
  await expect(page.getByText("검색 결과가 없습니다.", { exact: true })).toBeVisible();
  await input.fill("기존학생002");
  await expect(page.getByText("기존학생002", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("기존학생003", { exact: true })).toHaveCount(0);
  await input.fill("010-8000-0003");
  await expect(page.getByText("기존학생003", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("기존학생002", { exact: true })).toHaveCount(0);
});

test("낮은 모바일 화면·다크 테마에서도 선택과 저장 버튼에 접근한다", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("hakwonplus:theme", "modern-dark"));
  const { dialog } = await openPicker(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "focus-dark");
  await expect(dialog.locator(".modal-body")).toHaveCSS("background-color", "rgb(25, 33, 41)");
  await dialog.getByRole("checkbox", { name: "기존학생002 선택", exact: true }).check();
  const save = dialog.getByRole("button", { name: "1명 강의에 추가", exact: true });
  await expect(save).toBeInViewport();
  await expect.poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await dialog.screenshot({ path: info.outputPath("lecture-picker-short-dark.png") });
  await save.click();
  await expect(dialog).toHaveCount(0);
});

test("동명이인은 연락처로 구분하고 검색해도 선택한 학생의 이름이 바뀌지 않는다", async ({ page }) => {
  const { state, dialog } = await openPicker(page, { 2: "김학생", 3: "김학생" });
  const second = dialog.locator(".lecture-enroll-picker__row").filter({ hasText: "010-8000-0002" });
  await expect(second.getByRole("checkbox")).toHaveAccessibleDescription(/김학생.*학부모 010-8000-0002/);
  await second.getByRole("checkbox").check();
  await dialog.getByRole("textbox", { name: "학생 검색" }).fill("010-8000-0003");
  const third = dialog.locator(".lecture-enroll-picker__row").filter({ hasText: "010-8000-0003" });
  await third.getByRole("checkbox").check();
  await expect(dialog.locator(".lecture-enroll-picker__identity strong")).toHaveText("김학생");
  await expect(dialog.getByRole("button", { name: /김학생, .*010-8000-0002 선택 해제/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /김학생, .*010-8000-0003 선택 해제/ })).toBeVisible();
  await dialog.getByRole("button", { name: "2명 강의에 추가", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.posts).toEqual([{ lecture: LECTURE, students: [2, 3] }]);
  await page.getByPlaceholder("이름 / 전화번호 검색", { exact: true }).fill("김학생2");
  await expect(page.getByText("김학생2", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("김학생1", { exact: true })).toHaveCount(0);
});
