// PATH: e2e/admin/matchup-prod-verification-2026-05-08.spec.ts
//
// 운영 실사용 검증 — hakwonplus.com 에서 P0+P1+P2 변경 노출 확인.
// CF Pages auto deploy 후 운영 URL 에서 직접 시각 검수.
// T1 admin 만 사용 (memory: feedback_no_e2e_on_real_tenants).

import { test, expect } from "@playwright/test";

const BASE = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
const ADMIN_USER = "admin97";
const ADMIN_PASS = "koreaseoul97";
const TENANT = "hakwonplus";

const ARTIFACTS = "_artifacts/sessions/matchup-prod-verify-2026-05-08";

test.describe("매치업 운영 검증", () => {
  test.setTimeout(180_000);

  test("운영 URL 매치업 페이지 신규 카피 + 헤더 정비 확인", async ({ page }) => {
    page.on("pageerror", (e) => console.error("[PAGEERROR]", e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const t = msg.text();
        // 알려진 baseline noise 무시
        if (t.includes("destroyOnClose")) return;
        console.error("[CONSOLE.error]", t);
      }
    });

    // API token
    const resp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: TENANT },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT },
      timeout: 60_000,
    });
    expect(resp.status()).toBe(200);
    const tokens = await resp.json() as { access: string; refresh: string };

    // 운영은 hostname 기반 tenant 인식 → /login 직접 진입.
    await page.addInitScript(({ access, refresh }) => {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
    }, { access: tokens.access, refresh: tokens.refresh });

    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    expect(page.url()).toContain("/admin/storage/matchup");
    await page.screenshot({ path: `${ARTIFACTS}/01-prod-landing.png`, fullPage: true });

    // done doc 1건 선택
    const doneRow = page.locator('[data-testid="matchup-doc-row"][data-doc-status="done"]').first();
    if (await doneRow.count() > 0) {
      await doneRow.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${ARTIFACTS}/02-prod-doc-selected.png`, fullPage: true });

      // 헤더 정비 확인 — "범위 일괄삭제" 버튼이 헤더에서 사라졌고 ⋮ 안으로 이동
      const bulkBtnHeader = page.locator('[data-testid="matchup-doc-bulk-delete-btn"]');
      const headerBulkCount = await bulkBtnHeader.count();
      console.error("[VERIFY] header bulk-delete button count =", headerBulkCount, "(expected: 0)");

      // ⋮ 메뉴 열어서 메뉴 항목 확인
      const moreBtn = page.locator('[data-testid="matchup-doc-more-menu-trigger"]');
      if (await moreBtn.count() > 0) {
        await moreBtn.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${ARTIFACTS}/03-prod-more-menu.png`, fullPage: true });
        // 메뉴 안에 일괄삭제 항목 노출 확인
        const bulkItem = page.locator('[data-testid="matchup-doc-bulk-delete-menu-item"]');
        const inMenuCount = await bulkItem.count();
        console.error("[VERIFY] more-menu bulk-delete item count =", inMenuCount, "(expected: 1)");
        await page.keyboard.press("Escape");
      }

      // DocumentGuidanceBanner 톤 정합 — info+warning 텍스트
      const bannerInfo = page.locator('[data-testid="document-guidance-info"]');
      const bannerWarning = page.locator('[data-testid="document-guidance-warning"]');
      console.error("[VERIFY] banner info =", await bannerInfo.count(), "/ warning =", await bannerWarning.count());
      const banner = page.locator('[data-testid="document-guidance-banner"]');
      if (await banner.count() > 0) {
        await banner.first().screenshot({ path: `${ARTIFACTS}/04-prod-banner.png` });
      }

      // 일괄삭제 모달 — ⋮ 메뉴에서 클릭
      const moreBtn2 = page.locator('[data-testid="matchup-doc-more-menu-trigger"]');
      if (await moreBtn2.count() > 0) {
        await moreBtn2.click();
        await page.waitForTimeout(300);
        const bulkItem2 = page.locator('[data-testid="matchup-doc-bulk-delete-menu-item"]');
        if (await bulkItem2.count() > 0) {
          await bulkItem2.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${ARTIFACTS}/05-prod-bulk-modal.png`, fullPage: true });
          const input = page.locator('[data-testid="matchup-bulk-delete-input"]');
          if (await input.count() > 0) {
            await input.fill("1");
            await page.waitForTimeout(400);
            await page.screenshot({ path: `${ARTIFACTS}/06-prod-bulk-preview.png`, fullPage: true });
          }
          await page.keyboard.press("Escape");
        }
      }
    }
  });
});
