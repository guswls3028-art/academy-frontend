/**
 * 박철T 학원장 자격으로 보고서 13(개포고)/27(단대부고) 화면을 직접 떠서
 * dangling 미리보기 상태를 캡처. read-only 진단 — 데이터 mutate 없음.
 */
import { test } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("tchul-admin");

const REPORTS = [
  { reportId: 13, docId: 292, title: "2026 개포고 1학기 중간고사 통합과학" },
  { reportId: 27, docId: 272, title: "2026 단대부고 1학기 중간고사 통합과학" },
];

test.describe.configure({ mode: "serial" });

for (const r of REPORTS) {
  test(`hit-report-${r.reportId} editor capture`, async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await page.goto(`${BASE}/admin/storage/hit-reports`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // fetchHitReportDraft 응답을 명시적으로 기다림 — 30 query 병렬 후 응답.
    const draftPromise = page.waitForResponse(
      (resp) => resp.url().includes(`/matchup/documents/${r.docId}/hit-report-draft/`),
      { timeout: 120_000 },
    );
    const row = page.getByRole("button").filter({ hasText: r.title }).first();
    await row.click();
    await draftPromise.catch(() => {});
    // 응답 후 React state 반영 + image presigned URL 로드 대기.
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: `test-results/tchul-report-${r.reportId}-overview.png`,
      fullPage: false,
    });

    // 좌측 Q 리스트 첫 5개 차례 클릭 + 캡쳐 — 각 문항의 미리보기 상태 확인
    // ProblemGrid/HitReportEditor 좌측 패널에서 "n번 ·" 같은 패턴의 row 등장.
    const qRows = page.locator('[role="button"]').filter({ hasText: /번\s*[·•]|^\d+\s*번/ });
    const total = await qRows.count();
    for (let i = 0; i < Math.min(3, total); i++) {
      await qRows.nth(i).click().catch(() => {});
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: `test-results/tchul-report-${r.reportId}-q${i + 1}.png`,
        fullPage: false,
      });
    }
  });
}
