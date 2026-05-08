/* eslint-disable no-restricted-syntax */
// audit script 는 운영 환경에 대한 read-only walkthrough 이며 React/Vite 앱이
// 아니라 Playwright spec 이다. 모달 transition / 폴링 정착 / animation 종료를
// 기다리려면 page.waitForTimeout 같은 idle wait 가 의도된 도구. helpers/wait.ts
// 의 gotoAndSettle 은 navigate 시점 만 cover 하므로 audit 의 캡처 안정 wait 와는
// 책임이 다름. 파일 단위 lint 예외.
/**
 * 매치업 UI/UX audit — read-only walkthrough.
 *
 * 운영 환경(hakwonplus.com) Tenant 1 학원장 시점에서 매치업 페이지의 모든
 * 주요 화면을 한 번씩 거치면서 캡처/콘솔 에러/네트워크 실패를 수집한다.
 *
 * 데이터를 만들지도 지우지도 않는다 (destructive 금지). 새 doc 업로드 안 함.
 *
 * 실행:
 *   cd frontend
 *   AUDIT_DIR=<absolute path>  pnpm exec playwright test \
 *     e2e/_audit/audit-matchup-uiux.spec.ts --project=chromium --reporter=list
 *
 * 산출:
 *   <AUDIT_DIR>/
 *     ├── 01-..NN-*.png   각 단계 캡처
 *     ├── console.json    page console / pageerror / requestfailed
 *     └── timing.json     각 단계 ms
 *
 * D-5 (2026-05-08): 셀렉터를 실제 컴포넌트 data-testid 에 정확히 맞춰 안정화.
 *   doc row    → [data-testid="matchup-doc-row"] (DocumentList.tsx:317)
 *   problem    → [data-testid="matchup-problem-card"] (ProblemCard.tsx:64)
 *   similar    → [data-testid="matchup-similar-row"] (SimilarResults.tsx:431)
 *   detail mod → [data-testid="matchup-detail-modal"] (ProblemDetailModal.tsx:121)
 *   crop btn   → [data-testid="matchup-doc-manual-crop-btn"] (MatchupPage.tsx:1043)
 *   crop mod   → [data-testid="matchup-manual-crop-modal"] (ManualCropModal.tsx:560)
 *   report btn → [data-testid="matchup-doc-hit-report-curate-btn"] (MatchupPage.tsx:1019)
 *   report ql  → [data-testid="matchup-hit-report-quick-link"] (D-1+D-3 격하 후)
 */
import { test, expect, type ConsoleMessage } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as fs from "node:fs";
import * as path from "node:path";

const ART_ROOT = process.env.AUDIT_DIR
  || path.join(process.cwd(), "..", "_artifacts", "audit", `matchup-uiux-adhoc`);

type Stage =
  | "01-login"
  | "02-navigate-matchup"
  | "03-pick-doc"
  | "04-pick-problem"
  | "05-similar-detail"
  | "06-crop-modal"
  | "07-hit-report-quick-link"
  | "08-hit-report-editor";

