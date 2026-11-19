import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import { build } from "vite";
import { chromium } from "@playwright/test";

test("Dawon detailed reports paginate every eligible exam and fit each A4 page", async () => {
  const bundle = await build({
    configFile: false, logLevel: "error", resolve: {alias: {"@": resolve("src")}},
    build: {write: false, minify: false, lib: {entry: "src/app_admin/domains/scores/utils/studentScoreReportGenerator.ts",
      name: "reports", formats: ["iife"]}, rollupOptions: {output: {inlineDynamicImports: true}}},
  });
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ content: (Array.isArray(bundle) ? bundle[0] : bundle).output.find(chunk => chunk.type === "chunk").code });
    for (const [tenantCode, mode, counts, expectedRows] of [
      ["dawon", "detailed", [0], []],
      ["dawon", "detailed", [16], [16]],
      ["dawon", "detailed", [17], [16, 1]],
      ["dawon", "detailed", [33, 18], [16, 16, 1, 16, 2]],
      ["dawon", "summary", [33, 18], []],
      ["other", "detailed", [33, 18], [16]],
    ]) {
      const result = await page.evaluate(({tenantCode, mode, counts}) => {
        const exams = counts.map((n, index) => ({
          exam_id: index + 1, title: "수학 " + (index + 1),
          block: { score: 80, max_score: 100 },
          items: Array.from({length: n}, (_, i) => ({
            question_id: n - i, question_number: n - i,
            question_kind: i % 2 ? "essay" : "choice", score: i % 2, max_score: 1,
          })),
        }));
        const params = { mode, tenantCode, tenantName: "검증", sessionTitle: "시험", lectureTitle: "수업",
          row: { student_name: "샘플", exams, homeworks: [] },
          meta: { lecture_id: 1, exams: exams.map(e => ({exam_id:e.exam_id, title:e.title, max_score:100})), homeworks: [] },
        };
        return {html: reports.buildStudentScoreReportHtml(params), count: reports.getStudentScoreReportPageCount(params)};
      }, {tenantCode, mode, counts});
      const preview = await browser.newPage({viewport:{width:1100, height:1200}});
      await preview.setContent(result.html);
      const sheets = preview.locator(".student-report-page");
      assert.equal(await sheets.count(), result.count);
      const rows = await preview.locator(".item-table").evaluateAll(tables => tables.map(table =>
        [...table.querySelectorAll("tbody tr")].map(row => Number.parseInt(row.cells[0].textContent))));
      assert.deepEqual(rows.map(group => group.length), expectedRows);
      const expected = mode === "summary" ? [] : (tenantCode === "dawon" ? counts : [Math.min(counts[0], 16)])
        .flatMap(n => Array.from({length:n}, (_, i) => i + 1));
      assert.deepEqual(rows.flat(), expected);
      for (let i = 0; i < result.count; i++) {
        const sheet = sheets.nth(i);
        assert.ok((await sheet.locator("footer").innerText()).includes(`${i+1} / ${result.count}`));
        assert.ok(await sheet.evaluate(el => {
          const footer = el.querySelector("footer");
          return el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1 &&
            [...el.children].filter(child => child !== footer).every(child => child.getBoundingClientRect().bottom <= footer.getBoundingClientRect().top + 1);
        }));
      }
      await preview.close();
    }
  } finally { await browser.close(); }
});
