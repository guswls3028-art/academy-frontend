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

async function installApi(page: Page, viewer: Viewer = "student", essay = false,
  recovery: { loseResponse?: boolean; closeAfterSubmit?: boolean; failQuestionsAfterSubmit?: boolean; failureThenReadiness?: boolean; otherDeviceAttempt?: boolean } = {}): Promise<{
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
      if (recovery.failQuestionsAfterSubmit && submissions.length > 0) {
        await route.fulfill({ status: 503, json: { detail: "문항 조회 실패" } });
        return;
      }
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
      if (recovery.otherDeviceAttempt && submissions.length <= 2) {
        if (submissions.length === 1) await route.fulfill({ status: 504, json: { detail: "연결 지연으로 제출 결과를 확인하지 못했습니다." } });
        else await route.fulfill({ status: 409, json: { code: "online_attempt_changed", detail: "다른 화면에서 응시가 완료되었습니다. 결과를 확인해 주세요." } });
        return;
      }
      if (recovery.failureThenReadiness && submissions.length <= 2) {
        await route.fulfill(submissions.length === 1
          ? { status: 500, json: { detail: "채점 실패. 같은 제출을 다시 확인해 주세요.", code: "online_submission_retry" } }
          : { status: 409, json: { detail: "시험의 문항·정답 준비가 완료되지 않았습니다. 선생님 확인 후 다시 제출해 주세요." } });
        return;
      }
      if (recovery.loseResponse && submissions.length === 1) {
        await route.fulfill({ status: 504, json: { detail: "제출 결과를 확인하지 못했습니다. 같은 제출을 다시 확인해 주세요." } });
        return;
      }
      if (essay && submissions.length === 1) {
        await route.fulfill({ status: 409, json: { detail: "시험의 문항·정답 준비가 완료되지 않았습니다. 선생님 확인 후 다시 제출해 주세요." } });
        return;
      }
      await route.fulfill({ json: { submission_id: 7001, status: "submitted" } });
      return;
    }
    if (path.endsWith("/student/exams/901/")) {
      if (recovery.closeAfterSubmit && submissions.length > 0) {
        await route.fulfill({ status: 404, json: { detail: "시험이 마감되었습니다." } });
        return;
      }
      studentScopedHeaders.push(request.headers()["x-student-id"]);
      await route.fulfill({
        json: {
          id: 901,
          title: "수학 숫자 단답 검증",
          open_at: null,
          close_at: null,
          allow_retake: essay || recovery.otherDeviceAttempt,
          max_attempts: essay || recovery.otherDeviceAttempt ? 2 : 1,
          pass_score: 60,
          max_score: 100,
          status: "open",
          has_result: essay || ((recovery.loseResponse || recovery.otherDeviceAttempt) && submissions.length > 0),
          attempt_count: essay || ((recovery.loseResponse || recovery.otherDeviceAttempt) && submissions.length > 0) ? 1 : 0,
        },
      });
      return;
    }
    if ((essay || recovery.otherDeviceAttempt) && path.endsWith("/student/results/me/exams/901/")) {
      await route.fulfill({ json: { exam_id: 901, student_results_published: false, grading_status: "subjective_pending", can_retake: !!recovery.otherDeviceAttempt } });
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
      expect(submissions[1].answers).toEqual(submissions[0].answers);
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
      client_request_id: expect.any(String),
      expected_attempt_count: 0,
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
      client_request_id: expect.any(String),
      expected_attempt_count: 0,
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

test("늦은 제출 확인이 다른 탭의 새 답안과 제출 식별자를 지우지 않는다", async ({ page }) => {
  const { submissions } = await installApi(page, "student", false, { loseResponse: true });
  await page.goto(`${BASE}/student/exams/901/submit`);
  await page.getByLabel("1번 답", { exact: true }).fill("3");
  await page.getByRole("button", { name: "제출하기", exact: true }).click();
  await page.getByRole("button", { name: "제출", exact: true }).click();
  await expect(page.getByRole("button", { name: "같은 제출 다시 확인" })).toBeVisible();
  const next = { ...submissions[0], client_request_id: "20000000-0000-4000-8000-000000000002",
    answers: [{ exam_question_id: 1001, answer: "5" }] };
  await page.evaluate((payload) => {
    localStorage.setItem("exam-draft:901:hakwonplus:user:11:submission", JSON.stringify(payload));
    localStorage.setItem("exam-draft:901:hakwonplus:user:11", JSON.stringify({ 1001: "5" }));
  }, next);
  await page.getByRole("button", { name: "같은 제출 다시 확인" }).click();
  await expect(page).toHaveURL(/\/student\/exams\/901\/result$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("exam-draft:901:hakwonplus:user:11:submission")!))).toEqual(next);
  expect(await page.evaluate(() => localStorage.getItem("exam-draft:901:hakwonplus:user:11"))).toBe('{"1001":"5"}');
});

