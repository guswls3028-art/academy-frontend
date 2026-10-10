import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const CHILDREN = {
  "11": { id: 11, name: "김첫째", ps: "child-a-ps", file: "첫째 자료.pdf" },
  "12": { id: 12, name: "김둘째", ps: "child-b-ps", file: "둘째 자료.pdf" },
} as const;

type ChildId = keyof typeof CHILDREN;
type InventoryScope = { studentId: string; studentPs: string; status: number };

function fakeJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 920,
  })}.sig`;
}

async function installApi(page: Page, options: { role?: "student" | "parent"; deleteReply?: "success" | "partial" | "protected" } = {}) {
  const scopes: InventoryScope[] = [];
  const deletes: string[] = [];
  const deleted = new Set<string>();
  const role = options.role ?? "parent";
  const token = fakeJwt();
  await page.addInitScript((access) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
    localStorage.setItem("tenant_code", "hakwonplus");
    if (!localStorage.getItem("parent_selected_student_id_hakwonplus_920")) {
      localStorage.setItem("parent_selected_student_id_hakwonplus_920", "11");
    }
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, token);

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (value: unknown, status = 200) => route.fulfill({ status, json: value });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path.endsWith("/token/refresh/")) return json({ access: token, refresh: `${token}-refresh` });
    if (path.endsWith("/core/program/")) {
      return json({ tenantCode: "hakwonplus", display_name: "학원플러스", is_active: true, feature_flags: {}, ui_config: {} });
    }
    if (path.endsWith("/core/me/")) {
      return json({
        id: 920,
        username: "parent-920",
        name: "김보호",
        is_staff: false,
        is_superuser: false,
        tenantRole: role,
        linkedStudents: role === "parent" ? Object.values(CHILDREN).map(({ id, name }) => ({ id, name })) : [],
      });
    }
    const selectedId = request.headers()["x-student-id"] as ChildId | undefined;
    if (path.endsWith("/student/me/")) {
      const child = CHILDREN[selectedId ?? "11"];
      return json({ id: child.id, name: child.name, displayName: child.name, ps_number: child.ps, is_student: true, isParentReadOnly: role === "parent" });
    }
    if (request.method() === "DELETE" && path.endsWith("/storage/inventory/files/file-11/")) {
      expect(url.searchParams.get("scope")).toBe("student");
      expect(url.searchParams.get("student_ps")).toBe(CHILDREN["11"].ps);
      expect(selectedId).toBe(role === "parent" ? "11" : undefined);
      deletes.push(path);
      if (options.deleteReply === "protected") return json({ detail: "점수 증빙으로 연결된 파일은 삭제할 수 없습니다." }, 409);
      deleted.add("11");
      if (options.deleteReply === "partial") return json({
        code: "inventory_storage_cleanup_pending", deleted: true,
        detail: "목록에서 삭제되었습니다. 원본 파일 정리는 재시도 대기 중입니다. 새로고침으로 목록을 확인해 주세요.",
        storage_cleanup: { pending: 0, failed: 1, cleaned: 0 },
      }, 502);
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith("/storage/inventory/")) {
      const studentPs = url.searchParams.get("student_ps") ?? "";
      const childId = role === "student" ? "11" : selectedId;
      const expected = childId ? CHILDREN[childId]?.ps : undefined;
      const status = expected === studentPs ? 200 : 403;
      scopes.push({ studentId: selectedId ?? "missing", studentPs, status });
      if (status !== 200) return json({ detail: "선택 자녀와 자료함 학생이 다릅니다." }, status);
      const child = CHILDREN[childId!];
      return json({
        folders: [],
        files: deleted.has(childId!) ? [] : [{
          id: `file-${child.id}`,
          name: child.file,
          displayName: child.file,
          description: "",
          icon: "file-text",
          folderId: null,
          sizeBytes: 10,
          r2Key: `tenants/1/students/${child.id}/inventory/file-${child.id}`,
          contentType: "application/pdf",
          createdAt: "2026-09-10T00:00:00Z",
        }],
      });
    }
    if (path.endsWith("/student/dashboard/")) {
      return json({ notices: [], today_sessions: [], badges: {}, tenant_info: null });
    }
    if (path.endsWith("/storage/quota/")) return json({ usedBytes: 0, limitBytes: 1, plan: "all" });
    return json({ count: 0, results: [] });
  });
  return { scopes, deletes };
}

for (const viewport of [
  { name: "390px", width: 390, height: 844 },
  { name: "desktop", width: 1366, height: 900 },
] as const) {
  test(`학부모 자녀 A→B→A 자료함 요청은 query student_ps와 헤더가 일치한다 (${viewport.name})`, async ({ page }) => {
    test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 전용");
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const { scopes } = await installApi(page);

    await page.goto(`${BASE}/student/inventory`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expect(page.getByText(CHILDREN["11"].file, { exact: true })).toBeVisible();

    const switcher = page.getByRole("tablist", { name: "자녀 선택" });
    await switcher.getByRole("tab", { name: CHILDREN["12"].name, exact: true }).click();
    await expect(page).toHaveURL(/\/student\/dashboard$/);
    await page.goto(`${BASE}/student/inventory`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(CHILDREN["12"].file, { exact: true })).toBeVisible();
    await expect(page.getByText(CHILDREN["11"].file, { exact: true })).toHaveCount(0);

    await switcher.getByRole("tab", { name: CHILDREN["11"].name, exact: true }).click();
    await expect(page).toHaveURL(/\/student\/dashboard$/);
    await page.goto(`${BASE}/student/inventory`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(CHILDREN["11"].file, { exact: true })).toBeVisible();
    await expect(page.getByText(CHILDREN["12"].file, { exact: true })).toHaveCount(0);
    await page.waitForLoadState("networkidle");

    expect(scopes.length).toBeGreaterThanOrEqual(3);
    expect(scopes.filter((scope) => scope.status !== 200), JSON.stringify(scopes)).toEqual([]);
    expect(scopes.every((scope) => CHILDREN[scope.studentId as ChildId]?.ps === scope.studentPs)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

for (const width of [390, 1366]) {
  for (const role of ["student", "parent"] as const) {
    for (const reply of ["success", "partial", "protected"] as const) {
      test(`자료함 삭제 ${role} ${reply} ${width}px @student-inventory-delete`, async ({ page }, testInfo) => {
        test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 전용");
        await page.setViewportSize({ width, height: 900 });
        const harness = await installApi(page, { role, deleteReply: reply });
        await page.goto(`${BASE}/student/inventory`, { waitUntil: "domcontentloaded" });
        await expect(page.getByText(CHILDREN["11"].file, { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "삭제", exact: true }).click();
        const dialog = page.getByRole("alertdialog", { name: "파일 삭제" });
        const reads = harness.scopes.length;
        await dialog.getByRole("button", { name: "삭제", exact: true }).click();
        if (reply === "protected") {
          await expect(dialog.getByRole("alert")).toHaveText("점수 증빙으로 연결된 파일은 삭제할 수 없습니다.");
          await dialog.getByRole("button", { name: "취소" }).click();
          await expect(page.getByText(CHILDREN["11"].file, { exact: true })).toBeVisible();
        } else {
          await expect(dialog).toHaveCount(0);
          await expect(page.getByText(CHILDREN["11"].file, { exact: true })).toHaveCount(0);
          if (reply === "partial") {
            await expect(page.getByRole("status").filter({ hasText: "원본 파일 정리는 재시도 대기 중" })).toBeVisible();
            await page.screenshot({ path: testInfo.outputPath("cleanup-pending.png"), fullPage: true });
          }
        }
        await expect.poll(() => harness.scopes.length).toBeGreaterThan(reads);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByText(CHILDREN["11"].file, { exact: true })).toHaveCount(reply === "protected" ? 1 : 0);
        expect(harness.deletes).toHaveLength(1);
        expect(harness.scopes.every(({ status }) => status === 200)).toBe(true);
        if (role === "parent") {
          await page.getByRole("tab", { name: CHILDREN["12"].name, exact: true }).click();
          await page.goto(`${BASE}/student/inventory`, { waitUntil: "domcontentloaded" });
          await expect(page.getByText(CHILDREN["12"].file, { exact: true })).toBeVisible();
          await expect(page.getByText(CHILDREN["11"].file, { exact: true })).toHaveCount(0);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      });
    }
  }
}