test.describe("매치업 UI/UX audit (read-only)", () => {
  test.setTimeout(600_000);
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("학원장 골든패스 walkthrough", async ({ page }) => {
    fs.mkdirSync(ART_ROOT, { recursive: true });
    const consoleLog: Array<{ type: string; text: string; url: string }> = [];
    const failures: Array<{ url: string; failure: string | null }> = [];
    const timings: Partial<Record<Stage, number>> = {};

    page.on("console", (msg: ConsoleMessage) => {
      const type = msg.type();
      if (type === "error" || type === "warning") {
        consoleLog.push({ type, text: msg.text(), url: page.url() });
      }
    });
    page.on("pageerror", (err) => {
      consoleLog.push({ type: "pageerror", text: String(err), url: page.url() });
    });
    page.on("requestfailed", (req) => {
      const u = req.url();
      if (u.includes("hakwonplus.com")) {
        failures.push({ url: u, failure: req.failure()?.errorText ?? null });
      }
    });

    const base = getBaseUrl("admin");
    const cap = async (name: string) => {
      await page.screenshot({
        path: path.join(ART_ROOT, `${name}.png`),
        fullPage: false,
      });
    };
    const stage = async (label: Stage, fn: () => Promise<void>) => {
      const t0 = Date.now();
      await fn();
      timings[label] = Date.now() - t0;
    };
    const tryClick = async (selector: string, opts?: { timeout?: number }) => {
      const loc = page.locator(selector).first();
      try {
        await loc.waitFor({ state: "visible", timeout: opts?.timeout ?? 5000 });
        await loc.click();
        return true;
      } catch {
        return false;
      }
    };

    // 1) 로그인
    await stage("01-login", async () => {
      await loginViaUI(page, "admin");
    });

    // 2) 매치업 페이지 진입
    await stage("02-navigate-matchup", async () => {
      const sidebarLink = page.getByRole("link", { name: /자료\s*저장소|매치업/ }).first();
      if (await sidebarLink.isVisible().catch(() => false)) {
        await sidebarLink.click();
      } else {
        await page.goto(`${base}/admin/storage/matchup`, { waitUntil: "networkidle", timeout: 20000 });
      }
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    });
    await cap("01-matchup-landing-1920");

    // 3) doc row 선택 — 정확한 셀렉터
    await stage("03-pick-doc", async () => {
      await tryClick('[data-testid="matchup-doc-row"]', { timeout: 8000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    });
    await cap("02-doc-selected-1920");

    // 4) problem card 선택 → 추천 패널 fetch
    await stage("04-pick-problem", async () => {
      await tryClick('[data-testid="matchup-problem-card"]', { timeout: 8000 });
      await page.locator('[data-testid="matchup-similar-row"], [data-testid="matchup-similar-section-empty"]')
        .first()
        .waitFor({ state: "visible", timeout: 12000 })
        .catch(() => {});
    });
    await cap("03-problem-similar-1920");

    // 5) similar row → ProblemDetailModal
    await stage("05-similar-detail", async () => {
      const opened = await tryClick('[data-testid="matchup-similar-row"]', { timeout: 4000 });
      if (opened) {
        await page.locator('[data-testid="matchup-detail-modal"]')
          .waitFor({ state: "visible", timeout: 6000 })
          .catch(() => {});
      }
    });
    await cap("04-detail-modal-1920");
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);

    // 6) 다양한 viewport
    for (const w of [1366, 1100, 768]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(400);
      await cap(`05-viewport-${w}`);
    }
    await page.setViewportSize({ width: 1920, height: 1080 });

    // 7) ManualCropModal — 직접 자르기
    await stage("06-crop-modal", async () => {
      const opened = await tryClick('[data-testid="matchup-doc-manual-crop-btn"]', { timeout: 5000 });
      if (opened) {
        await page.locator('[data-testid="matchup-manual-crop-modal"]')
          .waitFor({ state: "visible", timeout: 8000 })
          .catch(() => {});
      }
    });
    await cap("06-crop-modal-1920");
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);

    // 8) 적중 보고서 — quick link (D-1+D-3 격하 검증)
    await stage("07-hit-report-quick-link", async () => {
      const opened = await tryClick('[data-testid="matchup-hit-report-quick-link"]', { timeout: 5000 });
      if (opened) {
        await page.waitForTimeout(600);
      }
    });
    await cap("07-hit-report-list-modal-1920");
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);

    // 9) 적중 보고서 작성 (시험지 doc 선택된 상태에서만 활성)
    await stage("08-hit-report-editor", async () => {
      const reportBtn = page.locator('[data-testid="matchup-doc-hit-report-curate-btn"]').first();
      if (await reportBtn.isVisible().catch(() => false)) {
        const disabled = await reportBtn.isDisabled().catch(() => true);
        if (!disabled) {
          await reportBtn.click().catch(() => {});
          await page.waitForTimeout(800);
        }
      }
    });
    await cap("08-hit-report-editor-1920");
    await page.keyboard.press("Escape").catch(() => {});

    await page.waitForTimeout(500);

    fs.writeFileSync(
      path.join(ART_ROOT, "console.json"),
      JSON.stringify({ console: consoleLog, requestFailed: failures }, null, 2),
    );
    fs.writeFileSync(
      path.join(ART_ROOT, "timing.json"),
      JSON.stringify(timings, null, 2),
    );

    expect(page.url()).toMatch(/matchup|hit-reports/);
  });
});
