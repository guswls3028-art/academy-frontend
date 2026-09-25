import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const NAME = "가상메모학생";
const COMMON = "학생 공통 특이사항: 긴 설명도 조교가 함께 확인합니다.";
const INITIAL = "이 강의는 영상 수강\n수업 전에 자료 전달";
const adminPath = (session = 9902, lecture = 9901) => `/workspace/lectures/${lecture}/sessions/${session}/attendance`;
const mobilePath = (session = 9902) => `/workspace/mobile/classes/9901/sessions/${session}`;

test.use({ serviceWorkers: "block" });

async function setup(page: Page, role: "admin" | "staff" = "admin") {
  const state = {
    common: COMMON,
    memos: { 3001: INITIAL, 3002: "다른 강의의 독립된 메모" } as Record<number, string>,
    versions: { 3001: 1, 3002: 1 } as Record<number, number>,
    failSave: false, failRead: false, failRoster: false, patches: [] as Array<{ id: number; memo: string; version: string }>,
  };
  const version = (id: number) => `2026-09-20T10:00:${String(state.versions[id]).padStart(2, "0")}Z`;
  const memo = (id: number) => ({ id, lecture_memo: state.memos[id], lecture_memo_updated_at: version(id) });
  const sessions = [
    { id: 9902, lecture: 9901, order: 1, regular_order: 1, session_type: "REGULAR", title: "1차시", date: "2026-09-20" },
    { id: 9903, lecture: 9901, order: 2, regular_order: 2, session_type: "REGULAR", title: "2차시", date: "2026-09-27" },
    { id: 9912, lecture: 9911, order: 1, regular_order: 1, session_type: "REGULAR", title: "1차시", date: "2026-09-20" },
  ];
  await installTenantOneInitScript(page);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt); localStorage.setItem("refresh", `${jwt}-refresh`);
  }, token);
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    const list = (rows: unknown[]) => json({ count: rows.length, results: rows });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", is_active: true, display_name: "가상 학원", feature_flags: {}, ui_config: {} });
    if (path === "/core/me/") return json({ id: 12, username: `qa-memo-${role}`, name: "가상 직원", tenantRole: role, is_staff: true, is_superuser: false, first_login_guide_required: false, must_change_password: false });
    const session = sessions.find((item) => path === `/lectures/sessions/${item.id}/`);
    if (session) return json(session);
    if (/^\/lectures\/lectures\/\d+\/$/.test(path)) return json({ id: Number(path.split("/")[3]), title: "가상 메모 강의", is_active: true });
    if (path === "/lectures/sessions/") return list(sessions.filter((item) => item.lecture === Number(url.searchParams.get("lecture"))));
    if (path === "/lectures/attendance/" || path === "/enrollments/session-enrollments/") {
      if (state.failRoster) return json({ detail: "명단 재조회 실패" }, 503);
      const id = url.searchParams.get("session") === "9912" ? 3002 : 3001;
      return list([{ ...memo(id), id: 501, enrollment_id: id, enrollment: id, student_id: 1001,
        student_name: NAME, name: NAME, status: "UNSET", enrollment_status: "ACTIVE",
        lecture_title: "가상 메모 강의", student_memo: state.common, parent_phone: "01000001111", phone: "01000002222" }]);
    }
    if (path === "/students/1001/") {
      if (request.method() === "PATCH") state.common = (request.postDataJSON() as { memo: string }).memo;
      return json({ id: 1001, name: NAME, memo: state.common, ps_number: "QA1001", active: true,
        is_managed: true, account_state: "ACTIVE", tags: [], enrollments: [], phone: "01000002222", parent_phone: "01000001111" });
    }
    const match = path.match(/^\/enrollments\/(300[12])\/(lecture-memo\/)?$/);
    if (match) {
      const id = Number(match[1]);
      if (request.method() === "GET") {
        if (state.failRead) return json({ detail: "메모 조회 실패" }, 503);
        return json(memo(id));
      }
      if (request.method() === "PATCH" && match[2]) {
        const body = request.postDataJSON() as { lecture_memo: string };
        const expected = request.headers()["x-expected-updated-at"];
        state.patches.push({ id, memo: body.lecture_memo, version: expected });
        if (state.failSave) return json({ detail: "메모 저장 실패 — 다시 시도해 주세요." }, 503);
        if (expected !== version(id)) return json({ detail: "다른 직원이 수정했습니다.", code: "stale_resource", current_updated_at: version(id) }, 409);
        state.memos[id] = body.lecture_memo; state.versions[id] += 1;
        return json(memo(id));
      }
    }
    if (request.method() !== "GET") throw new Error(`Unexpected memo fixture mutation: ${request.method()} ${path}`);
    return list([]);
  });
  return state;
}

