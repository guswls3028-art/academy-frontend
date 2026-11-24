import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const SESSION_ID = 7711;

function fakeJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function installApi(page: Page, beforeUploadResponse?: () => Promise<void>, gradeFixture?: {
  role?: "student" | "parent";
  homeworks: Record<string, unknown>[];
}) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "학생 제출 route-mock 검증은 로컬 dev 서버 전용",
  );
  const token = fakeJwt();
  let submissionCount = 0;
  const submissionTargets: string[] = [];
  const mediaFiles: Array<Record<string, unknown>> = [];

  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, token);

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const fulfill = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path.endsWith("/token/refresh/")) return fulfill({ access: token, refresh: `${token}-refresh` });
    if (path.endsWith("/core/program/")) {
      return fulfill({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        is_active: true,
        feature_flags: {},
        ui_config: {},
      });
    }
    if (path.endsWith("/core/me/")) {
      return fulfill({
        id: gradeFixture?.role === "parent" ? 920 : 12,
        username: gradeFixture?.role === "parent" ? "parent-920" : "student-12",
        name: "김하늘",
        is_staff: false,
        is_superuser: false,
        tenantRole: gradeFixture?.role ?? "student",
        linkedStudents: gradeFixture?.role === "parent" ? [{ id: 12, name: "김하늘" }] : [],
      });
    }
    if (path.endsWith("/student/me/")) {
      return fulfill({ id: 12, name: "김하늘", displayName: "김하늘", is_student: true });
    }
    if (path.endsWith("/results/parent/assessment-comments/")) {
      expect(gradeFixture?.role).toBe("parent");
      expect(request.headers()["x-student-id"]).toBe("12");
      return fulfill({ items: [] });
    }
    if (path.endsWith("/student/grades/")) {
      return fulfill({
        exams: [
          {
            exam_id: 301,
            enrollment_id: 401,
            session_id: SESSION_ID,
            title: "현재 차시 단원평가",
            total_score: null,
            max_score: 100,
            is_pass: false,
            achievement: "NOT_SUBMITTED",
            meta_status: "NOT_SUBMITTED",
            session_title: "3차시",
            lecture_title: "고1 수학",
            submitted_at: null,
          },
          {
            exam_id: 302,
            enrollment_id: 401,
            session_id: 8811,
            title: "다른 차시 단원평가",
            total_score: null,
            max_score: 100,
            is_pass: false,
            achievement: "NOT_SUBMITTED",
            meta_status: "NOT_SUBMITTED",
            session_title: "4차시",
            lecture_title: "고1 수학",
            submitted_at: null,
          },
        ],
        homeworks: gradeFixture?.homeworks ?? [
          {
            homework_id: 501,
            enrollment_id: 401,
            session_id: SESSION_ID,
            title: "현재 차시 필수 과제",
            score: null,
            max_score: 100,
            passed: false,
            achievement: "NOT_SUBMITTED",
            session_title: "3차시",
            lecture_title: "고1 수학",
          },
          {
            homework_id: 502,
            enrollment_id: 401,
            session_id: SESSION_ID,
            title: "현재 차시 추가 과제",
            score: null,
            max_score: 100,
            passed: false,
            achievement: "NOT_SUBMITTED",
            session_title: "3차시",
            lecture_title: "고1 수학",
          },
          {
            homework_id: 503,
            enrollment_id: 401,
            session_id: 8811,
            title: "다른 차시 과제",
            score: null,
            max_score: 100,
            passed: false,
            achievement: "NOT_SUBMITTED",
            session_title: "4차시",
            lecture_title: "고1 수학",
          },
          {
            homework_id: 504,
            enrollment_id: 401,
            session_id: SESSION_ID,
            title: "수업 중 교사 확인 과제",
            score: null,
            max_score: 100,
            passed: false,
            achievement: "REMEDIATED",
            teacher_resolved: true,
            grading_mode: "SCORE",
            session_title: "3차시",
            lecture_title: "고1 수학",
          },
        ],
        exam_trend: [],
        exam_summary: {
          scored_count: 0,
          average_score_pct: null,
          latest_score_pct: null,
          change_pct_points: null,
          best_score_pct: null,
        },
        lecture_options: [],
      });
    }
    if (/\/submissions\/submissions\/homework\/\d+\/media\/$/.test(path) && request.method() === "GET") {
      return fulfill({
        files: path.endsWith("/homework/501/media/") ? mediaFiles : [],
        limits: {
          max_files: 20,
          max_file_size_bytes: 100 * 1024 * 1024,
          max_total_size_bytes: 500 * 1024 * 1024,
        },
      });
    }
    const mediaTarget = path.match(/\/submissions\/submissions\/homework\/(\d+)\/media\/$/);
    if (mediaTarget && request.method() === "POST") submissionTargets.push(mediaTarget[1]);
    if (path.endsWith("/submissions/submissions/homework/501/media/") && request.method() === "POST") {
      submissionCount += 1;
      const body = request.postData() ?? "";
      expect(body).toContain("401");
      const field = (name: string) => body.match(new RegExp(`name="${name}"\\r?\\n\\r?\\n([^\\r\\n]+)`))?.[1] ?? "";
      await new Promise((resolve) => setTimeout(resolve, 250));
      await beforeUploadResponse?.();
      const uploaded = {
        id: String(900 + submissionCount),
        legacy: false,
        client_file_id: field("client_file_id"),
        upload_batch_id: field("upload_batch_id"),
        position: Number(field("position")),
        original_filename: body.match(/filename="([^"]+)"/)?.[1] ?? "제출 파일",
        media_kind: "image",
        mime_type: "image/png",
        file_size: 11,
        status: "uploaded",
        error_message: "",
        upload_started_at: "2026-08-23T00:00:00Z",
        uploaded_at: "2026-08-23T00:00:01Z",
        failed_at: null,
        removed_at: null,
        created_at: "2026-08-23T00:00:00Z",
      };
      mediaFiles.push(uploaded);
      return fulfill(uploaded, 201);
    }
    return fulfill({ count: 0, results: [] });
  });

  return { getSubmissionCount: () => submissionCount, submissionTargets };
}

