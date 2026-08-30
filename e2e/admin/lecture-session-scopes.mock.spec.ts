import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const LECTURE_ID = 9951;
const REGULAR_SESSION_ID = 9952;
const SUPPLEMENT_SESSION_ID = 9953;
const SECTION_ID = 9954;
const SECOND_LECTURE_ID = 9955;
const SECOND_REGULAR_SESSION_ID = 9956;

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

type MockState = {
  regularOrder?: number;
  regularPatchPayloads?: Array<Record<string, unknown>>;
  supplementTitle: string;
  patchTitles: string[];
  sessionListFailures?: number;
  sessionListRequests?: number;
  sectionMode?: boolean;
  regularIncluded?: boolean;
  supplementIncluded?: boolean;
  createdSessionPayloads?: Array<Record<string, unknown>>;
  createdHomeworkPayloads?: Array<Record<string, unknown>>;
  createdExamPayloads?: Array<Record<string, unknown>>;
  examCreateDelayMs?: number;
  examSessionEnrollmentRows?: Array<Record<string, unknown>>;
  examSessionEnrollmentReads?: number;
  examEnrollmentPuts?: number[][];
  examEnrollmentUpdateDelayMs?: number;
  examPdfExtractDelayMs?: number;
  examPdfExtractRequests?: number;
  examRequestSequence?: string[];
  homeworkPatchPayloads?: Array<Record<string, unknown>>;
  homeworkAssignmentIds?: number[];
  homeworkAssignmentPuts?: number[][];
  homeworkAssignmentDelayMs?: number;
  createdVideoPayloads?: Array<Record<string, unknown>>;
};

function sessionRows(state: MockState, lectureId = LECTURE_ID) {
  if (lectureId === SECOND_LECTURE_ID) {
    return [{
      id: SECOND_REGULAR_SESSION_ID,
      lecture: SECOND_LECTURE_ID,
      title: "1차시",
      display_label: "1차시",
      order: 1,
      regular_order: state.regularOrder ?? 1,
      session_type: "REGULAR",
      date: "2026-08-03",
      section: null,
    }];
  }

  return [
    {
      id: REGULAR_SESSION_ID,
      lecture: LECTURE_ID,
      title: "1차시 (14:00~16:00)",
      display_label: `${state.regularOrder ?? 1}차시`,
      order: 1,
      regular_order: state.regularOrder ?? 1,
      session_type: "REGULAR",
      date: "2026-08-01",
      section: state.sectionMode ? SECTION_ID : null,
    },
    {
      id: SUPPLEMENT_SESSION_ID,
      lecture: LECTURE_ID,
      title: state.supplementTitle,
      display_label: state.supplementTitle,
      order: 2,
      regular_order: null,
      session_type: "SUPPLEMENT",
      date: "2026-08-02",
      section: state.sectionMode ? SECTION_ID : null,
    },
  ].filter((session) => (
    session.session_type === "REGULAR"
      ? state.regularIncluded !== false
      : state.supplementIncluded !== false
  ));
}

