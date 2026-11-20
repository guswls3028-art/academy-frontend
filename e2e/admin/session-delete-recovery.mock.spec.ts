import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const SCOPE_MESSAGE = "연결된 커뮤니티 글이 있어 삭제할 수 없습니다. 커뮤니티에서 연결된 글을 확인하고 불필요한 글을 삭제한 뒤 다시 시도해 주세요. 글을 보존하려면 해당 강의·차시도 유지해 주세요.";

async function seedSession(page: Page) {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 전용");
  const lecture = { id: 101, title: "공개 범위 보존", name: "관리자", subject: "수학", is_active: true };
  let sessions = [{ id: 201, lecture: 101, order: 1, regular_order: 1, session_type: "REGULAR", title: "1차시", date: "2026-08-01" }];
  let denial: { detail: string } | null = { detail: SCOPE_MESSAGE };
  const deletions: number[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/lectures/lectures/") return json([lecture]);
    if (path === "/lectures/lectures/101/") return json(lecture);
    if (path === "/lectures/sessions/") return json(sessions);
    if (path === "/lectures/sessions/201/" && request.method() === "DELETE") {
      deletions.push(201);
      if (denial) return json(denial, 403);
      sessions = [];
      return route.fulfill({ status: 204 });
    }
    if (path === "/staffs/me/") return json({ is_authenticated: true, is_staff: true, is_owner: true, owner_display_name: "관리자" });
    return json({ count: 0, results: [] });
  });
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const jwt = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, jwt);
  return { deletions, reject: (detail: string) => { denial = { detail }; }, allow: () => { denial = null; } };
}

async function removeSession(page: Page) {
  await page.getByRole("button", { name: "차시 설정", exact: true }).click();
  await page.getByRole("menu", { name: "차시 설정 메뉴" }).getByRole("button", { name: "삭제", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", { name: "차시 삭제", exact: true });
  const [response] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/lectures/sessions/201/") && response.request().method() === "DELETE"),
    confirmation.getByRole("button", { name: "삭제", exact: true }).click(),
  ]);
  return response;
}

for (const width of [1366, 1100, 390]) {
  test(`차시 삭제는 403 복구 안내와 빈 응답 fallback을 표시하고 재시도한다 (${width}px)`, async ({ page }, testInfo) => {
    const state = await seedSession(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/workspace/lectures/101`, { waitUntil: "domcontentloaded" });
    for (const [label, detail] of [["scoped", SCOPE_MESSAGE], ["fallback", ""]]) {
      state.reject(detail);
      const response = await removeSession(page);
      expect(response.status()).toBe(403);
      const notice = page.getByText(detail || "차시 삭제에 실패했습니다.", { exact: true });
      await expect(notice).toBeVisible();
      await expect(notice).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: testInfo.outputPath(`session-delete-${label}-${width}.png`), animations: "disabled" });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: "차시 설정", exact: true })).toBeVisible();
    }
    state.allow();
    expect((await removeSession(page)).status()).toBe(204);
    await expect(page.getByRole("button", { name: "차시 설정", exact: true })).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "차시 설정", exact: true })).toHaveCount(0);
    expect(state.deletions).toEqual([201, 201, 201]);
  });
}
