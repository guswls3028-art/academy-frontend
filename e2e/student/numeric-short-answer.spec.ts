import { expect, test, type Page } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";

function isLocalBase(value: string): boolean {
  try {
    return ["127.0.0.1", "localhost"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    .toString("base64url");
  return `e30.${payload}.student`;
}

type Viewer = "student" | "parent";

async function installApi(page: Page, viewer: Viewer = "student", essay = false): Promise<{
  submissions: Array<Record<string, unknown>>;
  studentScopedHeaders: Array<string | undefined>;
}> {
  const submissions: Array<Record<string, unknown>> = [];
  const studentScopedHeaders: Array<string | undefined> = [];
  await page.addInitScript(({ token }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", "student-refresh");
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { token: fakeJwt() });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path.endsWith("/core/program/")) {
      await route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "학원플러스", is_active: true, ui_config: {}, feature_flags: {} } });
      return;
    }
    if (path.endsWith("/core/me/")) {
      await route.fulfill({ json: viewer === "parent"
        ? {
            id: 910,
            username: "math-parent",
            name: "김보호",
            is_staff: false,
            is_superuser: false,
            tenantRole: "parent",
            linkedStudents: [{ id: 501, name: "김수학" }],
          }
        : { id: 11, username: "math-student", name: "김수학", is_staff: false, is_superuser: false, tenantRole: "student" } });
      return;
    }
    if (path.endsWith("/student/me/")) {
      studentScopedHeaders.push(request.headers()["x-student-id"]);
      await route.fulfill({ json: { id: viewer === "parent" ? 501 : 11, name: "김수학", is_student: true, isParentReadOnly: viewer === "parent" } });
      return;
    }
    if (path.endsWith("/student/exams/901/questions/")) {
      studentScopedHeaders.push(request.headers()["x-student-id"]);
      await route.fulfill({
        json: [
          { id: 1001, number: 1, score: 5, answer_format: "text" },
          { id: 1021, number: 21, score: 10, question_kind: "essay", answer_format: essay ? "text" : "integer_0_999" },
        ],
      });
      return;
    }
    if (path.endsWith("/student/exams/901/submit/") && request.method() === "POST") {
      studentScopedHeaders.push(request.headers()["x-student-id"]);
      submissions.push(request.postDataJSON() as Record<string, unknown>);
      if (essay && submissions.length === 1) {
        await route.fulfill({ status: 409, json: { detail: "시험의 문항·정답 준비가 완료되지 않았습니다. 선생님 확인 후 다시 제출해 주세요." } });
        return;
      }
      await route.fulfill({ json: { submission_id: 7001, status: "submitted" } });
      return;
    }
    if (path.endsWith("/student/exams/901/")) {
      studentScopedHeaders.push(request.headers()["x-student-id"]);
      await route.fulfill({
        json: {
          id: 901,
          title: "수학 숫자 단답 검증",
          open_at: null,
          close_at: null,
          allow_retake: essay,
          max_attempts: essay ? 2 : 1,
          pass_score: 60,
          max_score: 100,
          status: "open",
          has_result: essay,
          attempt_count: essay ? 1 : 0,
        },
      });
      return;
    }
    if (essay && path.endsWith("/student/results/me/exams/901/")) {
      await route.fulfill({ json: { exam_id: 901, student_results_published: false, grading_status: "subjective_pending", can_retake: false } });
      return;
    }
    await route.fulfill({ json: { count: 0, items: [], results: [] } });
  });
  return { submissions, studentScopedHeaders };
}

