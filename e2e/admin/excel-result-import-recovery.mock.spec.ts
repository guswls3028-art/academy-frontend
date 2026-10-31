import { expect, test } from "../fixtures/strictTest";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
async function installAuth(page: Parameters<typeof installLocalAuthApiStubs>[0]) {
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const jwt = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
  await page.addInitScript((token) => { localStorage.setItem("access", token); localStorage.setItem("refresh", `${token}-refresh`); }, jwt);
}

for (const width of [390, 1366]) {
  test(`시험 변경 뒤 늦은 미리보기를 버리고 새 시험 결과를 한 번만 반영한다 ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await installAuth(page);
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
    await testInfo.attach(`synthetic-exam-preview-${width}px`, {
      body: await page.screenshot({ path: testInfo.outputPath(`synthetic-exam-preview-${width}px.png`), fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
    await page.getByRole("button", { name: "1명 결과 반영" }).dblclick();
    await expect(page.getByText("채점 결과를 반영했습니다", { exact: true })).toBeVisible();
    expect(applies).toHaveLength(1);
    expect(applies[0]).toContain("/78/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await testInfo.attach(`synthetic-exam-applied-${width}px`, {
      body: await page.screenshot({ path: testInfo.outputPath(`synthetic-exam-applied-${width}px.png`), fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
  });

  test(`엑셀 반영 성공만 선택 강의·학생 상세·차시 결과를 새로 조회한다 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installAuth(page);
    let applied = false;
    let applyAttempts = 0;
    const reads = new Map<string, number>();
    const affected = ["all-results", "lecture-results", "all-stats", "lecture-stats", "student-detail", "manual-sheet", "session-scores"];
    await page.route("**/__excel-cache-probe/*", async route => {
      const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
      reads.set(name, (reads.get(name) ?? 0) + 1);
      await route.fulfill({ json: { score: name === "other-exam" ? 55 : applied ? 80 : 30 } });
    });
    await page.route("**/api/v1/results/admin/exams/77/result-import/", async route => {
      const apply = /name="apply"/.test(route.request().postData() ?? "");
      if (apply && ++applyAttempts === 1) {
        await route.fulfill({ status: 503, json: { detail: "합성 반영 일시 실패" } });
        return;
      }
      if (apply) applied = true;
      await route.fulfill({ json: {
        applied: apply, matched_count: 1, question_count: 5, not_submitted_count: 0, overwrite_count: 0,
        errors: [], rows: [], worksheet_names: ["명단"],
      } });
    });
    await page.goto(`${BASE}/e2e-excel-result-import-harness.html?cacheProbe=1`);
    const expectUnchanged = async () => {
      for (const name of affected) {
        await expect(page.getByTestId(name)).toHaveText("30");
        expect(reads.get(name)).toBe(1);
      }
      await expect(page.getByTestId("other-exam")).toHaveText("55");
    };
    await expectUnchanged();
    await page.locator('input[type="file"]').setInputFiles({
      name: "시험결과.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("synthetic backend-owned parsing fixture"),
    });
    const applyButton = page.getByRole("button", { name: "1명 결과 반영" });
    await expect(applyButton).toBeVisible();
    await expectUnchanged();
    await applyButton.click();
    await expect(page.getByText("합성 반영 일시 실패", { exact: true })).toBeVisible();
    await expect(applyButton).toBeEnabled();
    await expectUnchanged();
    await applyButton.click();
    await expect(page.getByText("채점 결과를 반영했습니다", { exact: true })).toBeVisible();
    for (const name of affected) {
      await expect(page.getByTestId(name)).toHaveText("80");
      expect(reads.get(name)).toBe(2);
    }
    await expect(page.getByTestId("other-exam")).toHaveText("55");
    expect(reads.get("other-exam")).toBe(1);
    expect(applyAttempts).toBe(2);
  });
}