async function openEditor(page: Page) {
  await page.getByRole("button", { name: `${NAME} 강의 메모`, exact: false }).click();
  const dialog = page.getByRole("dialog", { name: `${NAME} 강의 메모`, exact: true });
  await expect(dialog.getByRole("textbox", { name: "강의 메모", exact: true })).toBeVisible();
  return dialog;
}

for (const width of [1366, 1100, 390]) {
  test(`강의 메모 저장·새로고침·다음 차시·다른 강의 분리 ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await setup(page);
    await page.goto(`${BASE}${adminPath()}`);
    const preview = page.locator('[data-student-memos="3001"]');
    await expect(preview).toContainText(INITIAL);
    await expect(preview).toContainText(COMMON);
    const table = page.locator(".ds-table--attendance");
    await expect(table.getByRole("columnheader", { name: "메모" })).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(table.locator("tbody tr td").last()).toContainText(INITIAL);
    const dialog = await openEditor(page);
    await expect(page.getByTestId("student-detail-overlay")).toHaveCount(0);
    await expect(dialog.getByRole("region", { name: "학생 공통 메모" })).toContainText(COMMON);
    const draft = "영상 수강 · 수업 전 자료를 전달하고 수업 후 보호자에게 연락하기\n" + "긴안내문구".repeat(22);
    await dialog.getByRole("textbox", { name: "강의 메모", exact: true }).fill(draft);
    await dialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("student-detail-overlay")).toHaveCount(0);
    await expect(preview).toContainText(draft);
    expect(state.patches).toEqual([{ id: 3001, memo: draft, version: "2026-09-20T10:00:01Z" }]);
    await page.reload();
    await expect(preview).toContainText(draft);
    await preview.scrollIntoViewIfNeeded();
    const box = await preview.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`memo-${width}.png`), fullPage: true });
    await page.goto(`${BASE}${adminPath(9903)}`);
    await expect(preview).toContainText(draft);
    await page.goto(`${BASE}${adminPath(9912, 9911)}`);
    await expect(page.locator('[data-student-memos="3002"]')).toContainText("다른 강의의 독립된 메모");
    await expect(page.locator('[data-student-memos="3002"]')).not.toContainText(draft);
  });
}

test("조회 실패·저장 실패 재시도는 초안을 보존하고 메모 비우기도 저장한다", async ({ page }) => {
  const state = await setup(page);
  await page.goto(`${BASE}${adminPath()}`);
  state.failRead = true;
  await page.getByRole("button", { name: `${NAME} 강의 메모 보기 및 수정` }).click();
  const dialog = page.getByRole("dialog", { name: `${NAME} 강의 메모`, exact: true });
  await expect(dialog.getByRole("alert")).toContainText("메모 조회 실패");
  state.failRead = false;
  await dialog.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  const input = dialog.getByRole("textbox", { name: "강의 메모", exact: true });
  await expect(input).toHaveValue(INITIAL);
  await input.fill("실패해도 남아야 하는 전달 사항");
  state.failSave = true;
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("메모 저장 실패");
  await expect(input).toHaveValue("실패해도 남아야 하는 전달 사항");
  state.failSave = false;
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog).toBeHidden();
  const reopened = await openEditor(page);
  await reopened.getByRole("textbox", { name: "강의 메모", exact: true }).fill("");
  await reopened.getByRole("button", { name: "저장", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: `${NAME} 강의 메모 추가` })).toBeVisible();
  expect(state.memos[3001]).toBe("");
});

test("동시 수정은 덮어쓰지 않고 최신 내용과 내 초안을 함께 확인한다", async ({ page }) => {
  const state = await setup(page);
  await page.goto(`${BASE}${adminPath()}`);
  const dialog = await openEditor(page);
  const input = dialog.getByRole("textbox", { name: "강의 메모", exact: true });
  await input.fill("내가 추가한 전달 사항");
  state.memos[3001] = "다른 조교가 저장한 안내"; state.versions[3001] += 1;
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("다른 조교가 저장한 안내");
  await expect(input).toHaveValue("내가 추가한 전달 사항");
  expect(state.memos[3001]).toBe("다른 조교가 저장한 안내");
  await dialog.getByRole("button", { name: "최신 메모 확인 · 계속 편집" }).click();
  await input.fill("다른 조교가 저장한 안내\n내가 추가한 전달 사항");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(state.patches.at(-1)?.version).toBe("2026-09-20T10:00:02Z");
  await page.reload();
  await expect(page.locator('[data-student-memos="3001"]')).toContainText("다른 조교가 저장한 안내\n내가 추가한 전달 사항");
});

test("staff 역할 응답의 모바일 차시 명단·출석 화면에서 같은 메모를 읽고 수정한다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page, "staff");
  await page.goto(`${BASE}${mobilePath()}`);
  await expect(page.locator('[data-student-memos="3001"]')).toContainText(INITIAL);
  const dialog = await openEditor(page);
  await dialog.getByRole("textbox", { name: "강의 메모", exact: true }).fill("모바일 조교가 수정한 안내");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.goto(`${BASE}${mobilePath(9903)}`);
  await expect(page.locator('[data-student-memos="3001"]')).toContainText("모바일 조교가 수정한 안내");
  await page.goto(`${BASE}/workspace/mobile/attendance/9902`);
  await expect(page.locator('[data-student-memos="3001"]')).toContainText("모바일 조교가 수정한 안내");
  const reopened = await openEditor(page);
  await expect(reopened.getByRole("textbox", { name: "강의 메모", exact: true })).toHaveValue(state.memos[3001]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mobile-memo-editor.png") });
});

test("저장 성공 후 명단 재조회 실패에도 확인된 저장값을 표시한다", async ({ page }) => {
  const state = await setup(page);
  await page.goto(`${BASE}${adminPath()}`);
  const dialog = await openEditor(page);
  await dialog.getByRole("textbox", { name: "강의 메모", exact: true }).fill("저장은 성공한 메모");
  state.failRoster = true;
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-student-memos="3001"]')).toContainText("저장은 성공한 메모");
  expect(state.memos[3001]).toBe("저장은 성공한 메모");
});

test("학생 정보의 공통 메모 수정은 명단에 반영되고 강의 메모는 유지된다", async ({ page }) => {
  const state = await setup(page);
  await page.goto(`${BASE}${adminPath()}`);
  await page.getByRole("link", { name: `${NAME} 학생 상세 열기` }).click();
  const overlay = page.getByTestId("student-detail-overlay");
  const input = overlay.getByRole("textbox", { name: "학생 공통 메모", exact: true });
  await input.fill("수정된 학생 공통 특이사항");
  await input.blur();
  await expect(overlay.getByText("저장됨", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(overlay).toBeHidden();
  await expect(page.locator('[data-student-memos="3001"]')).toContainText("수정된 학생 공통 특이사항");
  await expect(page.locator('[data-student-memos="3001"]')).toContainText(INITIAL);
  expect(state.memos[3001]).toBe(INITIAL);
});

test("새로고침 취소와 뒤로 이동 후 복귀에서 미저장 초안을 보호한다", async ({ page }) => {
  const state = await setup(page);
  await page.goto(`${BASE}${adminPath()}`);
  await page.getByRole("link", { name: "대시보드", exact: true }).first().click();
  await page.goBack();
  const dialog = await openEditor(page);
  await dialog.getByRole("textbox", { name: "강의 메모", exact: true }).fill("저장 전 전달 사항");
  page.once("dialog", (prompt) => { void prompt.dismiss(); });
  await page.reload().catch(() => undefined);
  await expect(dialog.getByRole("textbox", { name: "강의 메모", exact: true })).toHaveValue("저장 전 전달 사항");
  // Same-document navigation retains the query client and exact scoped recovery.
  await page.goForward();
  await page.goBack();
  state.failRead = true;
  await page.getByRole("button", { name: `${NAME} 강의 메모 보기 및 수정` }).click();
  const failedDialog = page.getByRole("dialog", { name: `${NAME} 강의 메모`, exact: true });
  await expect(failedDialog.getByRole("alert")).toContainText("메모 조회 실패");
  await failedDialog.getByRole("button", { name: "닫기", exact: true }).click();
  state.failRead = false;
  const restored = await openEditor(page);
  await expect(restored.getByRole("textbox", { name: "강의 메모", exact: true })).toHaveValue("저장 전 전달 사항");
  await expect(restored.getByRole("status")).toContainText("복원했습니다");
  await restored.getByRole("button", { name: "저장", exact: true }).click();
  await expect(restored).toBeHidden();
});
