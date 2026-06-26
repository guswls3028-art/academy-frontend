/**
 * 학부모 자녀 스위처 — 운영 환경 검증.
 *
 * 테스트 데이터: 1번 테넌트 임시 학부모 (phone=01099999990)
 *   - spec 시작 시 [E2E-{timestamp}] 자녀 2명 생성
 *   - spec 종료 시 생성 학생 soft delete → permanent delete
 *
 * 점검:
 *   1) 헤더 하단에 자녀 칩 2개 노출 (학생 계정 검증에선 노출 안 됨)
 *   2) 칩 클릭 → 활성 표시 전환 + 캐시 격리
 *   3) 풀페이지 스크린샷
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

  if (resp.status() !== 200) {
    return null;
  }

  return await resp.json() as { access: string; refresh: string };
}

async function ensureParentTokens(request: APIRequestContext) {
  const stableTokens = await tryIssueToken(request, PARENT_PHONE, PARENT_STABLE_PASS);
  if (stableTokens) {
    return stableTokens;
  }

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

async function createStudent(request: APIRequestContext, adminAccess: string, stamp: string, suffix: string) {
  const resp = await request.post(`${API}/api/v1/students/`, {
    data: {
      name: `[E2E-${stamp}] 학부모전환 ${suffix}`,
      ps_number: `E2E${stamp}${suffix}`,
      no_phone: true,
      phone: "",
      parent_phone: PARENT_PHONE,
      initial_password: "1234",
      school_type: "HIGH",
      grade: 1,
      gender: suffix === "A" ? "M" : "F",
      high_school: "E2E High",
      memo: `[E2E-${stamp}] parent switcher fixture`,
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
  const permanentBody = await permanent.json() as { deleted?: unknown };
  expect(typeof permanentBody.deleted).toBe("number");
}

test.describe("학부모 자녀 스위처", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("다중 자녀 학부모 — 칩 노출 + 전환 + 스크린샷", async ({ page }) => {
    const stamp = String(Date.now()).slice(-10);
    const adminTokens = await issueToken(page.request, ADMIN_USER, ADMIN_PASS);
    const createdIds: number[] = [];

    try {
      const first = await createStudent(page.request, adminTokens.access, stamp, "A");
      const second = await createStudent(page.request, adminTokens.access, stamp, "B");
      createdIds.push(first.id, second.id);

      /* 학부모 토큰 발급 */
      const tokens = await ensureParentTokens(page.request);

      await page.goto(`${BASE}/login`, { waitUntil: "commit" });
      await page.evaluate(({ access, refresh }) => {
        localStorage.setItem("access", access);
        localStorage.setItem("refresh", refresh);
        sessionStorage.setItem("tenantCode", "hakwonplus");
      }, tokens);

      await page.goto(`${BASE}/student/dashboard`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
      await expect(page.getByRole("region", { name: "우리 아이 요약" })).toBeVisible({ timeout: 15_000 });

      /* 자녀 스위처 — role=tablist + 자녀 2명 */
      const switcher = page.getByRole("tablist", { name: "자녀 선택" });
      await expect(switcher).toBeVisible({ timeout: 8_000 });

      const tabs = switcher.getByRole("tab");
      await expect(tabs).toHaveCount(2);

      /* 첫 자녀 활성 */
      const firstActive = await tabs.first().getAttribute("aria-selected");
      expect(firstActive).toBe("true");

      /* 초기 스크린샷 */
      await page.screenshot({ path: "e2e/screenshots/parent-switcher-initial.png", fullPage: true });

      /* 두 번째 자녀 클릭 → 활성 전환 */
      await tabs.nth(1).click();
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

      const secondActive = await tabs.nth(1).getAttribute("aria-selected");
      expect(secondActive).toBe("true");
      const firstActiveAfter = await tabs.first().getAttribute("aria-selected");
      expect(firstActiveAfter).toBe("false");
      await expect(page.getByRole("region", { name: "우리 아이 요약" })).toBeVisible({ timeout: 15_000 });

      /* 전환 후 스크린샷 */
      await page.screenshot({ path: "e2e/screenshots/parent-switcher-after-switch.png", fullPage: true });
    } finally {
      await cleanupStudents(page.request, adminTokens.access, createdIds);
    }
  });
});