test.describe("학생 수학 숫자 단답", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock contract spec.");
  test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });

  for (const width of [390, 1366]) {
    test(`서술형 재응시·설정 오류 복구·긴 답안 보존 ${width}px`, async ({ page }) => {
      const { submissions } = await installApi(page, "student", true);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE}/student/exams/901/submit`);
      const answer = "첫 번째 풀이를 충분히 길게 작성합니다.\n다음 줄에서도 근거와 결론을 이어서 설명합니다.";
      await page.getByLabel("1번 답", { exact: true }).fill("2");
      await page.getByLabel("21번 답").fill(answer);
      await expect(page.getByLabel("21번 답")).toHaveJSProperty("tagName", "TEXTAREA");
      await page.reload();
      await expect(page.getByLabel("21번 답")).toHaveValue(answer);
      await page.getByRole("button", { name: "제출하기" }).click();
      await page.locator("[data-confirm-dialog]").getByRole("button", { name: "제출", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: "정답 준비" }).first()).toBeVisible();
      await expect(page.getByLabel("21번 답")).toHaveValue(answer);
      await page.getByRole("button", { name: "제출하기" }).click();
      await page.locator("[data-confirm-dialog]").getByRole("button", { name: "제출", exact: true }).click();
      await expect(page).toHaveURL(/\/result$/);
      await expect(page.getByText("서술형 채점 중입니다.")).toBeVisible();
      expect(submissions).toHaveLength(2);
      expect(submissions[1]).toEqual(submissions[0]);
      expect(JSON.stringify(submissions[1])).toContain(JSON.stringify(answer).slice(1, -1));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/online-submit-pending-${width}.png`, fullPage: true });
    });
  }

  test("0~999 입력과 같은 계정 재조회를 보존하고 제출 시 앞자리 0을 정규화한다", async ({ page }) => {
    const { submissions } = await installApi(page);
    await page.goto(`${BASE}/student/exams/901/submit`, { waitUntil: "domcontentloaded" });

    const numericInput = page.getByLabel("21번 답");
    await expect(numericInput).toHaveAttribute("inputmode", "numeric");
    await expect(numericInput).toHaveAttribute("maxlength", "3");
    await expect(numericInput).toHaveAttribute("placeholder", "0~999");

    await page.getByLabel("1번 답", { exact: true }).fill("2");
    await numericInput.fill("0079");
    await expect(numericInput).toHaveValue("007");
    await expect.poll(() => page.evaluate(() => (
      localStorage.getItem("exam-draft:901:hakwonplus:user:11")
    ))).toContain('"1021":"007"');
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("1번 답", { exact: true })).toHaveValue("2");
    await expect(page.getByLabel("21번 답")).toHaveValue("007");
    await page.screenshot({ path: "test-results/numeric-short-answer/student-input-390.png", fullPage: true });
    await page.getByRole("button", { name: "제출하기" }).click();
    await expect(page.getByText("답안을 제출하시겠습니까? 제출 후에는 수정할 수 없습니다.")).toBeVisible();
    await page.getByRole("button", { name: "제출", exact: true }).click();

    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0]).toEqual({
      answers: [
        { exam_question_id: 1001, answer: "2" },
        { exam_question_id: 1021, answer: "7" },
      ],
    });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("학부모가 선택 자녀의 답안을 저장·재접속 후 제출하고 모든 요청을 자녀로 범위화한다", async ({ page }) => {
    const state = await installApi(page, "parent");
    await page.goto(`${BASE}/student/exams/901/submit`, { waitUntil: "domcontentloaded" });

    await expect(page.getByText("학부모는 시험에 응시할 수 없습니다.")).toHaveCount(0);
    await page.getByLabel("1번 답", { exact: true }).fill("3");
    await page.getByLabel("21번 답").fill("008");
    await expect.poll(() => page.evaluate(() => (
      localStorage.getItem("exam-draft:901:student:501:hakwonplus:user:910")
    ))).toContain('"1021":"008"');

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("1번 답", { exact: true })).toHaveValue("3");
    await expect(page.getByLabel("21번 답")).toHaveValue("008");
    await page.getByRole("button", { name: "제출하기" }).click();
    await page.getByRole("button", { name: "제출", exact: true }).click();

    await expect.poll(() => state.submissions.length).toBe(1);
    expect(state.submissions[0]).toEqual({
      answers: [
        { exam_question_id: 1001, answer: "3" },
        { exam_question_id: 1021, answer: "8" },
      ],
    });
    expect(state.studentScopedHeaders.length).toBeGreaterThan(0);
    expect(state.studentScopedHeaders.every((value) => value === "501")).toBe(true);
    await expect.poll(() => page.evaluate(() => (
      localStorage.getItem("exam-draft:901:student:501:hakwonplus:user:910")
    ))).toBeNull();
  });
});