test("차시 제출 링크는 다른 차시를 숨기고 과제별 선택 복원·제출 후 재조회를 완료한다", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installApi(page);
  await page.goto(`${BASE}/student/submit/assignment?sessionId=${SESSION_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  await expect(page.getByText("현재 차시의 제출 항목만 표시합니다")).toBeVisible();
  await expect(page.getByText("현재 차시 필수 과제", { exact: true })).toBeVisible();
  await expect(page.getByText("현재 차시 추가 과제", { exact: true })).toBeVisible();
  await expect(page.getByText("현재 차시 단원평가", { exact: true })).toBeVisible();
  await expect(page.getByText("다른 차시 과제", { exact: true })).toHaveCount(0);
  await expect(page.getByText("다른 차시 단원평가", { exact: true })).toHaveCount(0);
  await expect(page.getByText("수업 중 교사 확인 과제", { exact: true })).toHaveCount(0);

  await page.getByText("현재 차시 필수 과제", { exact: true }).click();
  const fileInput = page.locator('input[type="file"]');
  await expect(page.getByRole("button", { name: "사진·동영상 여러 개 선택" })).toBeEnabled();
  await fileInput.setInputFiles({
    name: "풀이.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("safe-image"),
  });
  await expect(page.getByText(/풀이\.jpg/)).toBeVisible();
  await expect(page.getByText(/이 기기에 임시 보관했습니다/)).toBeVisible();

  await page.getByText("현재 차시 추가 과제", { exact: true }).click();
  await expect(page.getByText(/풀이\.jpg/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "새 파일을 선택해 주세요" })).toBeDisabled();

  await fileInput.setInputFiles({
    name: "메모.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not allowed"),
  });
  await expect(page.getByRole("alert")).toContainText("지원하지 않는 형식");

  await page.getByText("현재 차시 필수 과제", { exact: true }).click();
  const pending = page.getByRole("region", { name: "이번에 제출할 파일" });
  await expect(pending.getByText("풀이.jpg", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "사진·동영상 여러 개 선택" })).toBeEnabled();
  await fileInput.setInputFiles({
    name: "최종풀이.png",
    mimeType: "image/png",
    buffer: Buffer.from("final-image"),
  });
  await page.getByRole("button", { name: "파일 2개 제출하기" }).click();
  await expect(page.getByRole("button", { name: /현재 차시 추가 과제/ })).toBeDisabled();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible();
  await expect(pending).toHaveCount(0);
  const saved = page.getByRole("region", { name: "이미 제출한 파일" });
  await expect(saved.getByText("최종풀이.png", { exact: true })).toBeVisible();
  await expect(saved.getByText("풀이.jpg", { exact: true })).toBeVisible();
  expect(api.getSubmissionCount()).toBe(2);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /현재 차시 필수 과제/ }).click();
  await expect(saved.getByText("최종풀이.png", { exact: true })).toBeVisible();
  await expect(saved.getByText("풀이.jpg", { exact: true })).toBeVisible();
  await expect(pending).toHaveCount(0);
  await page.getByText("현재 차시 추가 과제", { exact: true }).click();
  await expect(page.locator('[class*="successMessage"]')).toHaveCount(0);
  await expect(page.getByText("최종풀이.png", { exact: true })).toHaveCount(0);
  await expect(page.getByText("풀이.jpg", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("클리닉 링크는 해당 차시의 정확한 과제를 바로 선택한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApi(page);
  await page.goto(
    `${BASE}/student/submit/assignment?sessionId=${SESSION_ID}&homeworkId=502`,
    { waitUntil: "domcontentloaded", timeout: 45_000 },
  );

  await expect(page.getByText("제출 대상", { exact: true })).toBeVisible();
  await expect(page.locator('[class*="submitSummary"]')).toContainText("현재 차시 추가 과제");
  await expect(page.getByRole("button", { name: /현재 차시 추가 과제/ }))
    .toHaveAttribute("data-selected", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(1);
});

const assignmentReturnCases = [
  { otherSession: true, chooseBeforeExpand: false },
  { otherSession: false, chooseBeforeExpand: false },
  { otherSession: false, chooseBeforeExpand: true },
];
for (const width of [390, 1366]) {
  for (const { otherSession, chooseBeforeExpand } of assignmentReturnCases) {
    const timing = chooseBeforeExpand ? " 전체 제출을 열기 전에 과제를 선택해도" : "";
    test(`${width}px${timing} 전체 제출에서 돌아오면 ${otherSession ? "다른" : "같은"} 차시의 다른 과제 파일을 보관하고 링크 과제만 제출한다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const api = await installApi(page);
      const scoped = `${BASE}/student/submit/assignment?sessionId=${SESSION_ID}&homeworkId=501`;
      await page.goto(scoped, { waitUntil: "domcontentloaded" });

      const summary = page.locator('[class*="submitSummary"]');
      const picker = page.locator('input[type="file"]');
      const saved = page.getByText(/이 기기에 임시 보관했습니다/);
      const bTitle = otherSession ? "다른 차시 과제" : "현재 차시 추가 과제";
      const otherTarget = page.getByRole("button", { name: new RegExp(bTitle) });
      const expand = page.getByRole("link", { name: "전체 제출 대상 보기" });
      const origin = await page.evaluate(() => performance.timeOrigin);
      await expect(summary).toContainText("현재 차시 필수 과제");
      if (chooseBeforeExpand) {
        await otherTarget.click();
        await expect(summary).toContainText(bTitle);
      }
      await expand.click();
      await expect(page).toHaveURL(`${BASE}/student/submit/assignment`);
      await expect(expand).toHaveCount(0);
      if (!chooseBeforeExpand) await otherTarget.click();
      await expect(summary).toContainText(bTitle);
      await expect(picker).toBeEnabled();
      await picker.setInputFiles({
        name: "other-session.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("synthetic-other-session"),
      });
      await expect(saved).toBeVisible();

      await page.goBack();
      await expect(page).toHaveURL(scoped);
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
      if (otherSession) await expect(otherTarget).toHaveCount(0);
      else await expect(otherTarget).toHaveAttribute("data-selected", "false");
      await expect(page.getByText("other-session.jpg", { exact: true })).toHaveCount(0);
      await expect(summary).toContainText("현재 차시 필수 과제");
      expect(api.submissionTargets).toEqual([]);

      await expect(picker).toBeEnabled();
      await picker.setInputFiles({ name: "in-session.jpg", mimeType: "image/jpeg", buffer: Buffer.from("in-session") });
      await page.getByRole("button", { name: "파일 1개 제출하기" }).click();
      await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible();
      expect(api.submissionTargets).toEqual(["501"]);

      if (otherSession) await expand.click();
      await otherTarget.click();
      await expect(summary).toContainText(bTitle);
      await expect(page.getByText("other-session.jpg", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "파일 1개 제출하기" })).toBeEnabled();
      expect(api.submissionTargets).toEqual(["501"]);
    });
  }
}

