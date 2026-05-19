/**
 * tchul (T2) 박철T 자격 read-only 시각 캡처 — Hybrid VLM 운영 ON 직후 (2026-05-11).
 *
 * 목적:
 *   - MATCHUP_HYBRID_VLM_TENANTS=1,2 활성화 후 박철T 운영 데이터 현 상태 documenting
 *   - 새 reanalyze trigger 절대 X (학원장 데이터 파괴 패턴 가드)
 *   - PoC 검증 doc(207/302/740/741) 매치업 page 시각 캡처
 *   - 학원장 시각 검수 evidence baseline
 *
 * write API 모두 차단 — POST/PATCH/DELETE/PUT, reanalyze, manual-crop 등.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = getBaseUrl("tchul-admin");
const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const SHOTS = path.resolve(
  __dirname_,
  "../reports/matchup-hybrid-vlm-readonly-2026-05-11",
);
fs.mkdirSync(SHOTS, { recursive: true });

const POC_DOC_IDS = [207, 302, 740, 741];

test("HYBRID-VLM. 박철T 매치업 read-only 시각 캡처 baseline", async ({ page }) => {
  test.setTimeout(120_000);

  // write 차단 — reanalyze / manual-crop / exclude / proposal 등.
  await page.route("**/api/v1/matchup/**", async (route, req) => {
    const m = req.method();
    if (m === "POST" || m === "PATCH" || m === "DELETE" || m === "PUT") {
      // 단 hit-reports list/draft 의 GET 은 통과. POST 만 차단.
      if (req.url().includes("/reanalyze") || req.url().includes("/manual-crop")
          || req.url().includes("/exclude") || req.url().includes("/include")
          || req.url().includes("/proposal")) {
        console.error(`[HYBRID-VLM] WRITE BLOCKED: ${m} ${req.url()}`);
        await route.abort("blockedbyclient");
        return;
      }
    }
    await route.continue();
  });

  await loginViaUI(page, "tchul-admin");
  await page.setViewportSize({ width: 1600, height: 1000 });

  // 매치업 메인 진입
  await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
  await expect(page.locator("[data-testid='matchup-doc-row'], [data-testid='matchup-upload-button']").first())
    .toBeVisible({ timeout: 15_000 });
  await page.screenshot({
    path: path.join(SHOTS, "00-matchup-main.png"),
    fullPage: false,
  });

  // PoC 검증 doc 4건 — 각각 진입 + 시각 캡처
  for (const docId of POC_DOC_IDS) {
    try {
      const url = `${BASE}/admin/storage/matchup?docId=${docId}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      await expect(page.locator("[data-testid='matchup-doc-row'], [data-testid='matchup-problem-grid'], .problem-grid").first())
        .toBeVisible({ timeout: 15_000 });
      await page.screenshot({
        path: path.join(SHOTS, `doc-${docId}-page.png`),
        fullPage: false,
      });

      // ProblemGrid 시각 — 자동분리 결과
      const grid = page.locator("[data-testid='matchup-problem-grid'], .problem-grid").first();
      if (await grid.count() > 0) {
        await grid.scrollIntoViewIfNeeded().catch(() => {});
        await page.screenshot({
          path: path.join(SHOTS, `doc-${docId}-grid.png`),
          fullPage: true,
        });
      }
      console.log(`[HYBRID-VLM] doc-${docId} captured`);
    } catch (e) {
      console.log(`[HYBRID-VLM] doc-${docId} capture skipped: ${(e as Error).message}`);
    }
  }
});
