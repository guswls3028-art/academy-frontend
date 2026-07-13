// PATH: e2e/admin/matchup-realuse-2026-05-09.spec.ts
//
// 매치업 실사용 UX 리뷰 — 2026-05-09.
// 5/8 audit v2 (b722d194) 이후 회귀/잔여 결함 캐치 + 신규 doc 업로드
// 작업박스 (진행률 / 삭제 / 자동이동) 자연 검증.
// 실데이터 read-only 검증 위주 — 신규 업로드는 별도 스펙에서.

import { test, expect, type Page } from "../fixtures/strictTest";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

const BASE = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
const ADMIN_USER = "admin97";
const ADMIN_PASS = "koreaseoul97";
const TENANT = "hakwonplus";

const OUT = "../_artifacts/sessions/matchup-realuse-2026-05-09";
const MATCHUP_URL = `${BASE}/admin/storage/matchup`;

async function login(page: Page) {
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

async function openMatchup(page: Page, settleMs = 1500): Promise<void> {
  await login(page);
  await gotoAndSettle(page, MATCHUP_URL, { timeout: 30_000, settleMs });
}

async function waitForDocList(page: Page): Promise<void> {
  await waitForCondition(
    async () => (await page.locator('[data-testid="matchup-doc-row"]').count()) > 0,
    { timeoutMs: 15_000, description: "matchup doc rows visible" },
  );
}

async function waitForDoneDocSelection(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await waitForCondition(
    async () =>
      (await page.locator('[data-testid="document-guidance-banner"]').count()) > 0 ||
      (await page.locator('[data-testid="matchup-problem-grid"]').count()) > 0 ||
      (await page.locator('[data-testid="matchup-right-panel"]').count()) > 0,
    { timeoutMs: 15_000, description: "done document detail settled" },
  ).catch(() => {});
}

test.describe("매치업 실사용 리뷰 2026-05-09", () => {
  test.setTimeout(300_000);

  test("01 - 매치업 페이지 진입 + 좌측 doc list 시각", async ({ page }) => {
    page.on("pageerror", (e) => console.error("[PAGEERROR]", e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const t = msg.text();
        if (t.includes("destroyOnClose")) return;
        if (t.includes("Failed to load resource")) return;
        console.error("[CONSOLE.error]", t);
      }
    });

    await openMatchup(page);
    await waitForDocList(page);

    await page.screenshot({ path: `${OUT}/01-landing-fullpage.png`, fullPage: true });

    const docRows = page.locator('[data-testid="matchup-doc-row"]');
    const total = await docRows.count();
    console.error("[INFO] total doc rows =", total);
    expect(total).toBeGreaterThan(0);

    // 상태별 분포
    const done = await page.locator('[data-testid="matchup-doc-row"][data-doc-status="done"]').count();
    const processing = await page.locator('[data-testid="matchup-doc-row"][data-doc-status="processing"]').count();
    const failed = await page.locator('[data-testid="matchup-doc-row"][data-doc-status="failed"]').count();
    const pending = await page.locator('[data-testid="matchup-doc-row"][data-doc-status="pending"]').count();
    console.error("[INFO] status distribution:", { done, processing, failed, pending });

    // 좌측 패널만 캡처
    const leftPanel = page.locator('[data-testid="matchup-doc-list"]').or(page.locator('aside').first());
    if (await leftPanel.count() > 0) {
      await leftPanel.first().screenshot({ path: `${OUT}/01b-doc-list.png` }).catch(() => {});
    }
  });

  test("02 - done doc 선택 + DocumentGuidanceBanner + ProblemGrid", async ({ page }) => {
    page.on("pageerror", (e) => console.error("[PAGEERROR]", e.message));
    await openMatchup(page);

    const doneRow = page.locator('[data-testid="matchup-doc-row"][data-doc-status="done"]').first();
    await expect(doneRow).toBeVisible();
    await doneRow.click();
    await waitForDoneDocSelection(page);

    await page.screenshot({ path: `${OUT}/02-done-doc-selected-fullpage.png`, fullPage: true });

    // 헤더 캡처
    const header = page.locator('[data-testid="matchup-page-header"]');
    if (await header.count() > 0) {
      await header.first().screenshot({ path: `${OUT}/02b-header.png` });
    }

    // 가이드 배너
    const banner = page.locator('[data-testid="document-guidance-banner"]');
    if (await banner.count() > 0) {
      await banner.first().screenshot({ path: `${OUT}/02c-banner.png` });
      const paperType = await banner.getAttribute("data-paper-type");
      const quality = await banner.getAttribute("data-quality");
      const indexable = await banner.getAttribute("data-indexable");
      console.error("[BANNER]", { paperType, quality, indexable });
    } else {
      console.error("[BANNER] not visible");
    }

    // 문항 그리드
    const grid = page.locator('[data-testid="matchup-problem-grid"]').or(page.locator('[class*="problem-grid"]')).first();
    if (await grid.count() > 0) {
      await grid.screenshot({ path: `${OUT}/02d-problem-grid.png` }).catch(() => {});
    }

    // 우측 panel (cross-matches / hit-report 진입)
    const rightPanel = page.locator('[data-testid="matchup-right-panel"]').or(page.locator('aside').last());
    if (await rightPanel.count() > 0) {
      await rightPanel.first().screenshot({ path: `${OUT}/02e-right-panel.png` }).catch(() => {});
    }
  });

  test("03 - 업로드 모달 진입 + source_type 선택 UI", async ({ page }) => {
    page.on("pageerror", (e) => console.error("[PAGEERROR]", e.message));
    await openMatchup(page, 1200);

    // 업로드 버튼 — "참고자료" or "시험지" 두 종류 가능. data-testid 우선.
    const uploadBtns = page.locator('button:has-text("업로드"), button:has-text("자료 등록"), button:has-text("시험지")');
    const cnt = await uploadBtns.count();
    console.error("[INFO] upload button candidates =", cnt);
    if (cnt === 0) return;

    // 첫 업로드 버튼 클릭
    const modal = page.locator('[data-testid="matchup-upload-modal"]');
    await uploadBtns.first().click();
    await waitForCondition(
      async () => (await modal.count()) > 0,
      { timeoutMs: 10_000, description: "matchup upload modal open" },
    ).catch(() => {});
    if (await modal.count() === 0) {
      console.error("[INFO] modal didn't open via first button");
      return;
    }

    await page.screenshot({ path: `${OUT}/03-upload-modal-empty.png`, fullPage: true });

    // source_type 라디오 영역만 - 사용자 선택 UI 검증
    const sourceTypeButtons = page.locator('button[data-source-type]');
    const stCount = await sourceTypeButtons.count();
    console.error("[INFO] source_type radio count =", stCount, "(expected: 7)");

    // 라디오 area screenshot
    if (stCount > 0) {
      const firstRadio = sourceTypeButtons.first();
      const grid = firstRadio.locator('xpath=ancestor::div[2]');
      if (await grid.count() > 0) {
        await grid.first().screenshot({ path: `${OUT}/03b-source-type-grid.png` }).catch(() => {});
      }
    }
  });

  test("04 - 작업박스 (worker job) 진행 표시", async ({ page }) => {
    page.on("pageerror", (e) => console.error("[PAGEERROR]", e.message));
    await openMatchup(page, 1200);

    // 작업박스 (대시보드 헤더 우측 또는 페이지 어딘가)
    const jobBox = page.locator('[data-testid="async-status-job"]').or(page.locator('[data-testid="async-job-list"]'));
    const jobCount = await jobBox.count();
    console.error("[INFO] job items visible =", jobCount);

    if (jobCount > 0) {
      const firstJob = jobBox.first();
      await firstJob.screenshot({ path: `${OUT}/04-job-card.png` }).catch(() => {});
    }

    // 헤더 진행 인디케이터
    const headerJob = page.locator('header [data-testid*="job"]').or(page.locator('header [class*="async"]'));
    if (await headerJob.count() > 0) {
      await headerJob.first().screenshot({ path: `${OUT}/04b-header-job.png` }).catch(() => {});
    }
  });

  test("05 - 모바일 viewport 1100x720", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 } });
    const page = await ctx.newPage();
    await openMatchup(page);
    await page.screenshot({ path: `${OUT}/05-mobile-1100-landing.png`, fullPage: true });

    const doneRow = page.locator('[data-testid="matchup-doc-row"][data-doc-status="done"]').first();
    if (await doneRow.count() > 0) {
      await doneRow.click();
      await waitForDoneDocSelection(page);
      await page.screenshot({ path: `${OUT}/05b-mobile-1100-doc-selected.png`, fullPage: true });
    }
    await ctx.close();
  });

  test("06 - 적중보고서 진입 + 편집기 시각", async ({ page }) => {
    page.on("pageerror", (e) => console.error("[PAGEERROR]", e.message));
    await openMatchup(page);

    // done doc 선택
    const doneRow = page.locator('[data-testid="matchup-doc-row"][data-doc-status="done"]').first();
    await doneRow.click();
    await waitForDoneDocSelection(page);

    // 적중보고서 버튼 — "보고서", "적중", "hit" 키워드 후보
    const reportBtns = page.locator('button:has-text("보고서"), button:has-text("적중"), [data-testid*="hit-report"]');
    const cnt = await reportBtns.count();
    console.error("[INFO] hit-report buttons =", cnt);
    if (cnt === 0) return;

    await reportBtns.first().click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await waitForCondition(
      async () =>
        (await page.locator('[data-testid="hit-report-editor"]').count()) > 0 ||
        (await page.locator('text=/보고서|적중/').count()) > 0,
      { timeoutMs: 15_000, description: "hit report view settled" },
    ).catch(() => {});
    await page.screenshot({ path: `${OUT}/06-hit-report-fullpage.png`, fullPage: true });

    // 편집기 영역
    const editor = page.locator('[data-testid="hit-report-editor"]');
    if (await editor.count() > 0) {
      await editor.first().screenshot({ path: `${OUT}/06b-editor.png` }).catch(() => {});
    }
  });
});