async function installApi(page: Page, state: MockState) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        isPlatformAdmin: true,
        display_name: "학원플러스",
        feature_flags: { section_mode: state.sectionMode ?? false },
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 12,
        username: "admin",
        name: "관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path === `/lectures/lectures/${LECTURE_ID}/` || path === `/lectures/lectures/${SECOND_LECTURE_ID}/`) {
      const lectureId = path.includes(`/${SECOND_LECTURE_ID}/`) ? SECOND_LECTURE_ID : LECTURE_ID;
      return json({
        id: lectureId,
        title: lectureId === LECTURE_ID ? "고1 Hyper 정규반" : "고2 Hyper 정규반",
        name: "김준혁",
        subject: "수학",
        start_date: "2026-08-01",
        end_date: "2026-09-30",
        lecture_time: "토 14:00~16:00",
      });
    }
    if (path === "/lectures/sessions/" && method === "GET") {
      state.sessionListRequests = (state.sessionListRequests ?? 0) + 1;
      if ((state.sessionListFailures ?? 0) > 0) {
        state.sessionListFailures = (state.sessionListFailures ?? 0) - 1;
        return json({ detail: "일시적으로 수업 목록을 불러올 수 없습니다." }, 503);
      }
      const lectureId = Number(url.searchParams.get("lecture") || LECTURE_ID);
      return json(sessionRows(state, lectureId));
    }
    if (path === "/lectures/sessions/" && method === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.createdSessionPayloads ??= [];
      state.createdSessionPayloads.push(payload);
      return json({ id: 9991, ...payload }, 201);
    }
    if (path === `/lectures/sessions/${REGULAR_SESSION_ID}/` && method === "PATCH") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.regularPatchPayloads ??= [];
      state.regularPatchPayloads.push(payload);
      if (typeof payload.regular_order === "number") {
        state.regularOrder = payload.regular_order;
      }
      return json(sessionRows(state)[0]);
    }
    if (path === `/lectures/sessions/${REGULAR_SESSION_ID}/`) {
      return json(sessionRows(state)[0]);
    }
    if (path === `/lectures/sessions/${SUPPLEMENT_SESSION_ID}/` && method === "PATCH") {
      const payload = request.postDataJSON() as { title?: string };
      if (payload.title) {
        state.supplementTitle = payload.title;
        state.patchTitles.push(payload.title);
      }
      return json(sessionRows(state)[1]);
    }
    if (path === `/lectures/sessions/${SUPPLEMENT_SESSION_ID}/`) {
      return json(sessionRows(state)[1]);
    }
    if (path === "/lectures/sections/") {
      return json(state.sectionMode ? [{
        id: SECTION_ID,
        tenant: 1,
        lecture: LECTURE_ID,
        label: "A",
        section_type: "CLASS",
        section_type_display: "수업",
        day_of_week: 6,
        day_of_week_display: "토",
        start_time: "14:00:00",
        end_time: "16:00:00",
        location: "",
        max_capacity: null,
        is_active: true,
        assignment_count: 0,
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      }] : []);
    }
    if (path === "/enrollments/") return json([]);
    if (path === "/enrollments/session-enrollments/") {
      state.examSessionEnrollmentReads = (state.examSessionEnrollmentReads ?? 0) + 1;
      state.examRequestSequence?.push("auto-enroll-read");
      return json(state.examSessionEnrollmentRows ?? []);
    }
    if (path === "/lectures/attendance/matrix/") {
      const sessions = sessionRows(state);
      return json({
        lecture: { id: LECTURE_ID, title: "고1 Hyper 정규반", color: "#2563eb", chip_label: "Y" },
        sessions,
        students: [{
          student_id: 501,
          name: "김민준",
          phone: "01012345678",
          parent_phone: "01087654321",
          attendance: Object.fromEntries(sessions.map((session, index) => [
            String(session.id),
            { attendance_id: 700 + index, status: "PRESENT" },
          ])),
        }],
      });
    }
    if (path === "/homeworks/" && method === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.createdHomeworkPayloads ??= [];
      state.createdHomeworkPayloads.push(payload);
      const id = 9960 + state.createdHomeworkPayloads.length;
      return json({
        id,
        session: REGULAR_SESSION_ID,
        homework_type: "regular",
        title: payload.title,
        grading_mode: payload.grading_mode ?? "SCORE",
        max_score: payload.grading_mode === "COMPLETION" ? 1 : payload.max_score,
        cutline_mode: payload.grading_mode === "COMPLETION" ? "COUNT" : payload.cutline_mode,
        cutline_value: payload.grading_mode === "COMPLETION" ? 1 : payload.cutline_value,
        round_unit_percent: payload.grading_mode === "COMPLETION" ? 1 : payload.round_unit_percent,
        effective_cutline_mode: payload.grading_mode === "COMPLETION" ? "COUNT" : payload.cutline_mode,
        effective_cutline_value: payload.grading_mode === "COMPLETION" ? 1 : payload.cutline_value,
        effective_round_unit_percent: payload.grading_mode === "COMPLETION" ? 1 : payload.round_unit_percent,
        uses_session_cutline_default: false,
        meta: payload.meta ?? {},
        created_at: "2026-08-02T00:00:00Z",
        updated_at: "2026-08-02T00:00:00Z",
      });
    }
    if (path === "/exams/" && method === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.examRequestSequence?.push("create");
      state.createdExamPayloads ??= [];
      state.createdExamPayloads.push(payload);
      if ((state.examCreateDelayMs ?? 0) > 0) {
        await new Promise((resolve) => setTimeout(resolve, state.examCreateDelayMs));
      }
      return json({
        id: 9970 + state.createdExamPayloads.length,
        ...payload,
      }, 201);
    }
    if (/^\/exams\/\d+\/enrollments\/$/.test(path) && method === "PUT") {
      const payload = request.postDataJSON() as { enrollment_ids?: number[] };
      state.examRequestSequence?.push("auto-enroll");
      state.examEnrollmentPuts ??= [];
      state.examEnrollmentPuts.push(payload.enrollment_ids ?? []);
      if ((state.examEnrollmentUpdateDelayMs ?? 0) > 0) {
        await new Promise((resolve) => setTimeout(resolve, state.examEnrollmentUpdateDelayMs));
      }
      return json({ selected_count: payload.enrollment_ids?.length ?? 0 });
    }
    if (path === "/exams/pdf-extract/" && method === "POST") {
      state.examRequestSequence?.push("pdf-extract");
      state.examPdfExtractRequests = (state.examPdfExtractRequests ?? 0) + 1;
      if ((state.examPdfExtractDelayMs ?? 0) > 0) {
        await new Promise((resolve) => setTimeout(resolve, state.examPdfExtractDelayMs));
      }
      return json({ status: "queued" }, 202);
    }
    if (path === "/homeworks/" && method === "GET") {
      const rows = (state.createdHomeworkPayloads ?? []).map((payload, index) => ({
        id: 9961 + index,
        session: REGULAR_SESSION_ID,
        title: payload.title,
        grading_mode: payload.grading_mode ?? "SCORE",
        max_score: payload.grading_mode === "COMPLETION" ? 1 : payload.max_score,
        effective_cutline_mode: payload.effective_cutline_mode ?? payload.cutline_mode,
        effective_cutline_value: payload.effective_cutline_value ?? payload.cutline_value,
      }));
      return json({ count: rows.length, results: rows });
    }
    const homeworkDetailMatch = path.match(/^\/homeworks\/(\d+)\/$/);
    if (homeworkDetailMatch) {
      const id = Number(homeworkDetailMatch[1]);
      const index = id - 9961;
      const existing = state.createdHomeworkPayloads?.[index];
      if (!existing) return json({ detail: "과제를 찾을 수 없습니다." }, 404);
      if (method === "PATCH") {
        const payload = request.postDataJSON() as Record<string, unknown>;
        state.homeworkPatchPayloads ??= [];
        state.homeworkPatchPayloads.push({ id, ...payload });
        state.createdHomeworkPayloads![index] = { ...existing, ...payload };
      }
      const current = state.createdHomeworkPayloads![index];
      const usesSessionDefault = current.uses_session_cutline_default === true;
      return json({
        id,
        session: REGULAR_SESSION_ID,
        homework_type: "regular",
        title: current.title,
        grading_mode: current.grading_mode ?? "SCORE",
        max_score: current.grading_mode === "COMPLETION" ? 1 : current.max_score,
        cutline_mode: current.cutline_mode ?? null,
        cutline_value: current.cutline_value ?? null,
        round_unit_percent: current.round_unit_percent ?? null,
        effective_cutline_mode: current.effective_cutline_mode ?? current.cutline_mode,
        effective_cutline_value: current.effective_cutline_value ?? current.cutline_value,
        effective_round_unit_percent: current.effective_round_unit_percent ?? current.round_unit_percent ?? 5,
        uses_session_cutline_default: usesSessionDefault,
        meta: current.meta ?? {},
        created_at: "2026-08-02T00:00:00Z",
        updated_at: "2026-08-02T00:00:00Z",
      });
    }
    if (path === "/homework/assignments/" && method === "GET") {
      if ((state.homeworkAssignmentDelayMs ?? 0) > 0) {
        await new Promise((resolve) => setTimeout(resolve, state.homeworkAssignmentDelayMs));
      }
      const selected = new Set(state.homeworkAssignmentIds ?? []);
      return json({
        items: [
          { enrollment_id: 501, student_name: "김민준", school: "한빛고", grade: 1, is_selected: selected.has(501) },
          { enrollment_id: 502, student_name: "이서윤", school: "한빛고", grade: 1, is_selected: selected.has(502) },
          { enrollment_id: 503, student_name: "박지후", school: "새봄고", grade: 2, is_selected: selected.has(503) },
        ],
      });
    }
    if (path === "/homework/assignments/" && method === "PUT") {
      const payload = request.postDataJSON() as { enrollment_ids?: number[] };
      state.homeworkAssignmentIds = payload.enrollment_ids ?? [];
      state.homeworkAssignmentPuts ??= [];
      state.homeworkAssignmentPuts.push([...state.homeworkAssignmentIds]);
      return json({ selected_count: state.homeworkAssignmentIds.length });
    }
    if (path === "/lectures/attendance/") return json({ count: 0, results: [] });
    if (path === "/results/admin/clinic-targets/") return json([]);
    if (path === "/staffs/currently-working/") return json([]);
    if (path === "/media/videos/youtube/" && method === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.createdVideoPayloads ??= [];
      state.createdVideoPayloads.push(payload);
      return json({
        video: {
          id: 9981,
          ...payload,
          source_type: "youtube",
          status: "READY",
        },
      }, 201);
    }
    return json({ count: 0, results: [] });
  });
}

