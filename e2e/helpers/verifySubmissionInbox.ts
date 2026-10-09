import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { attachStrictBrowserGuards } from "./strictBrowser";
import { gotoAndSettle } from "./wait";
import { assertNoHorizontalOverflow, assertQaStudentParentRuntime, expectApi,
  installQaStudentParentBoundary, QA_BASE, seedBrowserAuth, type QaTokens } from "./qaStudentParentScenario";

/** Reuse the scenario's submitted/graded exam; its existing cleanup owns the row. */
export async function verifySubmissionInbox(parentPage: Page, request: APIRequestContext, admin: QaTokens, submissionId: number) {
  assertQaStudentParentRuntime();
  const data = await expectApi<{ results: Array<{ id: number }>; count: number; page: number }>(
    request, "GET", "/submissions/submissions/pending/?filter=done&page=1&page_size=50", admin.access,
  );
  expect(data.page).toBe(1);
  expect(data.count).toBeGreaterThan(0);
  expect(data.results.some((row) => row.id === submissionId)).toBe(true);
  const context = await parentPage.context().browser()!.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const boundary = await installQaStudentParentBoundary(page, request);
  const guards = attachStrictBrowserGuards(page);
  try {
    await seedBrowserAuth(page, admin);
    for (const path of ["/workspace/results/submissions", "/workspace/mobile/submissions"]) {
      for (const width of [390, 1366]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoAndSettle(page, `${QA_BASE}${path}?filter=done&page=1`);
        await expect(page.getByTestId(`submission-inbox-${submissionId}`)).toBeVisible();
        await expect(page.getByRole("navigation", { name: "제출 목록 페이지", exact: true })).toContainText(/전체 \d+건 · 1 \/ \d+ 페이지/);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByTestId(`submission-inbox-${submissionId}`)).toBeVisible();
        await assertNoHorizontalOverflow(page);
      }
    }
    boundary.assertClean();
    guards.assertZeroDefects();
  } finally {
    await context.close();
  }
}