test("다른 기기 응시로 거절된 요청은 답안을 보존하고 새 재응시를 허용한다", async ({ page }) => {
  const { submissions } = await installApi(page, "student", false, { otherDeviceAttempt: true });
  const draftKey = "exam-draft:901:hakwonplus:user:11";
  await page.goto(`${BASE}/student/exams/901/submit`);
  await page.getByLabel("1번 답", { exact: true }).fill("3");
  await page.getByRole("button", { name: "제출하기", exact: true }).click();
  await page.getByRole("button", { name: "제출", exact: true }).click();
  await expect(page.getByRole("button", { name: "같은 제출 다시 확인", exact: true })).toBeEnabled();
  expect(submissions[0].expected_attempt_count).toBe(0);
  await page.reload();
  await page.getByRole("button", { name: "같은 제출 다시 확인", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/exams\/901\/result$/);
  expect(submissions[1]).toEqual(submissions[0]);
  expect(await page.evaluate((key) => localStorage.getItem(`${key}:submission`), draftKey)).toBeNull();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!)[1001], draftKey)).toBe("3");
  await page.goto(`${BASE}/student/exams/901`);
  await page.getByRole("link", { name: /^답안 입력하기/ }).click();
  await expect(page.getByLabel("1번 답", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("1번 답", { exact: true })).toHaveValue("3");
  await page.getByLabel("1번 답", { exact: true }).fill("5");
  await page.getByRole("button", { name: "제출하기", exact: true }).click();
  await page.getByRole("button", { name: "제출", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/exams\/901\/result$/);
  expect(submissions).toHaveLength(3);
  expect(submissions[2]).toMatchObject({ expected_attempt_count: 1, answers: [{ exam_question_id: 1001, answer: "5" }] });
  expect(submissions[2].client_request_id).not.toBe(submissions[0].client_request_id);
});

for (const width of [390, 1366]) {
  test(`응답 유실 뒤 reload와 같은 요청 재확인 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { submissions } = await installApi(page, "student", false,
      { loseResponse: true, closeAfterSubmit: width === 1366, failQuestionsAfterSubmit: width === 390 });
    await page.goto(`${BASE}/student/exams/901/submit`);
    await page.getByLabel("1번 답", { exact: true }).fill("3");
    await page.getByLabel("21번 답").fill("9");
    await page.getByRole("button", { name: "제출하기", exact: true }).click();
    await page.getByRole("button", { name: "제출", exact: true }).click();
    await expect(page.getByRole("button", { name: "같은 제출 다시 확인" })).toBeVisible();
    await expect(page.getByLabel("1번 답", { exact: true })).toBeDisabled();
    expect(submissions).toHaveLength(1);
    expect(submissions[0].client_request_id).toMatch(/^[a-f0-9-]{36}$/i);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "같은 제출 다시 확인" })).toBeEnabled();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/exam-response-recovery-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "같은 제출 다시 확인" }).click();
    await expect.poll(() => submissions.length).toBe(2);
    expect(submissions[1]).toEqual(submissions[0]);
    await expect(page).toHaveURL(/\/student\/exams\/901\/result$/);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("exam-draft:901:hakwonplus:user:11:submission"))).toBeNull();
  });
}

for (const failure of ["quota", "security", "readback"] as const) {
  test(`제출 식별자 ${failure} 저장 실패는 전송하지 않고 같은 화면에서 복구한다`, async ({ page }) => {
    await page.setViewportSize({ width: failure === "quota" ? 390 : 1366, height: 900 });
    const { submissions } = await installApi(page);
    await page.goto(`${BASE}/student/exams/901/submit`);
    await page.getByLabel("1번 답", { exact: true }).fill("3");
    await page.evaluate((mode) => {
      const originalSet = Storage.prototype.setItem;
      const originalGet = Storage.prototype.getItem;
      Object.assign(window, { restoreExamStorage: () => {
        Storage.prototype.setItem = originalSet;
        Storage.prototype.getItem = originalGet;
      } });
      Storage.prototype.setItem = function (key, value) {
        if (key.endsWith(":submission")) {
          if (mode === "quota") throw new DOMException("qa full", "QuotaExceededError");
          if (mode === "readback") return;
        }
        return originalSet.call(this, key, value);
      };
      Storage.prototype.getItem = function (key) {
        if (mode === "security" && key.endsWith(":submission")) throw new DOMException("qa blocked", "SecurityError");
        return originalGet.call(this, key);
      };
    }, failure);
    await page.getByRole("button", { name: "제출하기", exact: true }).click();
    await page.getByRole("button", { name: "제출", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("안전하게 저장하지 못했습니다");
    expect(submissions).toHaveLength(0);
    await expect(page.getByRole("button", { name: "제출하기", exact: true })).toBeEnabled();
    await expect(page.getByLabel("1번 답", { exact: true })).toHaveValue("3");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/exam-storage-${failure}.png`, fullPage: true });
    await page.evaluate(() => (window as unknown as { restoreExamStorage: () => void }).restoreExamStorage());
    await page.getByRole("button", { name: "제출하기", exact: true }).click();
    await page.getByRole("button", { name: "제출", exact: true }).click();
    await expect(page).toHaveURL(/\/student\/exams\/901\/result$/);
    expect(submissions).toHaveLength(1);
  });
}

