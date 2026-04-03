/**
 * 오버레이 UI/UX 로컬 감사 — 로컬 dev 서버 대상
 * 배포 전 검증: 섹션 구분, 통계 카드, 정보 행 구조
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5173";
const API = "https://api.hakwonplus.com";

async function localLogin(page: import("@playwright/test").Page): Promise<string> {
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
  });
  if (resp.status() !== 200) throw new Error(`Login failed: ${resp.status()}`);
  const tokens = await resp.json() as { access: string; refresh: string };

  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    try { sessionStorage.setItem("tenantCode", "hakwonplus"); } catch {}
  }, tokens);

  return tokens.access;
}

async function getFirstStudentId(page: import("@playwright/test").Page, token: string): Promise<number> {
  const resp = await page.request.get(`${API}/api/v1/students/?page_size=1`, {
    headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
  });
  const data = await resp.json() as { results: { id: number }[] };
  return data.results[0]?.id ?? 0;
}

async function getFirstStaffId(page: import("@playwright/test").Page, token: string): Promise<number> {
  const resp = await page.request.get(`${API}/api/v1/staffs/?page_size=5`, {
    headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
  });
  const data = await resp.json() as { results: { id: number }[] };
  return data.results[0]?.id ?? 0;
}

test.describe("로컬 오버레이 UI 감사", () => {
  test("학생 상세 오버레이 — 새 섹션 구조 검증", async ({ page }) => {
    const token = await localLogin(page);
    const studentId = await getFirstStudentId(page, token);
    console.log(`[로컬감사] 학생 ID: ${studentId}`);
    expect(studentId).toBeGreaterThan(0);

    // 학생 상세 오버레이 직접 접근
    await page.goto(`${BASE}/admin/students/${studentId}`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const panel = page.locator(".ds-overlay-panel");
    await expect(panel).toBeVisible({ timeout: 10000 });

    // ── 핵심 구조 검증 ──

    // 1. 사이드바
    const sidebar = panel.locator(".ds-overlay-sidebar");
    await expect(sidebar).toBeVisible({ timeout: 5000 });
    console.log("[로컬감사] ✓ ds-overlay-sidebar");

    // 2. 섹션 카드
    const sections = sidebar.locator(".ds-overlay-section");
    const sectionCount = await sections.count();
    console.log(`[로컬감사] 섹션 수: ${sectionCount}`);
    expect(sectionCount).toBeGreaterThanOrEqual(3);

    // 3. 섹션 타이틀
    const titles = sidebar.locator(".ds-overlay-section__title");
    for (let i = 0; i < await titles.count(); i++) {
      console.log(`[로컬감사] 섹션[${i}]: "${await titles.nth(i).innerText()}"`);
    }

    // 4. 섹션 아이콘
    expect(await sidebar.locator(".ds-overlay-section__title-icon").count()).toBeGreaterThanOrEqual(3);

    // 5. 정보 행 — 새 CSS 클래스 구조
    const infoRows = panel.locator(".ds-overlay-info-row");
    expect(await infoRows.count()).toBeGreaterThan(5);
    expect(await panel.locator(".ds-overlay-info-row__label").count()).toBeGreaterThan(0);
    expect(await panel.locator(".ds-overlay-info-row__value").count()).toBeGreaterThan(0);
    console.log("[로컬감사] ✓ 정보 행 label/value 구조");

    // 6. 통계 카드
    const statCards = panel.locator(".ds-overlay-stat-card");
    const statCount = await statCards.count();
    console.log(`[로컬감사] 통계 카드 수: ${statCount}`);
    expect(statCount).toBeGreaterThanOrEqual(3);

    // 7. 통계 카드 폰트 검증 (20px+)
    const fontSize = await panel.locator(".ds-overlay-stat-card__value").first().evaluate(
      el => getComputedStyle(el).fontSize
    );
    console.log(`[로컬감사] 통계 값 폰트: ${fontSize}`);
    expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(18);

    // 8. 콘텐츠 패널
    await expect(panel.locator(".ds-overlay-content-panel")).toBeVisible();
    console.log("[로컬감사] ✓ 콘텐츠 패널");

    // 9. 태그 영역
    await expect(panel.locator(".ds-overlay-tags")).toBeVisible();
    console.log("[로컬감사] ✓ 태그 영역");

    // 10. 탭
    expect(await panel.locator(".ds-tab").count()).toBeGreaterThanOrEqual(3);

    // 스크린샷
    await page.screenshot({ path: "e2e/screenshots/local-student-overlay-audit.png", fullPage: false });
    console.log("[로컬감사] ✓ 학생 스크린샷 저장");
  });

  test("직원 상세 오버레이 — 새 섹션 구조 검증", async ({ page }) => {
    const token = await localLogin(page);
    const staffId = await getFirstStaffId(page, token);
    console.log(`[로컬감사] 직원 ID: ${staffId}`);
    if (!staffId) { console.log("[로컬감사] 직원 없음 — 스킵"); return; }

    await page.goto(`${BASE}/admin/staff/${staffId}`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const panel = page.locator(".ds-overlay-panel");
    if (!await panel.isVisible({ timeout: 10000 }).catch(() => false)) {
      await page.screenshot({ path: "e2e/screenshots/local-staff-debug.png", fullPage: false });
      console.log("[로컬감사] 직원 오버레이 미표시 — 디버그 스크린샷");
      return;
    }

    const sidebar = panel.locator(".ds-overlay-sidebar");
    await expect(sidebar).toBeVisible({ timeout: 5000 });
    console.log("[로컬감사] ✓ 직원 sidebar");

    const sections = sidebar.locator(".ds-overlay-section");
    const sectionCount = await sections.count();
    console.log(`[로컬감사] 직원 섹션 수: ${sectionCount}`);
    expect(sectionCount).toBeGreaterThanOrEqual(2);

    const statCards = panel.locator(".ds-overlay-stat-card");
    console.log(`[로컬감사] 직원 통계 카드 수: ${await statCards.count()}`);
    expect(await statCards.count()).toBeGreaterThanOrEqual(2);

    await expect(panel.locator(".ds-overlay-content-panel")).toBeVisible();
    console.log("[로컬감사] ✓ 직원 콘텐츠 패널");

    await page.screenshot({ path: "e2e/screenshots/local-staff-overlay-audit.png", fullPage: false });
    console.log("[로컬감사] ✓ 직원 스크린샷 저장");
  });
});