async function openLecture(page: Page, state: MockState) {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "강의 수업 구분 route-mock 검증은 로컬 dev 서버 전용");
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page, state);
  await page.goto(`${BASE}/workspace/lectures/${LECTURE_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await expect(page.getByRole("group", { name: "수업 보기 방식" })).toBeVisible();
}

test("출석 관리는 정규 차시만 기본 표시하고 보강·전체 범위를 전환한다", async ({ page }) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
  };
  await openLecture(page, state);

  const scope = page.getByRole("group", { name: "출석 차시 범위" });
  await expect(scope).toBeVisible();
  await expect(scope.getByRole("button", { name: "정규 1" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("columnheader", { name: "1차" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /토요일 심화 클리닉/ })).toHaveCount(0);

  await scope.getByRole("button", { name: "보강 1" }).click();
  await expect(page.getByRole("columnheader", { name: "1차" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: /토요일 심화 클리닉/ })).toBeVisible();

  await scope.getByRole("button", { name: "전체 2" }).click();
  await expect(page.getByRole("columnheader", { name: "1차" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /토요일 심화 클리닉/ })).toBeVisible();
  await expect(page.getByText("김민준", { exact: true }).locator("xpath=ancestor::tr[1]")).toContainText("현");
});

test("기존 전체 보기를 기본으로 유지하고 분리 보기에서 보강 이름을 수정·재조회한다", async ({ page }) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉 (10:00~12:00)",
    patchTitles: [],
  };
  await openLecture(page, state);

  const allView = page.getByRole("button", { name: "전체 보기", exact: true });
  const scopedView = page.getByRole("button", { name: "정규·보강 나눠 보기", exact: true });
  await expect(allView).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /1차시/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /토요일 심화 클리닉/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /정규 수업/ })).toHaveCount(0);

  await scopedView.focus();
  await page.keyboard.press("Enter");
  await expect(scopedView).toHaveAttribute("aria-pressed", "true");
  const regularTab = page.getByRole("tab", { name: /정규 수업/ });
  const supplementTab = page.getByRole("tab", { name: /^보강/ });
  await expect(regularTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /1차시/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /토요일 심화 클리닉/ })).toHaveCount(0);

  await supplementTab.click();
  await expect(supplementTab).toHaveAttribute("aria-selected", "true");
  const supplementCard = page.getByRole("button", { name: /토요일 심화 클리닉/ });
  await expect(supplementCard).toBeVisible();
  await expect(page.getByRole("button", { name: /1차시/ })).toHaveCount(0);

  await supplementCard.click();
  await expect(page).toHaveURL(new RegExp(`/workspace/lectures/${LECTURE_ID}/sessions/${SUPPLEMENT_SESSION_ID}/attendance`));
  await expect(page.getByRole("tab", { name: "공지·게시판", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "보강 설정" }).click();
  await page.getByRole("button", { name: "수정", exact: true }).click();
  await page.getByLabel("보강 이름").fill("일요일 취약 단원 클리닉");
  await page.getByRole("button", { name: "저장", exact: true }).click();

  await expect.poll(() => state.patchTitles).toEqual(["일요일 취약 단원 클리닉"]);
  const renamedSupplementCard = page.getByRole("button", { name: /일요일 취약 단원 클리닉/ });
  await expect(renamedSupplementCard).toBeVisible();
  await expect(renamedSupplementCard.locator(".session-block__title")).toHaveCSS("word-break", "keep-all");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "전체 보기", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /일요일 취약 단원 클리닉/ })).toBeVisible();

  await page.getByRole("button", { name: "정규·보강 나눠 보기", exact: true }).click();
  await expect(page.getByRole("tab", { name: /^보강/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /정규 수업/ }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace/lectures/${LECTURE_ID}/sessions/${REGULAR_SESSION_ID}/attendance`));

  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace/lectures/${LECTURE_ID}/sessions/${REGULAR_SESSION_ID}/attendance`));
  await expect(page.getByRole("button", { name: /일요일 취약 단원 클리닉/ })).toBeVisible();

  await page.getByRole("tab", { name: "공지·게시판", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `/workspace/lectures/${LECTURE_ID}/sessions/${REGULAR_SESSION_ID}/notice\\?scope=session&lectureId=${LECTURE_ID}&sessionId=${REGULAR_SESSION_ID}`,
    ),
  );
});

test("영상 추가 정책은 허용·금지를 표시하고 라벨 전체 클릭으로 전환된다", async ({ page }, testInfo) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
  };
  await page.setViewportSize({ width: 390, height: 844 });
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "영상 정책 route-mock 검증은 로컬 dev 서버 전용");
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page, state);
  await page.goto(`${BASE}/workspace/lectures/${LECTURE_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await expect(page.getByRole("group", { name: "수업 보기 방식" }))
    .toBeVisible({ timeout: 60_000 });
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${REGULAR_SESSION_ID}/videos`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );

  const addVideo = page.getByRole("button", { name: "영상 추가", exact: true }).first();
  await expect(addVideo).toBeVisible({ timeout: 60_000 });
  await addVideo.click();
  const dialog = page.getByRole("dialog").filter({ hasText: "영상 추가" });
  await expect(dialog).toBeVisible();

  const watermarkAllow = dialog.getByRole("switch", { name: "워터마크 허용" });
  const skipDeny = dialog.getByRole("switch", { name: "건너뛰기 금지" });
  await expect(watermarkAllow).toHaveAttribute("aria-checked", "true");
  await expect(watermarkAllow).toContainText("허용");
  await expect(skipDeny).toHaveAttribute("aria-checked", "false");
  await expect(skipDeny).toContainText("금지");

  await watermarkAllow.getByText("워터마크", { exact: true }).click();
  const watermarkDeny = dialog.getByRole("switch", { name: "워터마크 금지" });
  await expect(watermarkDeny).toHaveAttribute("aria-checked", "false");
  await expect(watermarkDeny).toContainText("금지");

  await skipDeny.getByText("건너뛰기", { exact: true }).click();
  const skipAllow = dialog.getByRole("switch", { name: "건너뛰기 허용" });
  await expect(skipAllow).toHaveAttribute("aria-checked", "true");
  await expect(skipAllow).toContainText("허용");

  await skipAllow.focus();
  await skipAllow.press("Space");
  const skipDenyByKeyboard = dialog.getByRole("switch", { name: "건너뛰기 금지" });
  await expect(skipDenyByKeyboard).toHaveAttribute("aria-checked", "false");
  await skipDenyByKeyboard.press("Enter");
  await expect(dialog.getByRole("switch", { name: "건너뛰기 허용" }))
    .toHaveAttribute("aria-checked", "true");

  const policyRowMetrics = await dialog.locator(".video-upload-modal__policy-row").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(policyRowMetrics.scrollWidth, JSON.stringify(policyRowMetrics))
    .toBeLessThanOrEqual(policyRowMetrics.clientWidth + 1);
  await page.screenshot({ path: testInfo.outputPath("video-policy-390.png"), fullPage: true });

  await dialog.getByRole("tab", { name: "YouTube 링크" }).click();
  await dialog.getByPlaceholder(/제목/).fill("정책 저장 확인 영상");
  await dialog.getByPlaceholder("https://youtu.be/...").fill("https://youtu.be/dQw4w9WgXcQ");
  await dialog.getByRole("button", { name: "링크 추가" }).click();

  await expect.poll(() => state.createdVideoPayloads?.length ?? 0).toBe(1);
  expect(state.createdVideoPayloads?.[0]).toMatchObject({
    session: REGULAR_SESSION_ID,
    title: "정책 저장 확인 영상",
    show_watermark: false,
    allow_skip: true,
    max_speed: 1,
  });
  await expect(dialog).toBeHidden();
});

test("정규 차시 번호를 수정하면 정확한 조사와 새 번호를 즉시 표시하고 재조회 후 유지한다", async ({ page }) => {
  const state: MockState = {
    regularOrder: 1,
    regularPatchPayloads: [],
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
  };
  await openLecture(page, state);

  await page.getByRole("button", { name: "차시 설정" }).click();
  await page.getByRole("button", { name: "수정", exact: true }).click();
  const orderInput = page.getByLabel("차시 번호");
  await expect(orderInput).toHaveValue("1");
  await orderInput.fill("5");
  await page.getByRole("button", { name: "저장", exact: true }).click();

  await expect.poll(() => state.regularPatchPayloads).toEqual([
    expect.objectContaining({ regular_order: 5 }),
  ]);
  await expect(page.getByText("차시가 수정되었습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /5차시/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /1차시/ })).toHaveCount(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /5차시/ })).toBeVisible();
});

test("보강 범위의 추가 버튼은 보강 유형과 이름 입력을 바로 연다", async ({ page }, testInfo) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
  };
  await page.setViewportSize({ width: 390, height: 640 });
  await openLecture(page, state);

  await page.getByRole("button", { name: "정규·보강 나눠 보기", exact: true }).click();
  await page.getByRole("tab", { name: /^보강/ }).click();
  await page.getByRole("button", { name: "보강 추가" }).click();

  await expect(page.getByLabel("보강 이름")).toHaveValue("보강");
  await expect(page.getByRole("button", { name: /보강 차시 · 날짜·시간 직접 선택/ })).toHaveAttribute("aria-pressed", "true");
  const startTime = page.getByRole("button", { name: "시작 시간 선택", exact: true });
  await startTime.click();
  const timeDialog = page.getByRole("dialog", { name: "시간 선택", exact: true });
  await expect(timeDialog.getByLabel("분 단위 직접 입력")).toBeVisible();
  await expect.poll(async () => {
    const box = await timeDialog.boundingBox();
    return box
      ? box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 640
      : false;
  }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("exact-minute-time-390x640.png") });
  await timeDialog.getByLabel("분 단위 직접 입력").fill("19:20");
  await timeDialog.getByRole("button", { name: "적용", exact: true }).click();
  await expect(startTime).toContainText("오후 7:20");
});

test("한 회차에서 만드는 여러 과제는 커트라인을 행마다 따로 저장한다", async ({ page }, testInfo) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
    createdHomeworkPayloads: [],
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await openLecture(page, state);
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${REGULAR_SESSION_ID}/assignments`,
    { waitUntil: "domcontentloaded" },
  );

  await page.getByRole("button", { name: "과제 추가", exact: true }).first().click();
  await page.getByText("처음부터 만들기", { exact: true }).click();
  await expect(page.getByText("1. 과제 제목부터 입력하세요", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "과제 만들기", exact: true })).toBeDisabled();
  await expect(page.getByText("제목을 입력하면 아래 과제 만들기 버튼이 활성화됩니다.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "점 (점수)", exact: true }).click();
  await page.getByLabel("과제 1 제목").fill("전자기유도");
  await expect(page.getByLabel("과제 1 제목")).toHaveValue("전자기유도");
  await page.getByLabel("과제 1 제목").fill("연산 복습");
  await page.getByLabel("과제 1 만점").fill("20");
  await page.getByLabel("과제 1 커트라인").fill("15");
  await page.getByRole("button", { name: "+ 추가", exact: true }).click();
  await page.getByLabel("과제 2 제목").fill("심화 서술형");
  await page.getByLabel("과제 2 만점").fill("30");
  await page.getByLabel("과제 2 커트라인").fill("24");
  await page.screenshot({
    path: testInfo.outputPath("homework-per-item-cutlines-390.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "2개 과제 만들기", exact: true }).click();

  await expect.poll(() => state.createdHomeworkPayloads?.length).toBe(2);
  expect(state.createdHomeworkPayloads).toEqual([
    expect.objectContaining({
      title: "연산 복습",
      max_score: 20,
      cutline_mode: "COUNT",
      cutline_value: 15,
    }),
    expect.objectContaining({
      title: "심화 서술형",
      max_score: 30,
      cutline_mode: "COUNT",
      cutline_value: 24,
    }),
  ]);
});

test("시험 빠른 생성은 잘못된 점수를 기본값으로 바꾸지 않고 처리 중 이탈을 잠근다", async ({ page }) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
    createdExamPayloads: [],
    examCreateDelayMs: 1_000,
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await openLecture(page, state);
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${REGULAR_SESSION_ID}/exams`,
    { waitUntil: "domcontentloaded" },
  );

  await page.getByRole("button", { name: "시험 추가", exact: true }).first().click();
  await page.getByText("빠르게 여러 개 만들기", { exact: true }).click();
  await page.getByLabel("시험 1 제목").fill("함수 단원평가");
  await page.getByLabel("시험 1 만점").fill("");
  await page.getByRole("button", { name: "1개 시험 만들기", exact: true }).click();
  await expect(page.getByText(/만점은 0보다 큰 숫자/)).toBeVisible();
  expect(state.createdExamPayloads).toHaveLength(0);

  await page.getByLabel("시험 1 만점").fill("50");
  await page.getByLabel("시험 1 커트라인").fill("60");
  await page.getByRole("button", { name: "1개 시험 만들기", exact: true }).click();
  await expect(page.getByText(/커트라인은 만점을 초과/)).toBeVisible();
  expect(state.createdExamPayloads).toHaveLength(0);

  await page.getByLabel("시험 1 커트라인").fill("30");
  await page.getByRole("button", { name: "1개 시험 만들기", exact: true }).click();
  await expect(page.getByRole("button", { name: "뒤로" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByText("처음부터 만들기", { exact: true })).toBeVisible();
  await expect.poll(() => state.createdExamPayloads?.length).toBe(1);
  await expect(page.getByText("처음부터 만들기", { exact: true })).toHaveCount(0);
  expect(state.createdExamPayloads?.[0]).toMatchObject({
    title: "함수 단원평가",
    max_score: 50,
    pass_score: 30,
  });
});

test("원본 없이 직접 채점 시험을 만들고 문항별 점수 입력을 선택한다", async ({ page }, testInfo) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
    createdExamPayloads: [],
    examSessionEnrollmentRows: [{
      id: 7701,
      session: REGULAR_SESSION_ID,
      enrollment: 501,
      enrollment_status: "ACTIVE",
      student_id: 8801,
      student_name: "김민준",
    }],
    examEnrollmentPuts: [],
    examCreateDelayMs: 500,
    examEnrollmentUpdateDelayMs: 500,
    examPdfExtractRequests: 0,
    examRequestSequence: [],
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await openLecture(page, state);
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${REGULAR_SESSION_ID}/exams`,
    { waitUntil: "domcontentloaded" },
  );

  const openCreate = page.getByRole("button", { name: "시험 추가", exact: true }).first();
  await expect(openCreate).toBeVisible({ timeout: 30_000 });
  await openCreate.click();
  await page.getByText(/시험지로 만들기|시험 설정해서 만들기/, { exact: true }).click();
  await expect.poll(() => state.examSessionEnrollmentReads).toBeGreaterThan(0);
  await page.getByLabel("시험명").fill("중2 서답형 단원평가");
  await page.getByRole("button", { name: /직접 채점/ }).first().click();
  await page.getByRole("button", { name: /점수 입력/ }).click();

  const dialog = page.getByRole("dialog").filter({ hasText: "시험 설정해서 만들기" });
  await expect(dialog.getByText(/시험 상세의 시험 자료 업로드/)).toBeVisible();
  await expect(
    dialog.locator(".modal-footer__side").getByText(/시험 상세에서 나중에 업로드/),
  ).toBeVisible();
  const workflowButtons = dialog.getByRole("group", { name: "채점 흐름" }).getByRole("button");
  const mobileButtonPositions = await workflowButtons.evaluateAll((buttons) => (
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { x: Math.round(box.x), y: Math.round(box.y) };
    })
  ));
  expect(new Set(mobileButtonPositions.map(({ x }) => x)).size).toBe(1);
  expect(mobileButtonPositions[0].y).toBeLessThan(mobileButtonPositions[1].y);
  expect(mobileButtonPositions[1].y).toBeLessThan(mobileButtonPositions[2].y);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("no-source-configured-create-390.png"),
    fullPage: true,
  });

  const submit = page.getByRole("button", {
    name: /^(시험 만들고 자료 올리기|시험 만들기)$/,
  });
  await expect(submit).toBeEnabled();
  state.examRequestSequence = [];
  await submit.evaluate((element) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  await expect.poll(() => state.examRequestSequence).toEqual(["create"]);
  await expect(dialog.getByRole("button", { name: "뒤로" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect.poll(() => state.examRequestSequence).toEqual([
    "create",
    "auto-enroll-read",
    "auto-enroll",
  ]);
  await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeDisabled();

  await expect.poll(() => state.createdExamPayloads?.length).toBe(1);
  await expect(dialog).toHaveCount(0);
  expect(state.createdExamPayloads?.[0]).toMatchObject({
    title: "중2 서답형 단원평가",
    grading_mode: "written",
    manual_grading_method: "score",
    choice_question_count: 0,
  });
  expect(state.examEnrollmentPuts).toEqual([[501]]);
  expect(state.examPdfExtractRequests).toBe(0);
  expect(state.examRequestSequence).toEqual([
    "create",
    "auto-enroll-read",
    "auto-enroll",
  ]);
});

test("원본을 선택하면 생성과 자동 등록 뒤 기존 업로드 순서를 유지한다", async ({ page }, testInfo) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
    createdExamPayloads: [],
    examSessionEnrollmentRows: [{
      id: 7701,
      session: REGULAR_SESSION_ID,
      enrollment: 501,
      enrollment_status: "ACTIVE",
      student_name: "김민준",
    }],
    examEnrollmentPuts: [],
    examCreateDelayMs: 100,
    examEnrollmentUpdateDelayMs: 100,
    examPdfExtractDelayMs: 500,
    examPdfExtractRequests: 0,
    examRequestSequence: [],
  };
  await openLecture(page, state);
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${REGULAR_SESSION_ID}/exams`,
    { waitUntil: "domcontentloaded" },
  );

  await page.getByRole("button", { name: "시험 추가", exact: true }).first().click();
  await page.getByText("시험 설정해서 만들기", { exact: true }).click();
  await expect.poll(() => state.examSessionEnrollmentReads).toBeGreaterThan(0);
  await page.getByLabel("시험명").fill("중2 서답형 원본 포함");
  await page.getByLabel("시험지 원본 (선택)").setInputFiles({
    name: "middle-written.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("source-present-regression"),
  });

  const dialog = page.getByRole("dialog").filter({ hasText: "시험 설정해서 만들기" });
  const desktopButtonPositions = await dialog
    .getByRole("group", { name: "채점 흐름" })
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => Math.round(button.getBoundingClientRect().y)));
  expect(new Set(desktopButtonPositions).size).toBe(1);
  await page.screenshot({
    path: testInfo.outputPath("source-present-configured-create-desktop.png"),
    fullPage: true,
  });

  state.examRequestSequence = [];
  await dialog.getByRole("button", { name: "시험 만들고 자료 올리기", exact: true }).click();
  await expect.poll(() => state.examRequestSequence).toEqual([
    "create",
    "auto-enroll-read",
    "auto-enroll",
    "pdf-extract",
  ]);
  await expect(dialog.getByRole("button", { name: "뒤로" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  await expect(dialog).toHaveCount(0);
  expect(state.createdExamPayloads).toHaveLength(1);
  expect(state.examEnrollmentPuts).toEqual([[501]]);
  expect(state.examPdfExtractRequests).toBe(1);
  expect(state.examRequestSequence).toEqual([
    "create",
    "auto-enroll-read",
    "auto-enroll",
    "pdf-extract",
  ]);
});

test("같은 차시에서도 과제마다 숫자 채점과 완료 체크를 선택한다", async ({ page }, testInfo) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
    createdHomeworkPayloads: [],
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await openLecture(page, state);
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${REGULAR_SESSION_ID}/assignments`,
    { waitUntil: "domcontentloaded" },
  );

  await page.getByRole("button", { name: "과제 추가", exact: true }).first().click();
  await page.getByText("처음부터 만들기", { exact: true }).click();
  await page.getByLabel("과제 1 제목").fill("연산 30제");
  await page.getByRole("button", { name: "+ 추가", exact: true }).click();
  await page.getByLabel("과제 2 제목").fill("교재 지참 확인");
  await page.getByRole("group", { name: "과제 2 채점 방식" })
    .getByRole("button", { name: "완료 체크" })
    .click();
  await expect(page.getByText("점수나 만점 없이 두 상태로만 검사합니다.")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 480 });
  const modalScrollBody = page.locator(".admin-modal__inner").filter({ hasText: "처음부터 만들기" }).locator(".modal-scroll-body");
  await expect.poll(() => modalScrollBody.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      overflowY: style.overflowY,
      canScroll: element.scrollHeight > element.clientHeight,
    };
  })).toEqual({ overflowY: "auto", canScroll: true });
  await page.getByRole("button", { name: "2개 과제 만들기", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "2개 과제 만들기", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator(".modal-footer__side").evaluate((element) => element.clientWidth)).toBeGreaterThan(240);
  await expect.poll(() => page.getByRole("button", { name: "2개 과제 만들기", exact: true }).evaluate(
    (element) => element.scrollWidth <= element.clientWidth,
  )).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("homework-grading-modes-390.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "2개 과제 만들기", exact: true }).click();

  await expect.poll(() => state.createdHomeworkPayloads?.length).toBe(2);
  expect(state.createdHomeworkPayloads?.[0]).toMatchObject({
    title: "연산 30제",
    grading_mode: "SCORE",
    max_score: 100,
  });
  expect(state.createdHomeworkPayloads?.[1]).toEqual(expect.objectContaining({
    title: "교재 지참 확인",
    grading_mode: "COMPLETION",
  }));
  expect(state.createdHomeworkPayloads?.[1]).not.toHaveProperty("max_score");
  expect(state.createdHomeworkPayloads?.[1]).not.toHaveProperty("cutline_value");
});

