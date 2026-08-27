import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const SESSION_ID = 9002;
const EXAM_ID = 301;

function isLocalBase(value: string): boolean {
  try {
    return ["127.0.0.1", "localhost"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function fakeJwt(): string {
  const encode = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp: now + 3600, tenant_code: "ymath", user_id: 1 })}.sig`;
}

async function installTeacherApi(page: import("@playwright/test").Page) {
  let pendingStatus: "PENDING" | "COMPLETED" = "PENDING";
  let correctionPayload: Record<string, unknown> | null = null;

  await page.addInitScript(({ token }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", "teacher-score-refresh");
    localStorage.setItem("tenant_code", "ymath");
    sessionStorage.setItem("tenantCode", "ymath");
  }, { token: fakeJwt() });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path.endsWith("/core/program/")) {
      return route.fulfill({ json: {
        tenantCode: "ymath",
        display_name: "Ymath",
        is_active: true,
        ui_config: {},
        feature_flags: {},
      } });
    }
    if (path.endsWith("/core/me/")) {
      return route.fulfill({ json: {
        id: 1,
        username: "ymath-owner",
        name: "원장",
        is_staff: true,
        is_superuser: false,
        tenantRole: "owner",
        linkedStudents: [],
      } });
    }
    if (path.endsWith("/lectures/lectures/")) {
      return route.fulfill({ json: {
        count: 1,
        results: [{ id: 71, title: "중3 수학", color: "#2563eb", chip_label: "수", is_active: true }],
      } });
    }
    if (path.endsWith("/exams/")) {
      return route.fulfill({ json: {
        count: 1,
        results: [{ id: EXAM_ID, title: "주간 테스트", max_score: 100, pass_score: 60 }],
      } });
    }
    if (path.endsWith("/enrollments/session-enrollments/")) {
      return route.fulfill({ json: {
        count: 3,
        results: [
          { enrollment: 101, student_name: "김확인" },
          { enrollment: 102, student_name: "박완료" },
          { enrollment: 103, student_name: "이대기" },
        ],
      } });
    }
    if (path.endsWith(`/results/admin/exams/${EXAM_ID}/results/`)) {
      return route.fulfill({ json: {
        count: 3,
        next: null,
        previous: null,
        results: [
          { enrollment_id: 101, student_name: "김확인", exam_score: 70, exam_max_score: 100, final_score: 70, passed: true, final_pass: true, correction_session_id: SESSION_ID, correction_status: pendingStatus },
          { enrollment_id: 102, student_name: "박완료", exam_score: 80, exam_max_score: 100, final_score: 80, passed: true, final_pass: true, correction_session_id: SESSION_ID, correction_status: "COMPLETED" },
          { enrollment_id: 103, student_name: "이대기", exam_score: null, exam_max_score: 100, final_score: null, passed: null, final_pass: null, correction_session_id: SESSION_ID, correction_status: null },
        ],
      } });
    }
    if (path.endsWith(`/results/admin/sessions/${SESSION_ID}/score-correction/`) && request.method() === "PATCH") {
      correctionPayload = request.postDataJSON() as Record<string, unknown>;
      pendingStatus = correctionPayload.completed ? "COMPLETED" : "PENDING";
      return route.fulfill({ json: {
        correction_status: pendingStatus,
        correction_completed_at: pendingStatus === "COMPLETED" ? "2026-08-18T00:00:00Z" : null,
        correction_note: "",
      } });
    }
    if (path.endsWith(`/results/admin/sessions/${SESSION_ID}/scores/`)) {
      return route.fulfill({ json: {
        meta: {
          session_title: "9회차",
          lecture_title: "중3 수학",
          exams: [{ exam_id: EXAM_ID, title: "주간 테스트", pass_score: 60, max_score: 100, display_order: 1 }],
          homeworks: [],
        },
        rows: [
          { enrollment_id: 101, student_name: "김확인", exams: [{ exam_id: EXAM_ID, title: "주간 테스트", pass_score: 60, block: { score: 70, max_score: 100, passed: true, clinic_required: false, correction_status: pendingStatus } }], homeworks: [], updated_at: "2026-08-18T00:00:00Z" },
          { enrollment_id: 102, student_name: "박완료", exams: [{ exam_id: EXAM_ID, title: "주간 테스트", pass_score: 60, block: { score: 80, max_score: 100, passed: true, clinic_required: false, correction_status: "COMPLETED" } }], homeworks: [], updated_at: "2026-08-18T00:00:00Z" },
          { enrollment_id: 103, student_name: "이대기", exams: [{ exam_id: EXAM_ID, title: "주간 테스트", pass_score: 60, block: { score: null, max_score: null, passed: null, clinic_required: false, correction_status: null } }], homeworks: [], updated_at: "2026-08-18T00:00:00Z" },
        ],
      } });
    }
    return route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } });
  });

  return {
    correctionPayload: () => correctionPayload,
  };
}

test.describe("교사 모바일 테스트 오답 상태", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock interaction spec.");
  test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });

  test("점수 입력에서 검색·필터·진행률을 보고 학생별 완료 상태를 수정한다", async ({ page }) => {
    const api = await installTeacherApi(page);
    await page.goto(`${BASE}/workspace/mobile/scores/${SESSION_ID}?exam=${EXAM_ID}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "성적 입력" })).toBeVisible();
    const overview = page.getByRole("region", { name: "테스트 오답 확인 현황" });
    await expect(overview).toContainText("1/2 처리");
    const filters = page.getByRole("group", { name: "테스트 오답 확인 학생 필터" });
    await expect(filters.getByRole("button", { name: "확인 필요 1" })).toBeVisible();
    await expect(filters.getByRole("button", { name: "처리됨 1" })).toBeVisible();
    await expect(filters.getByRole("button", { name: "채점 대기 1" })).toBeVisible();

    await filters.getByRole("button", { name: "확인 필요 1" }).click();
    await expect(page.getByText("김확인", { exact: true })).toBeVisible();
    await expect(page.getByText("박완료", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: /김확인 오답 미완료/ }).click();
    await expect.poll(api.correctionPayload).toMatchObject({
      enrollment_id: 101,
      source_type: "exam",
      source_id: EXAM_ID,
      completed: true,
    });
    await expect(filters.getByRole("button", { name: "확인 필요 0" })).toBeVisible();
    await filters.getByRole("button", { name: "처리됨 2" }).click();
    await expect(page.getByRole("button", { name: /김확인 오답 완료/ })).toBeVisible();

    await filters.getByRole("button", { name: /전체/ }).click();
    await page.getByRole("searchbox", { name: "학생 이름 검색" }).fill("박완료");
    await expect(page.getByText("박완료", { exact: true })).toBeVisible();
    await expect(page.getByText("김확인", { exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/teacher-correction-status/mobile-score-entry-390.png", fullPage: true });
  });

  test("미저장 점수는 tenant·account 범위에서만 복구하고 legacy key를 가져오지 않는다", async ({ page }) => {
    await installTeacherApi(page);
    await page.addInitScript(({ examId }) => {
      sessionStorage.setItem(`score_entry_draft_${examId}`, JSON.stringify({ 101: "99" }));
      sessionStorage.setItem(
        `academy:score-entry-draft:v2:ymath:1:${examId}`,
        JSON.stringify({ 101: "77" }),
      );
    }, { examId: EXAM_ID });

    await page.goto(`${BASE}/workspace/mobile/scores/${SESSION_ID}?exam=${EXAM_ID}`, { waitUntil: "domcontentloaded" });
    const scoreInput = page.locator("input[inputmode=decimal]").first();
    await expect(scoreInput).toHaveValue("77");

    await scoreInput.fill("88");
    const stored = await page.evaluate(({ examId }) => ({
      scoped: sessionStorage.getItem(`academy:score-entry-draft:v2:ymath:1:${examId}`),
      legacy: sessionStorage.getItem(`score_entry_draft_${examId}`),
    }), { examId: EXAM_ID });
    expect(JSON.parse(stored.scoped || "{}")["101"]).toBe("88");
    expect(JSON.parse(stored.legacy || "{}")["101"]).toBe("99");
  });

  test("성적 조회에서 상태를 보고 정확한 차시 수정 화면으로 이동한다", async ({ page }) => {
    await installTeacherApi(page);
    await page.goto(`${BASE}/workspace/mobile/results`, { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /중3 수학/ }).click();
    await page.getByRole("button", { name: "주간 테스트", exact: true }).click();
    await expect(page.getByText("오답 미완료", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "김확인 오답 상태 수정" }).click();
    await expect(page).toHaveURL(new RegExp(`/workspace/mobile/scores/${SESSION_ID}\\?exam=${EXAM_ID}`));
  });
});