test("접수 후 500과 준비 오류 409를 거쳐도 마감 뒤 같은 UUID로 복구한다", async ({ page }) => {
  const { submissions } = await installApi(page, "student", false,
    { failureThenReadiness: true, closeAfterSubmit: true });
  await page.goto(`${BASE}/student/exams/901/submit`);
  await page.getByLabel("1번 답", { exact: true }).fill("3");
  await page.getByRole("button", { name: "제출하기", exact: true }).click();
  await page.getByRole("button", { name: "제출", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("채점 실패");
  await page.reload();
  await page.getByRole("button", { name: "같은 제출 다시 확인", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("준비가 완료되지 않았습니다");
  await page.reload();
  await page.getByRole("button", { name: "같은 제출 다시 확인", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/exams\/901\/result$/);
  expect(submissions).toHaveLength(3);
  expect(submissions[1]).toEqual(submissions[0]);
  expect(submissions[2]).toEqual(submissions[0]);
});

for (const width of [390, 1366]) {
test(`B의 확인 중 A가 먼저 제출하면 B 초안을 보존한다 ${width}px`, async ({ page, context }) => {
  await page.setViewportSize({ width, height: 900 });
  const a = await installApi(page, "student", false, { loseResponse: true });
  const other = await context.newPage();
  try {
    await other.setViewportSize({ width, height: 900 });
    const b = await installApi(other);
    await page.goto(`${BASE}/student/exams/901/submit`);
    await other.goto(`${BASE}/student/exams/901/submit`);
    await other.bringToFront();
    await other.getByLabel("1번 답", { exact: true }).fill("5");
    await other.getByRole("button", { name: "제출하기", exact: true }).click();
    await expect(other.getByRole("button", { name: "제출", exact: true })).toBeVisible();
    await page.bringToFront();
    await page.getByLabel("1번 답", { exact: true }).fill("3");
    await page.getByRole("button", { name: "제출하기", exact: true }).click();
    await page.getByRole("button", { name: "제출", exact: true }).click();
    await expect(page.getByRole("button", { name: "같은 제출 다시 확인", exact: true })).toBeVisible();
    await other.bringToFront();
    await other.getByRole("button", { name: "제출", exact: true }).click();
    await expect(other.getByRole("alert")).toContainText("다른 화면에서 먼저 제출한 답안");
    expect(b.submissions).toHaveLength(0);
    await expect(other.getByLabel("1번 답", { exact: true })).toHaveValue("5");
    await other.reload();
    await expect(other.getByLabel("1번 답", { exact: true })).toHaveValue("5");
    await expect.poll(() => other.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await other.screenshot({ path: `test-results/exam-cross-tab-${width}.png`, fullPage: true });
    await other.getByRole("button", { name: "먼저 제출한 답안 확인", exact: true }).click();
    await expect(other).toHaveURL(/\/student\/exams\/901\/result$/);
    expect(b.submissions).toEqual([a.submissions[0]]);
    expect(await other.evaluate(() => JSON.parse(localStorage.getItem("exam-draft:901:hakwonplus:user:11")!)[1001])).toBe("5");
    await page.bringToFront();
    await page.getByRole("button", { name: "같은 제출 다시 확인", exact: true }).click();
    await expect(page).toHaveURL(/\/student\/exams\/901\/result$/);
    expect(await other.evaluate(() => JSON.parse(localStorage.getItem("exam-draft:901:hakwonplus:user:11")!)[1001])).toBe("5");
  } finally { await other.close(); }
});
}