test("전체 제출 대상으로 이동해도 진행 중인 과제의 결과를 같은 파일 목록에 표시한다", async ({ page }) => {
  let releaseUpload: () => void = () => {};
  const uploadResponse = new Promise<void>((resolve) => { releaseUpload = resolve; });
  const api = await installApi(page, () => uploadResponse);
  await page.goto(`${BASE}/student/submit/assignment?sessionId=${SESSION_ID}&homeworkId=501`, { waitUntil: "domcontentloaded" });
  const picker = page.locator('input[type="file"]');
  try {
    await expect(picker).toBeEnabled();
    await picker.setInputFiles({
      name: "active-assignment.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64"),
    });
    await page.getByRole("button", { name: "파일 1개 제출하기" }).click();
    await expect.poll(() => api.submissionTargets).toEqual(["501"]);
    const expand = page.getByRole("link", { name: "전체 제출 대상 보기" });
    await expand.click();
    await expect(page).toHaveURL(`${BASE}/student/submit/assignment`);
    await expect(expand).toHaveCount(0);
    await expect(page.getByRole("button", { name: "파일별로 제출 중…" })).toBeVisible();
    releaseUpload();
    await expect(page.getByRole("region", { name: "이미 제출한 파일" }).getByText("active-assignment.png", { exact: true }))
      .toBeVisible();
    expect(api.submissionTargets).toEqual(["501"]);
  } finally {
    releaseUpload();
  }
});

