import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
const LECTURE_ID = 9911;
const REGULAR_ID = 9912;
const SUPPLEMENT_ID = 9913;
const DATE = "2026-10-01";
const PATH = `/workspace/mobile/classes/${LECTURE_ID}`;

type SessionRow = {
  id: number;
  lecture: number;
  order: number;
  regular_order: number | null;
  session_type: "REGULAR" | "SUPPLEMENT";
  title: string;
  date: string;
};

async function installScenario(page: Page) {
  const rows = new Map<number, SessionRow>([
    [REGULAR_ID, { id: REGULAR_ID, lecture: LECTURE_ID, order: 3, regular_order: 7, session_type: "REGULAR", title: "7차시", date: DATE }],
    [SUPPLEMENT_ID, { id: SUPPLEMENT_ID, lecture: LECTURE_ID, order: 4, regular_order: null, session_type: "SUPPLEMENT", title: "토요일 심화 클리닉", date: DATE }],
  ]);
  const patches: Array<{ id: number; payload: Record<string, unknown> }> = [];
  const otherMutations: string[] = [];
  let rejectNextPatch = false;
  const present = (row: SessionRow) => ({ ...row, display_label: row.title || `${row.regular_order}차시` });
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const jwt = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, jwt);

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", isPlatformAdmin: false, display_name: "테스트 학원", feature_flags: {}, is_active: true });
    if (path === "/core/me/") return json({ id: 12, username: "qa-teacher", name: "김강사", phone: null, is_staff: true, is_superuser: false, tenantRole: "teacher", must_change_password: false, first_login_guide_required: false });
    if (path === "/core/subscription/") return json({ plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30, tenant_code: "hakwonplus", tenant_name: "테스트 학원" });
    if (path === `/lectures/lectures/${LECTURE_ID}/`) return json({ id: LECTURE_ID, title: "수학 A반", is_active: true });
    if (path === "/lectures/sessions/" && request.method() === "GET") return json({ count: rows.size, results: [...rows.values()].map(present) });
    const sessionMatch = path.match(/^\/lectures\/sessions\/(\d+)\/$/);
    if (sessionMatch) {
      const id = Number(sessionMatch[1]);
      const row = rows.get(id);
      if (!row) return json({ detail: "차시를 찾을 수 없습니다." }, 404);
      if (request.method() === "GET") return json(present(row));
      if (request.method() === "PATCH") {
        const payload = request.postDataJSON() as Record<string, unknown>;
        patches.push({ id, payload });
        if (rejectNextPatch) {
          rejectNextPatch = false;
          return json({ detail: "차시 이름을 저장하지 못했습니다. 다시 시도해 주세요." }, 400);
        }
        Object.assign(row, payload);
        return json(present(row));
      }
    }
    if (path.startsWith("/lectures/") && request.method() !== "GET") {
      otherMutations.push(`${request.method()} ${path}`);
      return json({ detail: "이 검증에서 지원하지 않는 변경입니다." }, 405);
    }
    return json({ count: 0, results: [] });
  });
  await gotoAndSettle(page, `${BASE}${PATH}`);
  await expect(page.getByRole("button", { name: "차시 수정: 7차시", exact: true })).toBeVisible();
  return { rows, patches, otherMutations, rejectNext: () => { rejectNextPatch = true; } };
}

test.use({ serviceWorkers: "block" });
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "교사 편집 진입 route-mock는 로컬 서버 전용");