test("과제 운영 설정을 한곳에서 저장하고 선택 과제 카드에만 반영한다", async ({ page }, testInfo) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
    createdHomeworkPayloads: [
      {
        title: "연산 복습",
        max_score: 20,
        cutline_mode: "COUNT",
        cutline_value: 15,
        round_unit_percent: 5,
      },
      {
        title: "심화 서술형",
        max_score: 30,
        cutline_mode: "COUNT",
        cutline_value: 24,
        round_unit_percent: 5,
      },
    ],
    homeworkPatchPayloads: [],
  };
  await openLecture(page, state);
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${REGULAR_SESSION_ID}/assignments?assessment=homework%3A9961`,
    { waitUntil: "domcontentloaded" },
  );

  await expect(page.getByText("과제 운영 준비", { exact: true })).toBeVisible();
  await expect(page.getByText("과제 운영 설정", { exact: true })).toBeVisible();
  await expect(page.getByLabel("합격 기준 (점)")).toHaveValue("15");
  await page.locator('#assessment-policy input[type="date"]').fill("2026-08-09");
  await page.getByLabel("합격 기준 (점)").fill("17");
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();

  await expect.poll(() => state.homeworkPatchPayloads?.length).toBe(1);
  expect(state.homeworkPatchPayloads?.[0]).toMatchObject({
    id: 9961,
    cutline_mode: "COUNT",
    cutline_value: 17,
    round_unit_percent: 5,
    meta: expect.objectContaining({ due_date: "2026-08-09" }),
  });
  await expect(page.getByRole("button", { name: /연산 복습.*기준 17점/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /심화 서술형.*기준 24점/ })).toBeVisible();

  const primaryAction = page.getByTestId("assessment-primary-action");
  await expect(page.getByRole("navigation", { name: "과제 업무 흐름" })).toBeVisible();
  await expect(primaryAction).toHaveText("제출 현황 보기");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => primaryAction.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("homework-assessment-cta-390.png"),
    fullPage: true,
  });
  await primaryAction.click();
  await expect(page.getByRole("tab", { name: "제출관리", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(primaryAction).toHaveText("결과 보기");
});

test("차시 기본 기준 과제는 제목만 저장해도 상속을 유지하고 기한 없음은 준비 완료로 본다", async ({ page }) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
    createdHomeworkPayloads: [{
      title: "공통 연산 복습",
      max_score: 100,
      cutline_mode: null,
      cutline_value: null,
      round_unit_percent: null,
      effective_cutline_mode: "PERCENT",
      effective_cutline_value: 80,
      effective_round_unit_percent: 5,
      uses_session_cutline_default: true,
      meta: {},
    }],
    homeworkPatchPayloads: [],
  };
  await openLecture(page, state);
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${REGULAR_SESSION_ID}/assignments?assessment=homework%3A9961`,
    { waitUntil: "domcontentloaded" },
  );

  await expect(page.getByText("현재 차시 기본 기준을 사용 중입니다", { exact: true })).toBeVisible();
  const noDeadlineItem = page.getByRole("button", { name: /제출기한: 기한 없이 운영/ });
  await expect(noDeadlineItem).toBeVisible();
  await expect(noDeadlineItem.locator("..")).toHaveAttribute("data-state", "ready");

  await page.getByLabel("합격 기준 (%)").fill("");
  await expect(page.getByRole("alert")).toContainText("합격 기준을 입력해 주세요.");
  await expect(page.getByRole("button", { name: "운영 설정 저장", exact: true })).toBeDisabled();
  await page.getByLabel("합격 기준 (%)").fill("80");

  await page.getByRole("textbox", { name: "과제명", exact: true }).fill("공통 연산 복습 - 수정");
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();

  await expect.poll(() => state.homeworkPatchPayloads?.length).toBe(1);
  expect(state.homeworkPatchPayloads?.[0]).toEqual({ id: 9961, title: "공통 연산 복습 - 수정" });
  expect(state.createdHomeworkPayloads?.[0].uses_session_cutline_default).toBe(true);
});

