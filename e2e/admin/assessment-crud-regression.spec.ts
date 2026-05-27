import type { Page } from "@playwright/test";

import { test, expect } from "../fixtures/strictTest";
import { apiCall } from "../helpers/api";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { FIXTURES_ALT } from "../helpers/test-fixtures";

const BASE = getBaseUrl("admin");
const LECTURE_ID = FIXTURES_ALT.lectureId;
const SESSION_ID = FIXTURES_ALT.sessionId;

type ListEnvelope<T> = T[] | { results?: T[]; items?: T[] };

type ExamRow = {
  id?: number;
  exam_id?: number;
  title?: string;
};

type SessionExamRow = {
  exam_id?: number;
  title?: string;
};

type SessionExamsSummary = {
  exams?: Array<{ exam_id?: number; title?: string }>;
};

type SessionScoresResponse = {
  meta?: {
    exams?: Array<{ exam_id?: number; title?: string }>;
  };
  rows?: Array<{
    exams?: Array<{ exam_id?: number; title?: string }>;
  }>;
};

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

async function assertExamLinkedToSession(page: Page, examId: number, title: string) {
  const examsBySession = await apiCall<ListEnvelope<ExamRow>>(
    page,
    "GET",
    `/exams/?session_id=${SESSION_ID}`,
  );
  expect(examsBySession.status, "regular exam list by session").toBe(200);
  expect(rows(examsBySession.body).some((exam) => numericId(exam.id ?? exam.exam_id) === examId)).toBe(true);

  const sessionExams = await apiCall<ListEnvelope<SessionExamRow>>(
    page,
    "GET",
    `/results/admin/sessions/${SESSION_ID}/exams/`,
  );
  expect(sessionExams.status, "session exam sidebar list").toBe(200);
  expect(rows(sessionExams.body).some((exam) => numericId(exam.exam_id) === examId)).toBe(true);

  const summary = await apiCall<SessionExamsSummary>(
    page,
    "GET",
    `/results/admin/sessions/${SESSION_ID}/exams/summary/`,
  );
  expect(summary.status, "session exam summary").toBe(200);
  expect(summary.body.exams?.some((exam) => numericId(exam.exam_id) === examId)).toBe(true);

  const scores = await apiCall<SessionScoresResponse>(
    page,
    "GET",
    `/results/admin/sessions/${SESSION_ID}/scores/`,
  );
  expect(scores.status, "session scores metadata").toBe(200);
  expect(scores.body.meta?.exams?.some((exam) => numericId(exam.exam_id) === examId && exam.title === title)).toBe(true);
}

async function assertExamRemovedFromSession(page: Page, examId: number) {
  const examsBySession = await apiCall<ListEnvelope<ExamRow>>(
    page,
    "GET",
    `/exams/?session_id=${SESSION_ID}`,
  );
  expect(examsBySession.status, "regular exam list by session after UI delete").toBe(200);
  expect(rows(examsBySession.body).some((exam) => numericId(exam.id ?? exam.exam_id) === examId)).toBe(false);

  const sessionExams = await apiCall<ListEnvelope<SessionExamRow>>(
    page,
    "GET",
    `/results/admin/sessions/${SESSION_ID}/exams/`,
  );
  expect(sessionExams.status, "session exam sidebar list after UI delete").toBe(200);
  expect(rows(sessionExams.body).some((exam) => numericId(exam.exam_id) === examId)).toBe(false);

  const summary = await apiCall<SessionExamsSummary>(
    page,
    "GET",
    `/results/admin/sessions/${SESSION_ID}/exams/summary/`,
  );
  expect(summary.status, "session exam summary after UI delete").toBe(200);
  expect(summary.body.exams?.some((exam) => numericId(exam.exam_id) === examId)).toBe(false);

  const scores = await apiCall<SessionScoresResponse>(
    page,
    "GET",
    `/results/admin/sessions/${SESSION_ID}/scores/`,
  );
  expect(scores.status, "session scores metadata after UI delete").toBe(200);
  expect(scores.body.meta?.exams?.some((exam) => numericId(exam.exam_id) === examId)).toBe(false);
  expect(scores.body.rows?.some((row) => row.exams?.some((exam) => numericId(exam.exam_id) === examId))).toBe(false);
}

test.describe("운영 회귀: 차시 시험 삭제", () => {
  test("경고 확인 후 시험이 해당 차시의 목록·요약·성적·응시 흐름에서 제거된다", async ({ page }) => {
    test.setTimeout(120_000);

    await loginViaUI(page, "admin");

    const stamp = Date.now();
    const examTitle = `[E2E-${stamp}] 차시삭제 실사용`;
    let examId: number | null = null;

    try {
      const created = await apiCall<ExamRow>(page, "POST", "/exams/", {
        title: examTitle,
        description: "UI delete regression",
        exam_type: "regular",
        session_id: SESSION_ID,
        max_score: 100,
        pass_score: 60,
        answer_visibility: "hidden",
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      examId = numericId(created.body.id ?? created.body.exam_id);
      expect(examId).not.toBeNull();

      await assertExamLinkedToSession(page, examId!, examTitle);

      await page.goto(
        `${BASE}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams?examId=${examId}`,
        { waitUntil: "load", timeout: 20_000 },
      );
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

      await expect(page.getByText(examTitle).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "시험 삭제하기" })).toBeVisible();

      await page.getByRole("button", { name: "시험 삭제하기" }).click();
      const dialog = page.getByRole("dialog", { name: "삭제 확인" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("이 시험을 현재 차시에서 완전히 삭제합니다.");
      await expect(dialog).toContainText("성적 입력, 응시 대상에서 사라지며");

      const deleteResponse = page.waitForResponse((resp) =>
        resp.request().method() === "DELETE" &&
        resp.url().includes(`/api/v1/exams/${examId}/`) &&
        resp.status() >= 200 &&
        resp.status() < 300,
      );
      await dialog.getByRole("button", { name: "삭제", exact: true }).click();
      await deleteResponse;

      await expect(page).toHaveURL(
        new RegExp(`/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams(?:$|[?#])`),
        { timeout: 10_000 },
      );
      await expect(page).not.toHaveURL(/examId=/);
      await expect(page.getByText(examTitle)).toHaveCount(0, { timeout: 10_000 });

      await assertExamRemovedFromSession(page, examId!);
      examId = null;
    } finally {
      if (examId) {
        await apiCall(page, "DELETE", `/exams/${examId}/?session_id=${SESSION_ID}`).catch(() => undefined);
        await apiCall(page, "DELETE", `/exams/${examId}/`).catch(() => undefined);
      }
    }
  });
});
