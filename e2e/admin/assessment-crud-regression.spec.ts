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
  title?: string;
};

type HomeworkRow = {
  id?: number;
  title?: string;
  meta?: Record<string, unknown> | null;
};

function rows<T>(value: ListEnvelope<T> | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

test.describe("운영 회귀: 시험·과제 생성/삭제", () => {
  test("시험 삭제와 과제 soft-delete가 운영 차시 목록에 정확히 반영된다", async ({ page }) => {
    test.setTimeout(90_000);

    await loginViaUI(page, "admin");

    const stamp = Date.now();
    const examTitle = `[E2E-${stamp}] 시험 생성삭제 회귀`;
    const homeworkTitle = `[E2E-${stamp}] 과제 생성삭제 회귀`;
    let examId: number | null = null;
    let homeworkId: number | null = null;

    try {
      const examCreate = await apiCall<ExamRow>(page, "POST", "/exams/", {
        title: examTitle,
        description: "",
        exam_type: "regular",
        session_id: SESSION_ID,
        max_score: 100,
        pass_score: 60,
        answer_visibility: "hidden",
      });
      expect(examCreate.status).toBe(201);
      examId = Number(examCreate.body.id);
      expect(examId).toBeGreaterThan(0);

      const examList = await apiCall<ListEnvelope<ExamRow>>(
        page,
        "GET",
        `/exams/?session_id=${SESSION_ID}`,
      );
      expect(examList.status).toBe(200);
      expect(rows(examList.body).some((exam) => Number(exam.id) === examId)).toBe(true);

      await page.goto(
        `${BASE}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams`,
        { waitUntil: "load", timeout: 20_000 },
      );
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      await expect(page.getByText(examTitle).first()).toBeVisible({ timeout: 10_000 });

      const examDelete = await apiCall(page, "DELETE", `/exams/${examId}/`);
      expect([200, 202, 204]).toContain(examDelete.status);
      examId = null;

      const homeworkCreate = await apiCall<HomeworkRow>(page, "POST", "/homeworks/", {
        session_id: SESSION_ID,
        session: SESSION_ID,
        title: homeworkTitle,
      });
      expect(homeworkCreate.status).toBe(201);
      homeworkId = Number(homeworkCreate.body.id);
      expect(homeworkId).toBeGreaterThan(0);

      const homeworkList = await apiCall<ListEnvelope<HomeworkRow>>(
        page,
        "GET",
        `/homeworks/?session_id=${SESSION_ID}`,
      );
      expect(homeworkList.status).toBe(200);
      expect(rows(homeworkList.body).some((homework) => Number(homework.id) === homeworkId)).toBe(true);

      await page.goto(
        `${BASE}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/assignments`,
        { waitUntil: "load", timeout: 20_000 },
      );
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      await expect(page.getByText(homeworkTitle).first()).toBeVisible({ timeout: 10_000 });

      const homeworkDelete = await apiCall(page, "DELETE", `/homeworks/${homeworkId}/`);
      expect([200, 202, 204]).toContain(homeworkDelete.status);

      const defaultListAfterDelete = await apiCall<ListEnvelope<HomeworkRow>>(
        page,
        "GET",
        `/homeworks/?session_id=${SESSION_ID}`,
      );
      expect(defaultListAfterDelete.status).toBe(200);
      expect(rows(defaultListAfterDelete.body).some((homework) => Number(homework.id) === homeworkId)).toBe(false);

      const auditListAfterDelete = await apiCall<ListEnvelope<HomeworkRow>>(
        page,
        "GET",
        `/homeworks/?session_id=${SESSION_ID}&include_removed=true`,
      );
      expect(auditListAfterDelete.status).toBe(200);
      const removedHomework = rows(auditListAfterDelete.body).find(
        (homework) => Number(homework.id) === homeworkId,
      );
      expect(removedHomework?.meta?.removed_from_session_at).toBeTruthy();
      homeworkId = null;
    } finally {
      if (examId) {
        await apiCall(page, "DELETE", `/exams/${examId}/`).catch(() => undefined);
      }
      if (homeworkId) {
        await apiCall(page, "DELETE", `/homeworks/${homeworkId}/`).catch(() => undefined);
      }
    }
  });
});
