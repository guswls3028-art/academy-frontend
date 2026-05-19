// PATH: e2e/admin/matchup-final-review-2026-05-09.spec.ts
//
// 자료 유형 자동화 배포 후 종합 시각 리뷰.
// 목적: 학원장 시야로 자연스러운지 + 결함 잡아내기.
// 다양한 paper_type doc + 업로드 모달 단계별 + 모바일 + 적중보고서.

import { test, expect, type Page } from "@playwright/test";

const BASE = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
const ADMIN_USER = "admin97";
const ADMIN_PASS = "koreaseoul97";
const TENANT = "hakwonplus";

const OUT = "../_artifacts/sessions/matchup-final-review-2026-05-09";

async function login(page: import("@playwright/test").Page) {
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: TENANT },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT },
    timeout: 60_000,
  });
  expect(resp.status()).toBe(200);
  const tokens = await resp.json() as { access: string; refresh: string };
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
  }, tokens);
}

async function settle(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
}

async function waitForAnyVisible(page: Page, selector: string, timeout = 5000): Promise<void> {
  await page.locator(selector).first().waitFor({ state: "visible", timeout }).catch(() => {});
}

test.describe("매치업 종합 시각 리뷰 2026-05-09", () => {
  test.setTimeout(180_000);

  test("01 - 1920 랜딩 (doc 자동선택 자연스러운지)", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await settle(page);
    await page.screenshot({ path: `${OUT}/01-landing-1920.png`, fullPage: true });

    // 어떤 doc가 자동 선택됐는지 확인
    const selectedRow = page.locator('[data-testid="matchup-doc-row"][aria-selected="true"], [data-testid="matchup-doc-row"][data-selected="true"]');
    const cnt = await selectedRow.count();
    console.error("[INFO] auto-selected row count =", cnt);
    if (cnt > 0) {
      const title = await selectedRow.first().getAttribute("data-doc-title").catch(() => "");
      console.error("[INFO] auto-selected doc title =", title);
    }
  });

  test("02 - 다양한 paper_type doc 헤더+배너 (3건)", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await settle(page);

    const allRows = page.locator('[data-testid="matchup-doc-row"][data-doc-status="done"]');
    const total = await allRows.count();
    // 1, 5, 10번째 doc 선택 — 다양한 케이스
    const indices = [0, Math.floor(total / 3), Math.floor(total * 2 / 3)];
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      if (idx >= total) continue;
      await allRows.nth(idx).click();
      await waitForAnyVisible(page, "[data-testid='document-guidance-banner'], [data-testid='matchup-problem-card']", 8000);

      const banner = page.locator('[data-testid="document-guidance-banner"]');
      const paperType = await banner.getAttribute("data-paper-type").catch(() => "");
      const quality = await banner.getAttribute("data-quality").catch(() => "");
      console.error(`[DOC ${idx}] paper_type=${paperType} quality=${quality}`);

      await page.screenshot({ path: `${OUT}/02-doc-${idx}-${paperType}.png`, fullPage: true });
    }
  });

  test("03 - 업로드 모달 단계별 (empty / 1 file / multi files)", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await settle(page);

    const upBtn = page.locator('button:has-text("자료 등록"), button:has-text("참고자료")').first();
    if (await upBtn.count() === 0) {
      await page.locator('button:has-text("업로드"), button:has-text("시험지")').first().click();
    } else {
      await upBtn.click();
    }

    const modal = page.locator('[data-testid="matchup-upload-modal"]');
    await expect(modal).toBeVisible();
    await modal.screenshot({ path: `${OUT}/03a-modal-empty.png` });

    // 1개 파일
    const fileInput = page.locator('[data-testid="matchup-file-input"]');
    const auto = page.locator('[data-testid="matchup-upload-source-type-auto"]');
    await fileInput.setInputFiles({
      name: "쎈_고1수학_2026.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 dummy"),
    });
    await expect(auto).toBeVisible({ timeout: 5000 });
    await modal.screenshot({ path: `${OUT}/03b-modal-1file-ssen.png` });

    const st1 = await auto.getAttribute("data-source-type");
    const r1 = await auto.getAttribute("data-source-type-reason");
    console.error("[1file] sourceType=", st1, "reason=", r1);

    // 다수 파일
    await fileInput.setInputFiles([
      { name: "기출_2026_중간고사_1.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 a") },
      { name: "기출_2026_중간고사_2.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 b") },
      { name: "기출_2026_중간고사_3.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 c") },
    ]);
    await expect(auto).toBeVisible({ timeout: 5000 });
    await modal.screenshot({ path: `${OUT}/03c-modal-multi-files.png` });

    const st2 = await auto.getAttribute("data-source-type");
    const r2 = await auto.getAttribute("data-source-type-reason");
    console.error("[multi] sourceType=", st2, "reason=", r2);
  });

  test("04 - 모바일 1100 viewport 전체", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await settle(page);
    await page.screenshot({ path: `${OUT}/04a-mobile-1100-landing.png`, fullPage: true });

    // 업로드 모달 모바일
    const upBtn = page.locator('button:has-text("업로드"), button:has-text("시험지"), button:has-text("자료 등록")').first();
    await upBtn.click();
    await expect(page.locator('[data-testid="matchup-upload-modal"]')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `${OUT}/04b-mobile-1100-modal.png`, fullPage: true });
    await ctx.close();
  });

  test("05 - 1366 viewport (좁은 데스크탑)", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await settle(page);
    await page.screenshot({ path: `${OUT}/05-1366-landing.png`, fullPage: true });
    await ctx.close();
  });

  test("06 - 적중보고서 편집기 진입", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await settle(page);

    const reportBtn = page.locator('button:has-text("적중 보고서 작성"), button:has-text("보고서")').first();
    if (await reportBtn.count() > 0) {
      await reportBtn.click();
      await waitForAnyVisible(page, "text=/홈페이지에 게시|게시 취소|재편집 시작|적중 보고서/", 8000);
      await page.screenshot({ path: `${OUT}/06-hit-report-editor.png`, fullPage: true });
    }
  });
});
