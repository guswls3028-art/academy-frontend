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

async function installApi(page: Page): Promise<Array<Record<string, unknown>>> {
  const submissions: Array<Record<string, unknown>> = [];
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
      await route.fulfill({ json: { id: 11, username: "math-student", name: "김수학", is_staff: false, is_superuser: false, tenantRole: "student" } });
      return;
    }
    if (path.endsWith("/student/me/")) {
      await route.fulfill({ json: { id: 11, name: "김수학", is_student: true } });
      return;
    }
    if (path.endsWith("/student/exams/901/questions/")) {
      await route.fulfill({
        json: [
          { id: 1001, number: 1, score: 5, answer_format: "text" },
          { id: 1021, number: 21, score: 10, answer_format: "integer_0_999" },
        ],
      });
      return;
    }
    if (path.endsWith("/student/exams/901/submit/") && request.method() === "POST") {
      submissions.push(request.postDataJSON() as Record<string, unknown>);
      await route.fulfill({ json: { submission_id: 7001, status: "submitted" } });
      return;
    }
    if (path.endsWith("/student/exams/901/")) {
      await route.fulfill({
        json: {
          id: 901,
          title: "수학 숫자 단답 검증",
          open_at: null,
          close_at: null,
          allow_retake: false,
          max_attempts: 1,
          pass_score: 60,
          max_score: 100,
          status: "open",
          has_result: false,
          attempt_count: 0,
        },
      });
      return;
    }
    await route.fulfill({ json: { count: 0, items: [], results: [] } });
  });
  return submissions;
}

test.describe("학생 수학 숫자 단답", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock contract spec.");
  test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });

  test("0~999 입력만 허용하고 제출 시 앞자리 0을 정규화한다", async ({ page }) => {
    const submissions = await installApi(page);
    await page.goto(`${BASE}/student/exams/901/submit`, { waitUntil: "domcontentloaded" });

    const numericInput = page.getByLabel("21번 답");
    await expect(numericInput).toHaveAttribute("inputmode", "numeric");
    await expect(numericInput).toHaveAttribute("maxlength", "3");
    await expect(numericInput).toHaveAttribute("placeholder", "0~999");

    await page.getByLabel("1번 답", { exact: true }).fill("2");
    await numericInput.fill("0079");
    await expect(numericInput).toHaveValue("007");
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
});
