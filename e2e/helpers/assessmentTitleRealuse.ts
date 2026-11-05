import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { attachStrictBrowserGuards } from "./strictBrowser";
import { gotoAndSettle } from "./wait";
import { acknowledgeInitialAccountPromptsIfVisible } from "./firstLoginGuide";
import { withOwnedScoreLeaseCleanup } from "./scoreLeaseCleanup";
import {
  assertNoHorizontalOverflow, assertQaStudentParentRuntime, expectApi,
  installQaStudentParentBoundary, QA_BASE, seedBrowserAuth, type QaTokens,
} from "./qaStudentParentScenario";

/** Uses only the caller's disposable assessment; the owning scenario cleans it up. */
export async function verifyAssessmentTitle(
  parentPage: Page, request: APIRequestContext, admin: QaTokens,
  target: { kind: "exam" | "homework"; id: number; title: string; lectureId: number; sessionId: number },
): Promise<void> {
  assertQaStudentParentRuntime();
  const context = await parentPage.context().browser()!.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const boundary = await installQaStudentParentBoundary(page, request);
  const guards = attachStrictBrowserGuards(page);
  const endpoint = `/${target.kind === "exam" ? "exams" : "homeworks"}/${target.id}/`;
  const label = target.kind === "exam" ? "시험" : "과제";
  const policyKeys = ["max_score", "pass_score", "grading_mode", "manual_grading_method", "cutline_mode", "cutline_value", "round_unit_percent", "meta", "template_exam_id", "template_homework_id"];
  await withOwnedScoreLeaseCleanup(context, request, { sessionId: target.sessionId, actorAccess: admin.access }, async () => {
    const original = await expectApi<Record<string, unknown>>(request, "GET", endpoint, admin.access);
    await seedBrowserAuth(page, admin);
    let previous = target.title;
    for (const [width, tab, next] of [
      [1366, target.kind === "exam" ? "exams" : "assignments", `${target.title} 제목 정정`],
      [390, "scores", target.title],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, `${QA_BASE}/workspace/lectures/${target.lectureId}/sessions/${target.sessionId}/${tab}?assessment=${target.kind}%3A${target.id}`);
      if (width === 1366) await acknowledgeInitialAccountPromptsIfVisible(page);
      if (tab === "scores") {
        await page.getByRole("button", { name: `${previous} 작업 선택`, exact: true }).click();
        await page.getByRole("menu", { name: `${previous} 작업 선택`, exact: true }).getByRole("menuitem", { name: target.kind === "exam" ? /^시험 설정/ : /^과제 수정/ }).click();
      } else {
        await page.getByRole("button", { name: `${previous} 제목 수정`, exact: true }).click();
      }
      const dialog = page.getByRole("dialog", { name: tab === "scores" ? target.kind === "exam" ? "시험 설정" : "과제 수정" : `${label} 제목 수정`, exact: true });
      const input = dialog.getByRole("textbox", { name: tab === "scores" ? `${label}명` : `${label} 제목`, exact: true });
      await expect(input).toBeEnabled();
      await input.fill(next);
      const saved = page.waitForResponse(response => response.request().method() === "PATCH"
        && new URL(response.url()).pathname === `/api/v1${endpoint}`);
      await dialog.getByRole("button", { name: tab === "scores" && target.kind === "homework" ? "운영 설정 저장" : "저장", exact: true }).click();
      const response = await saved;
      expect(response.status()).toBe(200);
      expect(response.request().postDataJSON()).toEqual({ title: next });
      expect(response.request().headers()["x-expected-updated-at"]).toBeTruthy();
      await expect(dialog).not.toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: `${next} ${tab === "scores" ? "작업 선택" : "제목 수정"}`, exact: true })).toBeVisible();
      const persisted = await expectApi<Record<string, unknown>>(request, "GET", endpoint, admin.access);
      expect(persisted.title).toBe(next);
      for (const key of policyKeys) expect(persisted[key], `title edit preserves ${key}`).toEqual(original[key]);
      await assertNoHorizontalOverflow(page);
      previous = next;
    }
    // Exercise a non-title setting through the same modal, then restore the
    // disposable scenario's policy before its student/parent readback continues.
    const originalMeta = (original.meta ?? {}) as Record<string, unknown>;
    const originalValue = target.kind === "exam" ? String(original.pass_score) : String(originalMeta.due_date ?? "");
    const nextValue = target.kind === "exam"
      ? String(Number(original.pass_score) > 0 ? Number(original.pass_score) - 1 : Math.min(1, Number(original.max_score)))
      : originalValue === "2030-01-01" ? "2030-01-02" : "2030-01-01";
    for (const value of [nextValue, originalValue]) {
      await page.getByRole("button", { name: `${target.title} 작업 선택`, exact: true }).click();
      await page.getByRole("menu", { name: `${target.title} 작업 선택`, exact: true }).getByRole("menuitem", { name: target.kind === "exam" ? /^시험 설정/ : /^과제 수정/ }).click();
      const dialog = page.getByRole("dialog", { name: target.kind === "exam" ? "시험 설정" : "과제 수정", exact: true });
      const field = target.kind === "exam" ? dialog.getByRole("spinbutton", { name: /^합격 기준/ }) : dialog.locator('input[type="date"]');
      await expect(field).toBeEnabled();
      await field.fill(value);
      const saved = page.waitForResponse(response => response.request().method() === "PATCH"
        && new URL(response.url()).pathname === `/api/v1${endpoint}`);
      await dialog.getByRole("button", { name: target.kind === "exam" ? "저장" : "운영 설정 저장", exact: true }).click();
      const response = await saved;
      expect(response.status()).toBe(200);
      expect(response.request().headers()["x-expected-updated-at"]).toBeTruthy();
      await expect(dialog).not.toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: `${target.title} 작업 선택`, exact: true })).toBeVisible();
      const persisted = await expectApi<Record<string, unknown>>(request, "GET", endpoint, admin.access);
      if (target.kind === "exam") expect(persisted.pass_score).toBe(Number(value));
      else expect((persisted.meta as Record<string, unknown>)?.due_date ?? "").toBe(value);
      expect(persisted.title).toBe(target.title);
      for (const key of policyKeys.filter(key => key !== (target.kind === "exam" ? "pass_score" : "meta"))) {
        expect(persisted[key], `policy edit preserves ${key}`).toEqual(original[key]);
      }
      await assertNoHorizontalOverflow(page);
    }
    boundary.assertClean();
    guards.assertZeroDefects();
  });
}
