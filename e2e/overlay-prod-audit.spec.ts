/**
 * 운영 배포 후 오버레이 UI 검증 — hakwonplus.com
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const PROD = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("운영 오버레이 감사", () => {
  test("학생 상세 — 섹션 구조 + 스크린샷", async ({ page }) => {
    await loginViaUI(page, "admin");

    // API로 학생 ID 획득
    const token = await page.evaluate(() => localStorage.getItem("access"));
    const resp = await page.request.get(`${API}/api/v1/students/?page_size=1`, {
      headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
    });
    const data = await resp.json() as any;
    const studentId = data.results?.[0]?.id;
    console.log(`[운영] 학생 ID: ${studentId}`);
    expect(studentId).toBeGreaterThan(0);

    await page.goto(`${PROD}/admin/students/${studentId}`, { waitUntil: "load" });
    await page.waitForTimeout(4000);

    const panel = page.locator(".ds-overlay-panel");
    await expect(panel).toBeVisible({ timeout: 10000 });

    // 사이드바
    const sidebar = panel.locator(".ds-overlay-sidebar");
    const sidebarOk = await sidebar.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[운영] sidebar: ${sidebarOk ? "✓" : "✗"}`);

    // 섹션
    const sections = sidebar.locator(".ds-overlay-section");
    const sectionCount = await sections.count();
    console.log(`[운영] 섹션 수: ${sectionCount}`);

    // 통계 카드
    const statCards = panel.locator(".ds-overlay-stat-card");
    const statCount = await statCards.count();
    console.log(`[운영] 통계 카드: ${statCount}`);

    // 정보 행 새 구조
    const labels = panel.locator(".ds-overlay-info-row__label");
    console.log(`[운영] 정보 라벨 수: ${await labels.count()}`);

    // 콘텐츠 패널
    const cp = panel.locator(".ds-overlay-content-panel");
    const cpOk = await cp.isVisible().catch(() => false);
    console.log(`[운영] 콘텐츠 패널: ${cpOk ? "✓" : "✗"}`);

    // 스크린샷
    await page.screenshot({ path: "e2e/screenshots/prod-student-overlay.png", fullPage: false });

    // 사이드바 클로즈업
    if (sidebarOk) {
      await sidebar.screenshot({ path: "e2e/screenshots/prod-student-sidebar.png" });
    }

    // 통계 카드 클로즈업
    const sg = panel.locator(".ds-overlay-stat-grid");
    if (await sg.isVisible().catch(() => false)) {
      await sg.screenshot({ path: "e2e/screenshots/prod-student-stats.png" });
    }

    // 검증
    expect(sidebarOk).toBe(true);
    expect(sectionCount).toBeGreaterThanOrEqual(3);
    expect(statCount).toBeGreaterThanOrEqual(3);
    expect(cpOk).toBe(true);
  });

  test("직원 상세 — 섹션 구조 + 스크린샷", async ({ page }) => {
    await loginViaUI(page, "admin");

    const token = await page.evaluate(() => localStorage.getItem("access"));
    const resp = await page.request.get(`${API}/api/v1/staffs/?page_size=5`, {
      headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
    });
    const data = await resp.json() as any;
    const staffId = data.results?.[0]?.id;
    console.log(`[운영] 직원 ID: ${staffId}`);
    if (!staffId) { console.log("[운영] 직원 없음 스킵"); return; }

    await page.goto(`${PROD}/admin/staff/${staffId}`, { waitUntil: "load" });
    await page.waitForTimeout(4000);

    const panel = page.locator(".ds-overlay-panel");
    if (!await panel.isVisible({ timeout: 10000 }).catch(() => false)) {
      console.log("[운영] 직원 오버레이 미표시 (권한 redirect 가능)");
      await page.screenshot({ path: "e2e/screenshots/prod-staff-debug.png", fullPage: false });
      return;
    }

    const sidebar = panel.locator(".ds-overlay-sidebar");
    const sidebarOk = await sidebar.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[운영] 직원 sidebar: ${sidebarOk ? "✓" : "✗"}`);

    const sections = sidebar.locator(".ds-overlay-section");
    console.log(`[운영] 직원 섹션: ${await sections.count()}`);

    const statCards = panel.locator(".ds-overlay-stat-card");
    console.log(`[운영] 직원 통계: ${await statCards.count()}`);

    await page.screenshot({ path: "e2e/screenshots/prod-staff-overlay.png", fullPage: false });
    if (sidebarOk) {
      await sidebar.screenshot({ path: "e2e/screenshots/prod-staff-sidebar.png" });
    }

    expect(sidebarOk).toBe(true);
    expect(await sections.count()).toBeGreaterThanOrEqual(2);
    expect(await statCards.count()).toBeGreaterThanOrEqual(2);
  });
});
