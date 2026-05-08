// 매치업 적중보고서 복구 시각 검증 — 학원장(tchul) 화면 vs DB 비교
// 목적: DB는 복구됐으나 학원장이 "복구 안 됐다" 보고. 화면 표시 결함 진단.
// read-only spec — DB mutation 없음.
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const TCHUL_BASE = process.env.TCHUL_BASE_URL || "https://tchul.com";

const REPORTS_TO_VERIFY = [
  { id: 13, doc: 292, title: "개포고", expectedFilled: 23 },
  { id: 14, doc: 148, title: "중대부고", expectedFilled: 35 },
  { id: 25, doc: 177, title: "숙명여고", expectedFilled: 27 },
  { id: 27, doc: 272, title: "단대부고", expectedFilled: 19 },
  { id: 28, doc: 294, title: "은광여고", expectedFilled: 20 },
];

test.describe.serial("매치업 적중보고서 복구 검증 — tchul 학원장", () => {
  test("로그인 + 적중 보고서 리스트 도달", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await page.goto(`${TCHUL_BASE}/admin/hit-reports`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "e2e/_artifacts/recovery-verify/01-list.png", fullPage: true });

    const visible = await page.locator("body").innerText();
    console.log("[hit-reports list] body length =", visible.length);
  });

  for (const r of REPORTS_TO_VERIFY) {
    test(`보고서 ${r.title} (id=${r.id} doc=${r.doc}) — entries 노출 검증`, async ({ page }) => {
      await loginViaUI(page, "tchul-admin");

      // hit-report-draft API 직접 호출 → API 응답 selected_problem_ids 카운트
      const apiResp = await page.request.get(
        `${TCHUL_BASE.replace(/^https:\/\/[^/]+/, "https://api.hakwonplus.com")}/api/v1/matchup/documents/${r.doc}/hit-report-draft/`,
        {
          headers: {
            Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("access_token"))}`,
            "X-Tenant-Code": "tchul",
          },
          timeout: 60_000,
        },
      );

      console.log(`[doc=${r.doc}] API status = ${apiResp.status()}`);
      if (apiResp.status() === 200) {
        const data = await apiResp.json();
        const problemList = data.problems || [];
        let filledEntries = 0;
        let emptyEntries = 0;
        let candidatesFound = 0;
        for (const p of problemList) {
          const entry = p.entry;
          if (!entry) continue;
          const sel = entry.selected_problem_ids || [];
          if (sel.length > 0) filledEntries++;
          else emptyEntries++;
          if ((p.candidates || []).length > 0) candidatesFound++;
        }
        console.log(
          `[doc=${r.doc}] API entries: ${problemList.length} problems, ` +
          `filled=${filledEntries}, empty=${emptyEntries}, candidates=${candidatesFound}`,
        );
      }

      // 매치업 페이지 → 보고서 자동 오픈
      await page.goto(`${TCHUL_BASE}/admin/matchup`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `e2e/_artifacts/recovery-verify/02-matchup-${r.doc}.png`, fullPage: true });
    });
  }
});
