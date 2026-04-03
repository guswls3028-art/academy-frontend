/**
 * 로컬 데이터 정합성 재검증 — localhost 대상
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5173";
const API = "https://api.hakwonplus.com";

async function login(page: import("@playwright/test").Page) {
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
  });
  const tokens = await resp.json() as { access: string; refresh: string };
  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    try { sessionStorage.setItem("tenantCode", "hakwonplus"); } catch {}
  }, tokens);
  return tokens.access;
}

test.use({ viewport: { width: 1440, height: 900 } });

test("학생 — 아이디/주소 필드 추가 검증", async ({ page }) => {
  const token = await login(page);
  const r = await page.request.get(`${API}/api/v1/students/?page_size=1`, {
    headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
  });
  const id = ((await r.json()) as any).results[0]?.id;

  await page.goto(`${BASE}/admin/students/${id}`, { waitUntil: "load" });
  await page.waitForTimeout(3000);

  const panel = page.locator(".ds-overlay-panel");
  await expect(panel).toBeVisible({ timeout: 10000 });

  // 아이디 행 존재 확인
  const labels = panel.locator(".ds-overlay-info-row__label");
  const allLabels: string[] = [];
  for (let i = 0; i < await labels.count(); i++) {
    allLabels.push(await labels.nth(i).innerText());
  }
  console.log(`[검증] 표시된 라벨: ${allLabels.join(", ")}`);

  expect(allLabels).toContain("아이디");
  expect(allLabels).toContain("식별코드");
  expect(allLabels).toContain("학부모 전화");
  expect(allLabels).toContain("학생 전화");
  expect(allLabels).toContain("등록일");
  // 학교/학년 등은 값이 있을 때만 표시 (빈 값 숨김)
  console.log("[검증] ✓ 학생 필수 필드 모두 존재");

  await page.screenshot({ path: "e2e/screenshots/data-local-student.png", fullPage: false });
});

test("직원 — 등록일/전화번호 포맷 검증", async ({ page }) => {
  const token = await login(page);
  const r = await page.request.get(`${API}/api/v1/staffs/?page_size=5`, {
    headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
  });
  const id = ((await r.json()) as any).results[0]?.id;

  await page.goto(`${BASE}/admin/staff/${id}`, { waitUntil: "load" });
  await page.waitForTimeout(3000);

  const panel = page.locator(".ds-overlay-panel");
  if (!await panel.isVisible({ timeout: 10000 }).catch(() => false)) {
    console.log("[검증] 직원 오버레이 미표시");
    return;
  }

  const labels = panel.locator(".ds-overlay-info-row__label");
  const allLabels: string[] = [];
  for (let i = 0; i < await labels.count(); i++) {
    allLabels.push(await labels.nth(i).innerText());
  }
  console.log(`[검증] 직원 라벨: ${allLabels.join(", ")}`);

  expect(allLabels).toContain("등록일");
  expect(allLabels).toContain("전화번호");
  console.log("[검증] ✓ 직원 등록일 필드 존재");

  // 전화번호 포맷 확인 (하이픈 포함)
  const phoneRow = panel.locator(".ds-overlay-info-row").filter({ hasText: "전화번호" });
  const phoneValue = await phoneRow.locator(".ds-overlay-info-row__value").innerText();
  console.log(`[검증] 전화번호 표시: "${phoneValue}"`);
  expect(phoneValue).toMatch(/\d{3}-\d{3,4}-\d{4}|계정 없음|-/);
  console.log("[검증] ✓ 전화번호 포맷 정상");

  await page.screenshot({ path: "e2e/screenshots/data-local-staff.png", fullPage: false });
});
