import { expect, test } from "../fixtures/strictTest";
import type { Route } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": BASE,
      "access-control-allow-headers": "authorization,content-type,x-client,x-client-version,x-tenant-code",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  });
}

test("학생의 여러 강의 시험과 워크북을 한 HWPX로 만든다", async ({ page }) => {
  const createPayloads: Array<Record<string, unknown>> = [];
  const fingerprint = "d".repeat(64);
  await page.route("**/api/v1/results/wrong-notes/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return json(route, {}, 204);
    if (path.endsWith("/wrong-notes/sources/") && request.method() === "GET") {
      return json(route, {
        student_id: 77,
        sources: [
          {
            type: "exam",
            id: 41,
            enrollment_id: 7,
            lecture_id: 2,
            lecture_title: "수학 I",
            title: "7월 진단평가",
            session_order: 4,
            wrong_note_count: 1,
            ready: true,
          },
          {
            type: "homework",
            id: 91,
            enrollment_id: 8,
            lecture_id: 3,
            lecture_title: "대수",
            title: "Remake WB 3",
            session_order: 3,
            wrong_note_count: 1,
            ready: true,
          },
        ],
      });
    }
    if (path.endsWith("/wrong-notes/preview/") && request.method() === "POST") {
      const payload = request.postDataJSON() as { source_selection?: Array<{ type: string }> };
      const selection = payload.source_selection ?? [];
      const previewItems = [
        {
          exam_id: 41,
          exam_title: "7월 진단평가",
          session_order: 4,
          session_title: "4회차",
          attempt_id: 1,
          attempt_created_at: "2026-08-05T00:00:00Z",
          question_id: 101,
          question_number: 2,
          answer_type: "choice",
          question_image_url: "",
          has_question_image: false,
          explanation_image_url: "",
          has_teacher_explanation: true,
          student_answer: "1",
          correct_answer: "2",
          is_correct: false,
          include_in_wrong_note: true,
          score: 0,
          max_score: 5,
        },
        {
          exam_id: 501,
          exam_title: "Remake WB 3",
          session_order: 3,
          session_title: "3회차",
          attempt_id: 2,
          attempt_created_at: "2026-08-05T00:00:00Z",
          question_id: 301,
          question_number: 7,
          answer_type: "essay",
          question_image_url: "",
          has_question_image: true,
          explanation_image_url: "",
          has_teacher_explanation: true,
          student_answer: "",
          correct_answer: "",
          is_correct: true,
          include_in_wrong_note: true,
          score: 0,
          max_score: 1,
        },
      ].filter((_, index) => index === 0 || selection.some((item) => item.type === "homework"));
      return json(route, {
        count: previewItems.length,
        source_fingerprint: fingerprint,
        next: null,
        prev: null,
        source_selection: selection,
        results: previewItems,
      });
    }
    if (path.endsWith("/wrong-notes/documents/") && request.method() === "POST") {
      createPayloads.push(request.postDataJSON() as Record<string, unknown>);
      return json(route, {
        job_id: 19,
        status: "PENDING",
        output_format: "hwpx",
        source_fingerprint: fingerprint,
      }, 202);
    }
    if (path.endsWith("/wrong-notes/documents/19/") && request.method() === "GET") {
      return json(route, {
        job_id: 19,
        status: "DONE",
        file_path: "tenants/4/results/wrong-notes/19.hwpx",
        file_url: "https://download.example/student-77.hwpx",
        error_message: "",
        output_format: "hwpx",
        filename: "student-77.hwpx",
        created_at: "2026-08-05T00:00:00Z",
        updated_at: "2026-08-05T00:00:01Z",
      });
    }
    return json(route, { detail: `Unhandled ${request.method()} ${path}` }, 404);
  });

  await page.setViewportSize({ width: 1100, height: 850 });
  await page.goto(`${BASE}/e2e-student-wrong-note-harness.html`, { timeout: 60_000 });
  await page.getByText("7월 진단평가", { exact: true }).click();
  await page.getByText("Remake WB 3", { exact: true }).click();

  await expect(page.getByText("2번", { exact: true })).toBeVisible();
  await expect(page.getByText("7번", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "한글(HWPX)" }).click();
  await page.getByRole("button", { name: "통합 오답노트 만들기" }).click();
  await expect(page.getByRole("link", { name: "완성된 한글 문서 열기" })).toBeVisible();

  expect(createPayloads).toHaveLength(1);
  expect(createPayloads[0]).toMatchObject({
    student_id: 77,
    output_format: "hwpx",
    source_fingerprint: fingerprint,
  });
  expect(createPayloads[0]?.source_selection).toEqual([
    { type: "exam", id: 41, enrollment_id: 7 },
    { type: "homework", id: 91, enrollment_id: 8 },
  ]);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "통합 오답노트 만들기" })).toBeVisible();
});
