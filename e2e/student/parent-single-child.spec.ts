/**
 * 자녀 1명 학부모 — 자녀 스위처 미노출 + TopBar displayName 노출 확인.
 * 테스트 중 자녀 1명 fixture를 만들고 삭제한다.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

const BASE = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
const PARENT_PHONE = "01099999990";
const PARENT_INITIAL_PASS = "9990";
const PARENT_STABLE_PASS = "9990e2e";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "test1234";

async function issueToken(request: APIRequestContext, username: string, password: string) {
  const resp = await request.post(`${API}/api/v1/token/`, {
    data: { username, password, tenant_code: "hakwonplus" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    timeout: 60_000,
  });
  expect(resp.status()).toBe(200);
  return await resp.json() as { access: string; refresh: string };
}

async function tryIssueToken(request: APIRequestContext, username: string, password: string) {
  const resp = await request.post(`${API}/api/v1/token/`, {
    data: { username, password, tenant_code: "hakwonplus" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    timeout: 60_000,
  });

  if (resp.status() !== 200) return null;
  return await resp.json() as { access: string; refresh: string };
}

async function ensureParentTokens(request: APIRequestContext) {
  const stableTokens = await tryIssueToken(request, PARENT_PHONE, PARENT_STABLE_PASS);
  if (stableTokens) return stableTokens;

  const initialTokens = await issueToken(request, PARENT_PHONE, PARENT_INITIAL_PASS);
  const resp = await request.post(`${API}/api/v1/core/change-password/`, {
    data: { old_password: PARENT_INITIAL_PASS, new_password: PARENT_STABLE_PASS },
    headers: {
      Authorization: `Bearer ${initialTokens.access}`,
      "Content-Type": "application/json",
      "X-Tenant-Code": "hakwonplus",
    },
    timeout: 60_000,
  });
  expect(resp.status()).toBe(200);

  return await issueToken(request, PARENT_PHONE, PARENT_STABLE_PASS);
}

async function createStudent(request: APIRequestContext, adminAccess: string, stamp: string) {
  const resp = await request.post(`${API}/api/v1/students/`, {
    data: {
      name: `[E2E-${stamp}] 단일자녀`,
      ps_number: `E2E${stamp}S`,
      no_phone: true,
      phone: "",
      parent_phone: PARENT_PHONE,
      initial_password: "1234",
      school_type: "HIGH",
      grade: 1,
      gender: "M",
      high_school: "E2E High",
      memo: `[E2E-${stamp}] parent single child fixture`,
      send_welcome_message: false,
    },
    headers: {
      Authorization: `Bearer ${adminAccess}`,
      "Content-Type": "application/json",
      "X-Tenant-Code": "hakwonplus",
    },
    timeout: 60_000,
  });
  expect(resp.status()).toBe(201);
  return await resp.json() as { id: number };
}

async function cleanupStudents(request: APIRequestContext, adminAccess: string, ids: number[]) {
  if (ids.length === 0) return;
  const headers = {
    Authorization: `Bearer ${adminAccess}`,
    "Content-Type": "application/json",
    "X-Tenant-Code": "hakwonplus",
  };
  const soft = await request.post(`${API}/api/v1/students/bulk_delete/`, {
    data: { ids },
    headers,
    timeout: 60_000,
  });
  expect([200, 204]).toContain(soft.status());

  const permanent = await request.post(`${API}/api/v1/students/bulk_permanent_delete/`, {
    data: { ids },
    headers,
    timeout: 60_000,
  });
  expect(permanent.status()).toBe(200);
}

test.describe("자녀 1명 학부모", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("스위처 미노출 + TopBar displayName 노출 + 스크린샷", async ({ page }) => {
    const stamp = String(Date.now()).slice(-10);
    const adminTokens = await issueToken(page.request, ADMIN_USER, ADMIN_PASS);
    const createdIds: number[] = [];

    try {
      const student = await createStudent(page.request, adminTokens.access, stamp);
      createdIds.push(student.id);

      const tokens = await ensureParentTokens(page.request);

      await page.goto(`${BASE}/login`, { waitUntil: "commit" });
      await page.evaluate(({ access, refresh }) => {
        localStorage.setItem("access", access);
        localStorage.setItem("refresh", refresh);
        sessionStorage.setItem("tenantCode", "hakwonplus");
      }, tokens);

      await page.goto(`${BASE}/student/dashboard`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});

      /* 자녀 스위처(role=tablist) 노출 안 됨 — 자녀 1명이라 display:none 또는 미렌더 */
      await expect(page.getByRole("tablist", { name: "자녀 선택" })).toHaveCount(0);

      await expect(page.getByRole("region", { name: "우리 아이 요약" })).toBeVisible({ timeout: 15_000 });

      /* TopBar displayName 노출 — 자녀 이름이 우상단에 (학부모 모드 단일 채널) */
      const topbarName = page.locator(".stu-topbar__name");
      await expect(topbarName).toBeVisible({ timeout: 8_000 });
      await expect(topbarName).toContainText(`[E2E-${stamp}] 단일자녀`);

      await page.screenshot({ path: "e2e/screenshots/parent-single-child.png", fullPage: true });
    } finally {
      await cleanupStudents(page.request, adminTokens.access, createdIds);
    }
  });
});
