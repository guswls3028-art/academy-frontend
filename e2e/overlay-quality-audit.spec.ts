/**
 * 상품 감사 — 고해상도 스크린샷 + 시각적 완성도 정밀 검증
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

async function getStudentId(page: import("@playwright/test").Page, token: string) {
  const r = await page.request.get(`${API}/api/v1/students/?page_size=1`, {
    headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
  });
  return ((await r.json()) as any).results[0]?.id ?? 0;
}
async function getStaffId(page: import("@playwright/test").Page, token: string) {
  const r = await page.request.get(`${API}/api/v1/staffs/?page_size=5`, {
    headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
  });
  return ((await r.json()) as any).results[0]?.id ?? 0;
}

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("상품 감사 — 오버레이 고해상도", () => {
  test("학생 상세 — 전체 + 섹션별 클로즈업", async ({ page }) => {
    const token = await login(page);
    const id = await getStudentId(page, token);
    await page.goto(`${BASE}/admin/students/${id}`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const panel = page.locator(".ds-overlay-panel");
    await expect(panel).toBeVisible({ timeout: 10000 });

    // 전체 뷰
    await page.screenshot({ path: "e2e/screenshots/qa-student-full.png", fullPage: false });

    // 좌측 사이드바 클로즈업
    const sidebar = panel.locator(".ds-overlay-sidebar");
    await sidebar.screenshot({ path: "e2e/screenshots/qa-student-sidebar.png" });

    // 통계 카드 클로즈업
    const statGrid = panel.locator(".ds-overlay-stat-grid");
    if (await statGrid.isVisible().catch(() => false)) {
      await statGrid.screenshot({ path: "e2e/screenshots/qa-student-stats.png" });
    }

    // 헤더 클로즈업
    const header = panel.locator(".ds-overlay-header");
    await header.screenshot({ path: "e2e/screenshots/qa-student-header.png" });

    // 정보 행 스타일 상세 감사
    const rows = panel.locator(".ds-overlay-info-row");
    for (let i = 0; i < Math.min(await rows.count(), 3); i++) {
      const row = rows.nth(i);
      const styles = await row.evaluate(el => {
        const cs = getComputedStyle(el);
        return {
          padding: cs.padding,
          borderBottom: cs.borderBottomWidth + " " + cs.borderBottomStyle + " " + cs.borderBottomColor,
          borderTop: cs.borderTopWidth,
          background: cs.backgroundColor,
          fontSize: cs.fontSize,
        };
      });
      console.log(`[감사] InfoRow[${i}]:`, JSON.stringify(styles));
    }

    // 섹션 타이틀 스타일 감사
    const title = sidebar.locator(".ds-overlay-section__title").first();
    const titleStyles = await title.evaluate(el => {
      const cs = getComputedStyle(el);
      return {
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        color: cs.color,
        borderBottom: cs.borderBottomWidth + " " + cs.borderBottomStyle,
        paddingBottom: cs.paddingBottom,
      };
    });
    console.log("[감사] 섹션 타이틀:", JSON.stringify(titleStyles));

    // 통계 카드 스타일 감사
    const card = panel.locator(".ds-overlay-stat-card").first();
    const cardStyles = await card.evaluate(el => {
      const cs = getComputedStyle(el);
      return {
        padding: cs.padding,
        borderRadius: cs.borderRadius,
        background: cs.backgroundColor,
      };
    });
    console.log("[감사] 통계 카드:", JSON.stringify(cardStyles));

    const valueStyles = await panel.locator(".ds-overlay-stat-card__value").first().evaluate(el => {
      const cs = getComputedStyle(el);
      return { fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color };
    });
    console.log("[감사] 통계 값:", JSON.stringify(valueStyles));
  });

  test("직원 상세 — 전체 + 섹션별 클로즈업", async ({ page }) => {
    const token = await login(page);
    const id = await getStaffId(page, token);
    if (!id) return;

    await page.goto(`${BASE}/admin/staff/${id}`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const panel = page.locator(".ds-overlay-panel");
    if (!await panel.isVisible({ timeout: 10000 }).catch(() => false)) return;

    await page.screenshot({ path: "e2e/screenshots/qa-staff-full.png", fullPage: false });

    const sidebar = panel.locator(".ds-overlay-sidebar");
    await sidebar.screenshot({ path: "e2e/screenshots/qa-staff-sidebar.png" });

    const statCards = panel.locator(".ds-overlay-stat-card");
    if (await statCards.first().isVisible().catch(() => false)) {
      await panel.locator(".ds-overlay-stat-grid").screenshot({ path: "e2e/screenshots/qa-staff-stats.png" });
    }
  });
});
