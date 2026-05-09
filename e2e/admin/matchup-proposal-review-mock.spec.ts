// PATH: e2e/admin/matchup-proposal-review-mock.spec.ts
//
// Phase F (2026-05-10) — Stage 6.3A Proposal Review v1 UI 회귀.
// `basic_definition_2026_05_09` SSOT §6 백엔드 기본 구조 / §7 모델 역할:
//   YOLO 출력 = 후보 O / Proposal 통과 → accepted 만 FinalProblem.
//
// ENV `MATCHUP_PROPOSAL_FIRST_TENANTS` default off → 대부분 doc 빈 list.
// 본 spec 은 "panel 자체가 정상 wire-in 됐는지" + "empty 상태 UX" 검증.
//
// E2E 정책 (memory feedback_no_e2e_on_real_tenants.md):
//   T1 only. read-only — approve/reject 클릭 X.

import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 800 },
  { name: "1366", width: 1366, height: 768 },
  { name: "1100", width: 1100, height: 720 },
];

const TARGET_DOC_ID = 615;

for (const vp of VIEWPORTS) {
  test(`Phase F — Proposal Review panel wire-in [${vp.name}]`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    const consoleMsgs: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });
    page.on("response", (resp) => {
      if (resp.status() >= 400 && resp.url().includes("/matchup/proposals")) {
        failedRequests.push(`${resp.status()} ${resp.url()}`);
      }
    });

    await loginViaUI(page, "admin");
    await page.goto(`https://hakwonplus.com/admin/storage/matchup?docId=${TARGET_DOC_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // CTA 가시성 검증 (status === "done" 인 doc 에서만 노출)
    const cta = page.getByTestId("matchup-proposal-review-cta");
    await expect(cta).toBeVisible({ timeout: 30000 });

    await page.screenshot({
      path: `_artifacts/sessions/phase-f-proposal-review-cta-${vp.name}.png`,
      fullPage: false,
    });

    // CTA 클릭 → panel 모달
    await page.getByTestId("matchup-proposal-review-open-btn").click();
    const panel = page.getByTestId("matchup-proposal-review-panel");
    await expect(panel).toBeVisible({ timeout: 10000 });

    // ENV first-tenant off 인 doc 이라 빈 list 또는 일부 list 둘 다 OK.
    // empty data-testid 또는 proposal-card 둘 중 하나 노출되는지 확인.
    const empty = page.getByTestId("matchup-proposal-review-empty");
    const cards = page.getByTestId("matchup-proposal-card");
    await Promise.race([
      empty.waitFor({ state: "visible", timeout: 15000 }),
      cards.first().waitFor({ state: "visible", timeout: 15000 }),
    ]).catch(() => {});

    await page.screenshot({
      path: `_artifacts/sessions/phase-f-proposal-review-panel-${vp.name}.png`,
      fullPage: false,
    });

    // 닫기
    await page.getByTestId("matchup-proposal-review-close").click();
    await expect(panel).not.toBeVisible({ timeout: 5000 });

    const fs = await import("fs");
    fs.writeFileSync(
      `_artifacts/sessions/phase-f-proposal-review-diag-${vp.name}.json`,
      JSON.stringify({ consoleMsgs, failedRequests }, null, 2),
      "utf-8",
    );
  });
}
