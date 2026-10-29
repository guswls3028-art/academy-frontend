import { expect, test } from "../fixtures/strictTest";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
for (const width of [390, 1366]) {
  test(`시험 변경 뒤 늦은 미리보기를 버리고 새 시험 결과를 한 번만 반영한다 ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await installLocalAuthApiStubs(page);
    await installTenantOneInitScript(page);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const jwt = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
    await page.addInitScript((token) => { localStorage.setItem("access", token); localStorage.setItem("refresh", `${token}-refresh`); }, jwt);
    let releaseFirst: () => void = () => {};
    const firstResponse = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const applies: string[] = [];
    await page.route("**/api/v1/results/admin/exams/*/result-import/", async (route) => {
      const applied = /name="apply"/.test(route.request().postData() ?? "");
      if (applied) applies.push(route.request().url());
      if (route.request().url().includes("/77/")) await firstResponse;
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({
        applied, matched_count: 1, question_count: 5, not_submitted_count: 0, overwrite_count: 0,
        errors: [], rows: [], worksheet_names: ["명단"],
      }) });
    });
    await page.goto(`${BASE}/e2e-excel-result-import-harness.html`);
    const file = { name: "시험결과.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("synthetic backend-owned parsing fixture") };
    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByText("학생과 문항을 맞춰보는 중…", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "다음 시험" }).click();
    releaseFirst();
    await expect(page.getByText("현재 시험 78", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "1명 결과 반영" })).toHaveCount(0);
    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByRole("button", { name: "1명 결과 반영" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`synthetic-exam-preview-${width}px.png`), fullPage: true });
    await page.getByRole("button", { name: "1명 결과 반영" }).dblclick();
    await expect(page.getByText("채점 결과를 반영했습니다", { exact: true })).toBeVisible();
    expect(applies).toHaveLength(1);
    expect(applies[0]).toContain("/78/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`synthetic-exam-applied-${width}px.png`), fullPage: true });
  });
}