test("과제 대상자 편집은 기존·추가·제외·최종 인원을 보여 주고 저장한다", async ({ page }) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
    createdHomeworkPayloads: [{
      title: "연산 복습",
      max_score: 20,
      cutline_mode: "COUNT",
      cutline_value: 15,
      round_unit_percent: 5,
      meta: { due_date: "2026-08-09" },
    }],
    homeworkAssignmentIds: [501, 502],
    homeworkAssignmentPuts: [],
    homeworkAssignmentDelayMs: 1_000,
  };
  await page.setViewportSize({ width: 1100, height: 800 });
  await openLecture(page, state);
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${REGULAR_SESSION_ID}/assignments?assessment=homework%3A9961`,
    { waitUntil: "domcontentloaded" },
  );

  await expect(
    page.getByRole("button", { name: /대상 학생: 2명 등록/ }),
  ).toBeVisible({ timeout: 30_000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "대상자 관리", exact: true }).click();

  const dialog = page.getByRole("dialog").filter({ hasText: "과제 대상 학생 관리" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("불러오는 중…", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("박지후 선택")).toBeVisible();
  await expect(dialog.getByText("기존").locator("..")).toContainText("2명");
  await expect(dialog.getByText("저장 후").locator("..")).toContainText("2명");

  await dialog.getByRole("button", { name: "박지후 이름으로 선택", exact: true }).click();
  await expect(
    dialog.getByRole("checkbox", { name: "박지후 선택", exact: true }),
  ).toBeChecked();
  await expect(dialog.getByText("추가").locator("..")).toContainText("+1");
  await expect(dialog.getByText("저장 후").locator("..")).toContainText("3명");
  const selectedNameButton = dialog.getByRole("button", {
    name: "박지후 이름으로 선택 해제",
    exact: true,
  });
  await selectedNameButton.focus();
  await expect(selectedNameButton).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await dialog.getByRole("button", { name: "3명으로 저장", exact: true }).click();

  await expect.poll(() => state.homeworkAssignmentPuts?.length).toBe(1);
  expect(state.homeworkAssignmentPuts?.[0]).toEqual([501, 502, 503]);
});

test("수업 목록 조회 실패는 기존 화면을 비우지 않고 다시 불러온다", async ({ page }) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
    sessionListFailures: 10,
  };
  await openLecture(page, state);

  const error = page.getByRole("alert");
  await expect(error).toContainText("수업 목록을 불러오지 못했습니다.");
  state.sessionListFailures = 0;
  await error.getByRole("button", { name: "다시 불러오기" }).click();

  await expect(page.getByRole("button", { name: /1차시/ })).toBeVisible();
  await expect.poll(() => state.sessionListRequests).toBeGreaterThanOrEqual(2);
});

test("반별 레인에서도 전체 보기와 정규·보강 분리 보기가 같은 목록을 안전하게 전환한다", async ({ page }) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
    sectionMode: true,
  };
  await openLecture(page, state);

  await expect(page.getByText("수업 A반")).toBeVisible();
  await expect(page.getByRole("button", { name: /1차시/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /토요일 심화 클리닉/ })).toBeVisible();

  await page.getByRole("button", { name: "정규·보강 나눠 보기", exact: true }).click();
  await expect(page.getByRole("button", { name: /1차시/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /토요일 심화 클리닉/ })).toHaveCount(0);
  await page.getByRole("tab", { name: /^보강/ }).click();
  await expect(page.getByRole("button", { name: /토요일 심화 클리닉/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /1차시/ })).toHaveCount(0);
});

test("보기 필터와 보강 이름은 1366·1100·390px에서 접근 가능하다", async ({ page }) => {
  const state: MockState = {
    supplementTitle: "보강 (17:00~19:00)",
    patchTitles: [],
  };

  for (const viewport of [
    { width: 1366, height: 850 },
    { width: 1100, height: 760 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openLecture(page, state);
    const supplementCard = page.getByRole("button", { name: /보강 \(17:00~19:00\)/ });
    await expect(supplementCard).toBeVisible();
    if (viewport.width === 390) {
      const clippedText = await supplementCard.evaluate((element) => (
        Array.from(element.querySelectorAll(".session-block__title, .session-block__desc"))
          .some((child) => child.scrollHeight > child.clientHeight)
      ));
      expect(clippedText).toBe(false);
    }
    await page.getByRole("button", { name: "정규·보강 나눠 보기", exact: true }).click();
    await page.getByRole("tab", { name: /^보강/ }).click();
    await expect(page.getByRole("button", { name: /보강 \(17:00~19:00\)/ })).toBeVisible();
  }
});

test("정규 수업이 없는 범위는 정규 유형이 선택된 추가 모달로 이어진다", async ({ page }) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
    regularIncluded: false,
    createdSessionPayloads: [],
  };
  await openLecture(page, state);

  await page.getByRole("button", { name: "정규·보강 나눠 보기", exact: true }).click();
  await expect(page.getByText("정규 수업이 아직 없습니다", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "정규 수업 추가", exact: true }).click();

  await expect(page.getByRole("button", { name: /정규 차시 추가/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", { name: "차시 생성 최종 확인" });
  await expect(confirmation.getByText("고1 Hyper 정규반", { exact: true })).toBeVisible();
  await expect(confirmation.getByText("정규 차시", { exact: true })).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "다시 확인" })).toBeFocused();
  expect(state.createdSessionPayloads).toHaveLength(0);
  await confirmation.getByRole("button", { name: "다시 확인" }).click();
  expect(state.createdSessionPayloads).toHaveLength(0);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("alertdialog", { name: "차시 생성 최종 확인" })
    .getByRole("button", { name: "확인하고 추가" })
    .click();
  await expect.poll(() => state.createdSessionPayloads).toHaveLength(1);
});

test("다른 강의로 SPA 이동하면 이전 강의의 분리 보기 상태를 이어받지 않는다", async ({ page }) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
  };
  await openLecture(page, state);

  await page.getByRole("button", { name: "정규·보강 나눠 보기", exact: true }).click();
  await page.getByRole("tab", { name: /^보강/ }).click();
  await expect(page.getByRole("tab", { name: /^보강/ })).toHaveAttribute("aria-selected", "true");

  await page.evaluate((lectureId) => {
    window.history.pushState({}, "", `/workspace/lectures/${lectureId}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, SECOND_LECTURE_ID);

  await expect(page).toHaveURL(new RegExp(`/workspace/lectures/${SECOND_LECTURE_ID}$`));
  await expect(page.getByRole("button", { name: "전체 보기", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("tab", { name: /정규 수업/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /1차시/ })).toBeVisible();
});
