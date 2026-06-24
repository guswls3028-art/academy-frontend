import type { Page } from "@playwright/test";

import { test, expect } from "../fixtures/strictTest";
import { apiCall } from "../helpers/api";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { FIXTURES_ALT } from "../helpers/test-fixtures";

const BASE = getBaseUrl("admin");
const LECTURE_ID = FIXTURES_ALT.lectureId;
const SESSION_ID = FIXTURES_ALT.sessionId;

type ExamRow = {
  id?: number;
  exam_id?: number;
};

type AnswerKeyRow = {
  id: number;
  exam: number;
  answers: Record<string, string | string[] | Record<string, number>>;
};

type ListEnvelope<T> = T[] | { results?: T[]; items?: T[] };

function rows<T>(value: ListEnvelope<T> | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function numericId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function createExam(page: Page, title: string): Promise<number> {
  const created = await apiCall<ExamRow>(page, "POST", "/exams/", {
    title,
    description: "answer key large-count regression",
    exam_type: "regular",
    session_id: SESSION_ID,
    max_score: 100,
    pass_score: 60,
    answer_visibility: "hidden",
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const examId = numericId(created.body.id ?? created.body.exam_id);
  expect(examId).not.toBeNull();
  return examId!;
}

test.describe("운영 회귀: 답안등록 대문항 안정성", () => {
  test("500문항 초과는 API/UI에서 막고, 61문항 답안등록/OMR 제한 안내는 pageerror 없이 동작한다", async ({ page }) => {
    test.setTimeout(180_000);

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await loginViaUI(page, "admin");

    const stamp = Date.now();
    const examTitle = `[E2E-${stamp}] 답안등록 61문항`;
    let examId: number | null = null;

    try {
      examId = await createExam(page, examTitle);

      const blockedApi = await apiCall<unknown>(page, "POST", `/exams/${examId}/questions/init/`, {
        choice_count: 500,
        essay_count: 1,
      });
      expect(blockedApi.status, JSON.stringify(blockedApi.body)).toBe(400);
      expect(JSON.stringify(blockedApi.body)).toContain("최대 500문항");

      await page.goto(
        `${BASE}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams?examId=${examId}`,
        { waitUntil: "load", timeout: 20_000 },
      );
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

      await expect(page.getByText(examTitle).first()).toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: "답안등록하기" }).click();

      const modal = page.locator(".admin-modal__inner").filter({ hasText: "답안 등록" }).last();
      await expect(modal).toBeVisible({ timeout: 10_000 });

      const choicePanel = modal.locator(".answer-key-panel--choice");
      const essayPanel = modal.locator(".answer-key-panel--essay");
      const choiceCountInput = choicePanel.locator("input.answer-key-input--count");
      const essayCountInput = essayPanel.locator("input.answer-key-input--count");

      await choiceCountInput.fill("500");
      await essayCountInput.fill("1");
      await choicePanel.getByRole("button", { name: "적용" }).click();
      await expect(page.getByText("객관식+주관식 문항 수 합은 최대 500문항입니다.")).toBeVisible({ timeout: 5_000 });

      await choiceCountInput.fill("61");
      await essayCountInput.fill("0");
      const initResponse = page.waitForResponse((resp) =>
        resp.request().method() === "POST" &&
        resp.url().includes(`/api/v1/exams/${examId}/questions/init/`) &&
        resp.status() === 200,
      );
      await choicePanel.getByRole("button", { name: "적용" }).click();
      await initResponse;

      await expect(choicePanel.locator(".answer-key-row--choice")).toHaveCount(61, { timeout: 15_000 });

      await choicePanel.locator(".answer-key-row--choice").first().locator(".answer-key-omr-label").first().click();
      const saveResponse = page.waitForResponse((resp) =>
        resp.request().method() === "POST" &&
        resp.url().includes("/api/v1/exams/answer-keys/") &&
        resp.status() >= 200 &&
        resp.status() < 300,
      );
      await modal.getByRole("button", { name: /저장/ }).click();
      await saveResponse;

      const answerKeys = await apiCall<ListEnvelope<AnswerKeyRow>>(page, "GET", `/exams/answer-keys/?exam=${examId}`);
      expect(answerKeys.status, JSON.stringify(answerKeys.body)).toBe(200);
      const saved = rows(answerKeys.body)[0];
      expect(saved).toBeTruthy();
      expect(Object.keys(saved.answers).length).toBeGreaterThanOrEqual(1);

      await modal.getByText("OMR 답안지").click();
      await expect(modal.getByText("객관식 60문항, 서술형 10문항까지 지원합니다.")).toBeVisible({ timeout: 10_000 });
      await expect(modal.getByText("현재 시험은 객관식 61문항, 서술형 0문항")).toBeVisible();
      expect(pageErrors).toEqual([]);
    } finally {
      if (examId) {
        await apiCall(page, "DELETE", `/exams/${examId}/?session_id=${SESSION_ID}`).catch(() => undefined);
        await apiCall(page, "DELETE", `/exams/${examId}/`).catch(() => undefined);
      }
    }
  });
});
