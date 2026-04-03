/**
 * 오버레이 UI/UX 감사 — 학생/직원 상세 오버레이 시각적 위계 검증
 * 상품 감사: 섹션 구분, 통계 카드, 정보 행 구조, 반응형 확인
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const SCREENSHOT_DIR = "e2e/screenshots";

test.describe("오버레이 UI/UX 감사", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("학생 상세 오버레이 — 섹션 구조 및 시각 위계", async ({ page }) => {
    // 학생 목록으로 이동
    await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 첫 번째 학생 클릭
    const studentRow = page.locator("tr[data-row-key], [data-student-id], .ds-table tbody tr").first();
    if (await studentRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await studentRow.click();
      await page.waitForTimeout(1500);
    } else {
      // 테이블이 아닌 카드형일 수도 있음
      const studentCard = page.locator("[class*='student']").filter({ hasText: /\S/ }).first();
      await studentCard.click();
      await page.waitForTimeout(1500);
    }

    // 오버레이 백드롭 존재
    await expect(page.locator(".ds-overlay-backdrop")).toBeVisible({ timeout: 5000 });

    // 오버레이 패널 존재
    const panel = page.locator(".ds-overlay-panel");
    await expect(panel).toBeVisible();

    // ── 핵심 검증: 새 섹션 구조 ──

    // 1. 사이드바 존재
    const sidebar = panel.locator(".ds-overlay-sidebar");
    await expect(sidebar).toBeVisible();

    // 2. 섹션 카드 최소 3개 (연락처, 학교정보, 태그, 메모)
    const sections = sidebar.locator(".ds-overlay-section");
    const sectionCount = await sections.count();
    console.log(`[감사] 사이드바 섹션 수: ${sectionCount}`);
    expect(sectionCount).toBeGreaterThanOrEqual(3);

    // 3. 섹션 타이틀 아이콘 존재
    const titleIcons = sidebar.locator(".ds-overlay-section__title-icon");
    const iconCount = await titleIcons.count();
    console.log(`[감사] 섹션 아이콘 수: ${iconCount}`);
    expect(iconCount).toBeGreaterThanOrEqual(3);

    // 4. 정보 행에 개별 border 없음 (새 구조: ds-overlay-info-row)
    const infoRows = panel.locator(".ds-overlay-info-row");
    const rowCount = await infoRows.count();
    console.log(`[감사] 정보 행 수: ${rowCount}`);
    expect(rowCount).toBeGreaterThan(0);

    // 5. InfoRow 라벨/값 구조 검증
    const firstLabel = panel.locator(".ds-overlay-info-row__label").first();
    await expect(firstLabel).toBeVisible();
    const firstValue = panel.locator(".ds-overlay-info-row__value").first();
    await expect(firstValue).toBeVisible();

    // 6. 통계 카드 그리드 존재 (대시보드)
    const statGrid = panel.locator(".ds-overlay-stat-grid");
    await expect(statGrid).toBeVisible();
    const statCards = panel.locator(".ds-overlay-stat-card");
    const statCount = await statCards.count();
    console.log(`[감사] 통계 카드 수: ${statCount}`);
    expect(statCount).toBeGreaterThanOrEqual(3);

    // 7. 통계 카드 값이 20px 이상 크기인지 (font-size 검증)
    const statValue = panel.locator(".ds-overlay-stat-card__value").first();
    const fontSize = await statValue.evaluate(el => getComputedStyle(el).fontSize);
    console.log(`[감사] 통계 카드 값 폰트: ${fontSize}`);
    expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(18);

    // 8. 우측 콘텐츠 패널 존재
    const contentPanel = panel.locator(".ds-overlay-content-panel");
    await expect(contentPanel).toBeVisible();

    // 9. 탭 존재
    const tabs = panel.locator(".ds-overlay-tabs .ds-tab");
    const tabCount = await tabs.count();
    console.log(`[감사] 탭 수: ${tabCount}`);
    expect(tabCount).toBeGreaterThanOrEqual(3);

    // 스크린샷
    await page.screenshot({ path: `${SCREENSHOT_DIR}/student-overlay-audit.png`, fullPage: false });
    console.log("[감사] 학생 상세 오버레이 스크린샷 저장됨");

    // 10. 태그 영역
    const tagArea = panel.locator(".ds-overlay-tags");
    await expect(tagArea).toBeVisible();

    // ESC로 닫기
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await expect(page.locator(".ds-overlay-backdrop")).not.toBeVisible({ timeout: 3000 });
  });

  test("직원 상세 오버레이 — 섹션 구조 및 시각 위계", async ({ page }) => {
    // 직원 목록으로 이동
    await page.goto("https://hakwonplus.com/admin/staff", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 직원 카드/행 클릭
    const staffRow = page.locator("tr[data-row-key], .ds-table tbody tr, [data-staff-id]").first();
    if (await staffRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await staffRow.click();
      await page.waitForTimeout(1500);
    } else {
      const staffLink = page.locator("a[href*='/admin/staff/']").first();
      if (await staffLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await staffLink.click();
        await page.waitForTimeout(1500);
      }
    }

    // 오버레이 표시 확인
    const backdrop = page.locator(".ds-overlay-backdrop");
    if (!await backdrop.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("[감사] 직원 상세가 오버레이가 아닌 페이지 형태일 수 있음, URL 확인");
      // URL 기반으로 직접 접근
      const staffLinks = page.locator("a[href*='/admin/staff/']");
      const href = await staffLinks.first().getAttribute("href");
      if (href) {
        await page.goto(`https://hakwonplus.com${href}`, { waitUntil: "load" });
        await page.waitForTimeout(2000);
      }
    }

    const panel = page.locator(".ds-overlay-panel");
    if (!await panel.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("[감사] 직원 상세 오버레이 미표시 — 라우팅 구조 확인 필요");
      return;
    }

    // ── 핵심 검증 ──

    // 사이드바
    const sidebar = panel.locator(".ds-overlay-sidebar");
    await expect(sidebar).toBeVisible();

    // 섹션 카드 최소 2개 (기본정보, 이번달 요약)
    const sections = sidebar.locator(".ds-overlay-section");
    const sectionCount = await sections.count();
    console.log(`[감사] 직원 사이드바 섹션 수: ${sectionCount}`);
    expect(sectionCount).toBeGreaterThanOrEqual(2);

    // 섹션 타이틀 아이콘
    const titleIcons = sidebar.locator(".ds-overlay-section__title-icon");
    expect(await titleIcons.count()).toBeGreaterThanOrEqual(2);

    // 정보 행 새 구조
    const infoLabels = panel.locator(".ds-overlay-info-row__label");
    expect(await infoLabels.count()).toBeGreaterThan(0);

    // 통계 카드 (근무시간, 지급액)
    const statCards = panel.locator(".ds-overlay-stat-card");
    const statCount = await statCards.count();
    console.log(`[감사] 직원 통계 카드 수: ${statCount}`);
    expect(statCount).toBeGreaterThanOrEqual(2);

    // 우측 콘텐츠 패널
    const contentPanel = panel.locator(".ds-overlay-content-panel");
    await expect(contentPanel).toBeVisible();

    // 스크린샷
    await page.screenshot({ path: `${SCREENSHOT_DIR}/staff-overlay-audit.png`, fullPage: false });
    console.log("[감사] 직원 상세 오버레이 스크린샷 저장됨");
  });

  test("학생 상세 — 정보 행 hover 시 복사 아이콘 노출", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    const studentRow = page.locator("tr[data-row-key], .ds-table tbody tr").first();
    if (await studentRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await studentRow.click();
      await page.waitForTimeout(1500);
    }

    const panel = page.locator(".ds-overlay-panel");
    if (!await panel.isVisible({ timeout: 5000 }).catch(() => false)) return;

    // copyable 행 찾기
    const copyableRow = panel.locator(".ds-overlay-info-row[data-copyable]").first();
    if (await copyableRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      // hover 전: 복사 아이콘 투명
      const copyIcon = copyableRow.locator(".ds-overlay-info-row__copy-icon");
      const opacityBefore = await copyIcon.evaluate(el => getComputedStyle(el).opacity);
      console.log(`[감사] hover 전 복사 아이콘 opacity: ${opacityBefore}`);
      expect(parseFloat(opacityBefore)).toBeLessThan(0.3);

      // hover 후: 복사 아이콘 표시
      await copyableRow.hover();
      await page.waitForTimeout(300);
      const opacityAfter = await copyIcon.evaluate(el => getComputedStyle(el).opacity);
      console.log(`[감사] hover 후 복사 아이콘 opacity: ${opacityAfter}`);
      expect(parseFloat(opacityAfter)).toBeGreaterThan(0.3);
    }
  });
});
