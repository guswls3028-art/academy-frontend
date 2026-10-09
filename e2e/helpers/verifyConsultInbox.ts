import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { attachStrictBrowserGuards } from "./strictBrowser";
import { gotoAndSettle } from "./wait";
import {
  assertNoHorizontalOverflow, assertQaStudentParentRuntime, expectApi,
  installQaStudentParentBoundary, QA_BASE, seedBrowserAuth, type QaTokens,
} from "./qaStudentParentScenario";

/** The official outer QA tenant teardown owns this synthetic public inquiry. */
export async function verifyConsultInbox(parentPage: Page, request: APIRequestContext, admin: QaTokens): Promise<void> {
  assertQaStudentParentRuntime();
  const name = `QA 상담 ${Date.now().toString(36)}`;
  const created = await expectApi<{ id: number }>(request, "POST", "/core/landing/consult/", admin.access, {
    name, phone: "01000000000", interest: "QA 수강 상담", message: "qa-* isolated inquiry", source: "qa-consult",
  }, [201]);
  const context = await parentPage.context().browser()!.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const boundary = await installQaStudentParentBoundary(page, request);
  const guards = attachStrictBrowserGuards(page);
  const endpoint = "/core/landing/admin/consult/";
  type Inbox = { items: Array<{ id: number; admin_memo: string; read_at: string | null }>; summary: { total: number; unread: number } };
  try {
    await seedBrowserAuth(page, admin);
    for (const width of [390, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, `${QA_BASE}/workspace/settings/consult`);
      const row = page.getByRole("article", { name: `상담 요청 ${name}`, exact: true });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: width === 390 ? "+ 메모 추가" : "수정", exact: true }).click();
      const memo = `QA 상담 메모 ${width}\n다음 연락 일정 보존`;
      await row.getByPlaceholder("처리 메모", { exact: true }).fill(memo);
      await row.getByRole("button", { name: "저장", exact: true }).click();
      await expect(row.getByText(memo, { exact: true })).toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(row.getByText(memo, { exact: true })).toBeVisible();
      const reloaded = await expectApi<Inbox>(request, "GET", `${endpoint}?page_size=50`, admin.access);
      expect(reloaded.items.find((item) => item.id === created.id)?.admin_memo).toBe(memo);
      await assertNoHorizontalOverflow(page);
    }
    const row = page.getByRole("article", { name: `상담 요청 ${name}`, exact: true });
    await row.getByRole("button", { name: "읽음으로 표시", exact: true }).click();
    await expect(row.getByRole("button", { name: "읽음으로 표시", exact: true })).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: "읽음으로 표시", exact: true })).toHaveCount(0);
    const all = await expectApi<Inbox>(request, "GET", endpoint, admin.access);
    expect(all.items.find((item) => item.id === created.id)?.read_at).toBeTruthy();
    const unread = await expectApi<Inbox>(request, "GET", `${endpoint}?filter=unread`, admin.access);
    expect(unread.items.some((item) => item.id === created.id)).toBe(false);
    await page.getByRole("button", { name: `미확인 ${all.summary.unread}`, exact: true }).click();
    await expect(row).toHaveCount(0);
    const summary = await expectApi<Inbox>(request, "GET", `${endpoint}?summary_only=true`, admin.access);
    expect(summary.items).toEqual([]);
    boundary.assertClean();
    guards.assertZeroDefects();
  } finally {
    await context.close();
  }
}