for (const device of [
  { name: "iPhone", viewport: { width: 390, height: 844 }, filename: "아이폰풀이.heic", mimeType: "image/heic" },
  { name: "Galaxy", viewport: { width: 360, height: 800 }, filename: "갤럭시풀이.jpg", mimeType: "image/jpeg" },
] as const) {
  test(`${device.name} 클리닉 과제 링크에서 사진 제출 파일을 선택할 수 있다`, async ({ page }) => {
    await page.setViewportSize(device.viewport);
    await installApi(page);
    await page.goto(
      `${BASE}/student/submit/assignment?sessionId=${SESSION_ID}&homeworkId=502`,
      { waitUntil: "domcontentloaded", timeout: 45_000 },
    );

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute("accept", /\.heic/);
    await expect(fileInput).toHaveAttribute("accept", /\.mov/);
    await fileInput.setInputFiles({
      name: device.filename,
      mimeType: device.mimeType,
      buffer: Buffer.from("mobile-homework-photo"),
    });
    await expect(page.getByText(device.filename, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(1);
  });
}

test("교사 완료 과제는 원점수 없이도 완료로 표시되고 재제출 대상에서 제외된다", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await installApi(page);
  await page.goto(`${BASE}/student/grades`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  await page.getByRole("button", { name: /과제 현황/ }).click();
  await expect(page).toHaveURL(/\/student\/grades\?view=homework$/);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /과제 현황/ })).toHaveAttribute("aria-pressed", "true");
  const card = page.locator('[class*="homeworkCard"]').filter({
    hasText: "수업 중 교사 확인 과제",
  });
  await expect(card).toHaveCount(0);
  await page.getByRole("group", { name: "과제 상태 필터" }).getByRole("button", { name: "완료 1", exact: true }).click();
  await expect(card).toBeVisible();
  await expect(card).toContainText("–/100");
  await expect(card).toContainText("교사 확인 완료");
  await expect(page.getByRole("button", { name: /완료/ })).toContainText("1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

for (const width of [390, 1366]) {
  test(`성적 보드에서 같은 이름의 과제 중 선택한 행만 온라인 제출한다 ${width}px`, async ({ page }, testInfo) => {
    const base = {
      enrollment_id: 401, session_type: "REGULAR", lecture_active: true,
      session_id: SESSION_ID, session_title: "3차시", lecture_title: "고1 수학", title: "필수 연습",
      score: null, max_score: 100, passed: false, achievement: "NOT_SUBMITTED", submission_state: "needs_submission",
    };
    const homeworks = [
      { ...base, homework_id: 501 }, { ...base, homework_id: 502, session_id: 8811, session_title: "4차시" },
      { ...base, homework_id: 503, title: "보완 가능", achievement: "FAIL", score: 0 },
      { ...base, homework_id: 504, title: "제출 후 확인 중", submission_state: "awaiting_review" },
      { ...base, homework_id: 505, title: "보강 과제", session_type: "SUPPLEMENT" },
      { ...base, homework_id: 506, title: "확인 완료", passed: true, achievement: "PASS", submission_state: "reviewed", submission_media_locked: true },
      { ...base, homework_id: 507, title: "차시 없음", session_id: null },
      { ...base, homework_id: 508, title: "미인정 출결", learning_todo_eligible: false },
      { ...base, homework_id: 509, title: "종강 과제", lecture_active: false },
    ];
    await installApi(page, undefined, { homeworks });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/student/grades?view=homework&homework_status=all`);
    const card = (text: string) => page.locator('[class*="homeworkCard"]').filter({ hasText: text });
    await expect(card("보완 가능")).toContainText("0/100");
    await expect(card("보완 가능")).not.toContainText("미제출");
    await expect(card("3차시").filter({ hasText: "필수 연습" })).toContainText("미제출");
    const submit = card("필수 연습").filter({ hasText: "4차시" }).getByRole("link", { name: "온라인 제출" });
    await expect(submit).toHaveAttribute("href", "/student/submit/assignment?sessionId=8811&homeworkId=502");
    await expect(card("제출 후 확인 중").getByRole("link", { name: "제출 파일 확인·추가" })).toBeVisible();
    // Homework registration can remain open in a supplementary session or outside dashboard todos.
    for (const title of ["보강 과제", "미인정 출결", "보완 가능"]) {
      await expect(card(title).getByRole("link", { name: "온라인 제출" })).toBeVisible();
    }
    await page.getByText("종료된 강의 과제", { exact: true }).click();
    for (const title of ["확인 완료", "차시 없음", "종강 과제"]) {
      await expect(card(title)).toBeVisible();
      await expect(card(title).getByRole("link")).toHaveCount(0);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await submit.scrollIntoViewIfNeeded();
    await testInfo.attach(`student-grade-online-homework-${width}`, {
      body: await page.screenshot(), contentType: "image/png",
    });
    await submit.click();
    await expect(page).toHaveURL(/sessionId=8811&homeworkId=502$/);
    await expect(page.locator('[class*="submitSummary"]')).toContainText("필수 연습");
    await expect(page.getByRole("button", { name: /필수 연습/ })).toHaveAttribute("data-selected", "true");
    const camera = page.getByRole("button", { name: "사진 찍기", exact: true });
    await expect(camera).toBeEnabled();
    await camera.scrollIntoViewIfNeeded();
    await expect(camera).toBeInViewport();
    await testInfo.attach(`student-selected-homework-camera-${width}`, {
      body: await page.screenshot(), contentType: "image/png",
    });
    await page.reload();
    await expect(page.getByRole("button", { name: /필수 연습/ })).toHaveAttribute("data-selected", "true");
    await page.goto(`${BASE}/student/submit/assignment?sessionId=8811&homeworkId=501`);
    await expect(page.getByRole("button", { name: /필수 연습/ })).not.toHaveAttribute("data-selected", "true");
    await expect(page.locator('[class*="submitSummary"]')).toHaveCount(0);
  });
}

test("학부모 성적 보드는 선택한 자녀의 점수와 제출 상태를 읽기 전용으로 표시한다", async ({ page }) => {
  await installApi(page, undefined, { role: "parent", homeworks: [{
    homework_id: 501, enrollment_id: 401, session_id: SESSION_ID, title: "자녀 과제",
    session_title: "3차시", lecture_title: "고1 수학", score: 0, max_score: 100,
    achievement: "FAIL", passed: false, submission_state: "needs_submission",
  }] });
  await page.goto(`${BASE}/student/grades?view=homework`);
  const card = page.locator('[class*="homeworkCard"]').filter({ hasText: "자녀 과제" });
  await expect(card).toContainText("0/100");
  await expect(card.getByRole("link")).toHaveCount(0);
});
