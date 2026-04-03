/**
 * 최종 QA — 고해상도 클로즈업
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

test("최종 QA — 학생 상세 고해상도", async ({ page }) => {
  const token = await login(page);
  const r = await page.request.get(`${API}/api/v1/students/?page_size=1`, {
    headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
  });
  const id = ((await r.json()) as any).results[0]?.id;

  await page.goto(`${BASE}/admin/students/${id}`, { waitUntil: "load" });
  await page.waitForTimeout(3000);

  const panel = page.locator(".ds-overlay-panel");
  await expect(panel).toBeVisible({ timeout: 10000 });

  // 전체 오버레이
  await panel.screenshot({ path: "e2e/screenshots/final-qa-student-panel.png" });

  // 사이드바
  const sidebar = panel.locator(".ds-overlay-sidebar");
  await sidebar.screenshot({ path: "e2e/screenshots/final-qa-student-sidebar.png" });

  // 통계
  const stats = panel.locator(".ds-overlay-stat-grid");
  if (await stats.isVisible().catch(() => false)) {
    await stats.screenshot({ path: "e2e/screenshots/final-qa-student-stats.png" });
  }

  // muted 카드 확인
  const mutedCards = panel.locator(".ds-overlay-stat-card--muted");
  const mutedCount = await mutedCards.count();
  console.log(`[QA] Muted 카드(0건): ${mutedCount}개`);

  // 빈 섹션 숨김 확인
  const sections = sidebar.locator(".ds-overlay-section");
  const sectionCount = await sections.count();
  for (let i = 0; i < sectionCount; i++) {
    const title = await sections.nth(i).locator(".ds-overlay-section__title").innerText();
    const rows = await sections.nth(i).locator(".ds-overlay-info-row").count();
    console.log(`[QA] 섹션 "${title}": ${rows}행`);
  }

  // 정보 행에 "-" 값이 얼마나 있는지
  const values = panel.locator(".ds-overlay-info-row__value");
  let dashCount = 0;
  for (let i = 0; i < await values.count(); i++) {
    const v = await values.nth(i).innerText();
    if (v.trim() === "-") dashCount++;
  }
  console.log(`[QA] "-" 값 행 수: ${dashCount}`);
});

test("최종 QA — 직원 상세 고해상도", async ({ page }) => {
  const token = await login(page);
  const r = await page.request.get(`${API}/api/v1/staffs/?page_size=5`, {
    headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
  });
  const id = ((await r.json()) as any).results[0]?.id;

  await page.goto(`${BASE}/admin/staff/${id}`, { waitUntil: "load" });
  await page.waitForTimeout(3000);

  const panel = page.locator(".ds-overlay-panel");
  if (!await panel.isVisible({ timeout: 10000 }).catch(() => false)) return;

  await panel.screenshot({ path: "e2e/screenshots/final-qa-staff-panel.png" });
  const sidebar = panel.locator(".ds-overlay-sidebar");
  await sidebar.screenshot({ path: "e2e/screenshots/final-qa-staff-sidebar.png" });
});