for (const width of [1366, 390]) {
  test(`${width}px 정규·보강 수정 버튼은 클릭·Enter·Space로 열고 취소 시 포커스를 돌려준다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const state = await installScenario(page);
    for (const [id, label, fieldLabel] of [
      [REGULAR_ID, "7차시", "차시 이름 (선택)"],
      [SUPPLEMENT_ID, "토요일 심화 클리닉", "보강 이름 *"],
    ] as const) {
      const edit = page.getByRole("button", { name: `차시 수정: ${label}`, exact: true });
      const navigation = page.getByRole("button").filter({ hasText: label }).filter({ hasText: DATE });
      await expect(edit).toHaveJSProperty("tagName", "BUTTON");
      await expect(edit).toHaveJSProperty("tabIndex", 0);
      await expect(edit.locator("xpath=ancestor::button")).toHaveCount(0);
      const target = await edit.boundingBox();
      expect(target?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(target?.width ?? 0).toBeGreaterThanOrEqual(44);
      for (const activation of ["click", "Enter", "Space"] as const) {
        if (activation === "click") await edit.click();
        else {
          await navigation.focus();
          await page.keyboard.press("Tab");
          await expect(edit).toBeFocused();
          await page.keyboard.press(activation);
        }
        const dialog = page.getByRole("dialog", { name: "차시 편집", exact: true });
        await expect(dialog).toBeVisible();
        await expect(page).toHaveURL(`${BASE}${PATH}`);
        const input = dialog.getByLabel(fieldLabel, { exact: true });
        await expect(input).toHaveValue(label);
        await input.fill("취소할 입력");
        if (activation === "Space") await page.keyboard.press("Escape");
        else await dialog.getByRole("button", { name: "닫기", exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect(edit).toBeFocused();
        expect(state.rows.get(id)?.title).toBe(label);
        expect(state.patches).toHaveLength(0);
      }
    }
    expect(state.otherMutations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`teacher-edit-entry-focus-${width}.png`) });
    await page.getByRole("button").filter({ hasText: "7차시" }).filter({ hasText: DATE }).click();
    await expect(page).toHaveURL(`${BASE}${PATH}/sessions/${REGULAR_ID}`);
    expect(state.patches).toHaveLength(0);
  });

  test(`${width}px 정규 이름 저장 실패는 입력을 유지하고 재시도·재조회 후 번호와 유형을 보존한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const state = await installScenario(page);
    const supplementBefore = { ...state.rows.get(SUPPLEMENT_ID) };
    const title = "직보(직전보강) — 다음 차시 대비 핵심 개념과 오답 정리";
    await page.getByRole("button", { name: "차시 수정: 7차시", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "차시 편집", exact: true });
    const input = dialog.getByLabel("차시 이름 (선택)", { exact: true });
    await input.fill(title);
    state.rejectNext();
    await dialog.getByRole("button", { name: "수정", exact: true }).click();
    await expect(page.getByText("차시 이름을 저장하지 못했습니다. 다시 시도해 주세요.", { exact: true })).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(input).toHaveValue(title);
    await expect(dialog.getByLabel("차시 번호", { exact: true })).toHaveValue("7");
    expect(state.rows.get(REGULAR_ID)?.title).toBe("7차시");
    expect(state.patches).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`teacher-edit-retry-${width}.png`) });
    await dialog.getByRole("button", { name: "수정", exact: true }).click();
    await expect(dialog).toBeHidden();
    const edit = page.getByRole("button", { name: `차시 수정: ${title}`, exact: true });
    await expect(edit).toBeVisible();
    await expect(edit).toBeFocused();
    expect(state.patches).toHaveLength(2);
    for (const patch of state.patches) {
      expect(patch).toEqual({ id: REGULAR_ID, payload: { title, date: DATE, regular_order: 7 } });
    }
    expect(state.rows.get(REGULAR_ID)).toEqual({ id: REGULAR_ID, lecture: LECTURE_ID, order: 3, regular_order: 7, session_type: "REGULAR", title, date: DATE });
    expect(state.rows.get(SUPPLEMENT_ID)).toEqual(supplementBefore);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(edit).toBeVisible();
    await edit.click();
    await expect(input).toHaveValue(title);
    await expect(dialog.getByLabel("차시 번호", { exact: true })).toHaveValue("7");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(edit).toBeFocused();
    expect(state.patches).toHaveLength(2);
    expect(state.otherMutations).toEqual([]);
  });
}
