import { expect, test } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.E2E_LOCAL_BASE_URL || "http://localhost:5173";

function fakeJwt(): string {
  const enc = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64url");
  return `${enc({ alg: "none", typ: "JWT" })}.${enc({ exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

test("student score report shows rank and wrong question analysis", async ({ page }) => {
  const token = fakeJwt();

  await page.addInitScript(({ access }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", "refresh-token");
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { access: token });

  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], total: 0 }),
    });
  });

  await page.route("**/api/v1/core/program/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      }),
    });
  });

  await page.route("**/api/v1/core/me/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        username: "score-student",
        name: "테스트학생",
        phone: "01000000000",
        is_staff: false,
        is_superuser: false,
        tenantRole: "student",
      }),
    });
  });

  await page.route("**/api/v1/student/me/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: 1, name: "테스트학생", is_student: true }),
    });
  });

  await page.route("**/api/v1/student/grades/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        exams: [
          {
            exam_id: 101,
            enrollment_id: 201,
            title: "5월 25일 성적표",
            total_score: 72,
            max_score: 100,
            is_pass: true,
            achievement: "PASS",
            meta_status: null,
            retake_count: 1,
            session_title: "3차시",
            lecture_title: "대치 프리미엄반",
            submitted_at: "2026-05-25T09:00:00+09:00",
            rank: 3,
            percentile: 15,
            cohort_size: 20,
            cohort_avg: 64.5,
            total_questions: 5,
            correct_count: 3,
            wrong_count: 2,
            accuracy_rate: 60,
            wrong_question_numbers: [2, 5],
          },
        ],
        homeworks: [],
        labels: { pass: "", fail: "" },
      }),
    });
  });

  await page.route("**/api/v1/student/results/me/exams/101/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        exam_id: 101,
        attempt_id: 301,
        total_score: 72,
        max_score: 100,
        is_pass: true,
        final_pass: true,
        remediated: false,
        clinic_required: false,
        is_provisional: false,
        meta_status: null,
        submitted_at: "2026-05-25T09:00:00+09:00",
        can_retake: false,
        answer_visibility: "hidden",
        answers_visible: false,
        rank: 3,
        percentile: 15,
        cohort_size: 20,
        cohort_avg: 64.5,
        analysis: {
          total_questions: 5,
          correct_count: 3,
          wrong_count: 2,
          accuracy_rate: 60,
          wrong_question_numbers: [2, 5],
        },
      }),
    });
  });

  await page.route("**/api/v1/student/results/me/exams/101/items/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          { question_id: 1, question_number: 1, student_answer: "1", correct_answer: null, score: 20, max_score: 20, is_correct: true },
          { question_id: 2, question_number: 2, student_answer: "4", correct_answer: null, score: 0, max_score: 20, is_correct: false },
          { question_id: 3, question_number: 3, student_answer: "2", correct_answer: null, score: 20, max_score: 20, is_correct: true },
          { question_id: 4, question_number: 4, student_answer: "3", correct_answer: null, score: 20, max_score: 20, is_correct: true },
          { question_id: 5, question_number: 5, student_answer: "1", correct_answer: null, score: 12, max_score: 20, is_correct: false },
        ],
      }),
    });
  });

  await page.goto(`${BASE}/student/grades`, { waitUntil: "networkidle" });
  await expect(page.getByText("5월 25일 성적표")).toBeVisible();
  await expect(page.getByTestId("grade-wrong-summary")).toContainText("오답 2문항");
  await expect(page.getByTestId("grade-wrong-summary")).toContainText("2, 5번");
  await expect(page.getByText("3/20등")).toBeVisible();

  await page.goto(`${BASE}/student/exams/101/result`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("score-analysis-card")).toContainText("핵심 분석");
  await expect(page.getByTestId("score-analysis-card")).toContainText("정답률");
  await expect(page.getByTestId("score-analysis-card")).toContainText("오답");
  await expect(page.getByTestId("wrong-number-chip")).toHaveText(["2", "5"]);
  await expect(page.getByText("정답 내용은 비공개입니다. 틀린 번호와 내 답만 확인할 수 있습니다.")).toBeVisible();
});
