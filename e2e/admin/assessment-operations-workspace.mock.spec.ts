import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const LECTURE_ID = 9970;
const SESSION_ID = 9971;
const EXAM_ID = 9972;

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

type MockState = {
  exam: Record<string, unknown>;
  examPatchPayloads: Array<Record<string, unknown>>;
  selectedEnrollmentIds: number[];
};

const session = {
  id: SESSION_ID,
  lecture: LECTURE_ID,
  title: "3차시",
  display_label: "3차시",
  order: 3,
  regular_order: 3,
  session_type: "REGULAR",
  date: "2026-08-03",
  section: null,
};

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
        feature_flags: {},
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
    if (path === `/lectures/lectures/${LECTURE_ID}/`) {
      return json({
        id: LECTURE_ID,
        title: "고1 Hyper 정규반",
        name: "김준혁",
        subject: "수학",
        is_active: true,
      });
    }
    if (path === "/lectures/lectures/") {
      return json([{ id: LECTURE_ID, title: "고1 Hyper 정규반", is_active: true }]);
    }
    if (path === "/lectures/sessions/") return json([session]);
    if (path === `/lectures/sessions/${SESSION_ID}/`) return json(session);
    if (path === "/lectures/sections/") return json([]);
    if (path === `/results/admin/sessions/${SESSION_ID}/exams/`) {
      return json([{
        exam_id: EXAM_ID,
        title: state.exam.title,
        open_at: state.exam.open_at,
        close_at: state.exam.close_at,
        allow_retake: state.exam.allow_retake,
        max_attempts: state.exam.max_attempts,
      }]);
    }
    if (path === `/results/admin/sessions/${SESSION_ID}/exams/summary/`) {
      return json({
        exams: [{
          exam_id: EXAM_ID,
          title: state.exam.title,
          max_score: state.exam.max_score,
          participant_count: 0,
        }],
      });
    }
    if (path === "/homeworks/") return json({ count: 0, results: [] });
    if (path === `/exams/${EXAM_ID}/` && method === "PATCH") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.examPatchPayloads.push(payload);
      state.exam = { ...state.exam, ...payload, updated_at: "2026-08-03T01:00:00Z" };
      return json(state.exam);
    }
    if (path === `/exams/${EXAM_ID}/`) return json(state.exam);
    if (path === `/exams/${EXAM_ID}/questions/`) {
      return json([
        { id: 1, sheet: 1, number: 1, question_kind: "choice", score: 50 },
        { id: 2, sheet: 1, number: 2, question_kind: "essay", score: 50 },
      ]);
    }
    if (path === `/exams/${EXAM_ID}/assets/`) return json([]);
    if (path === `/exams/${EXAM_ID}/enrollments/` && method === "PUT") {
      const payload = request.postDataJSON() as { enrollment_ids?: number[] };
      state.selectedEnrollmentIds = payload.enrollment_ids ?? [];
      return json({ selected_count: state.selectedEnrollmentIds.length });
    }
    if (path === `/exams/${EXAM_ID}/enrollments/`) {
      const selected = new Set(state.selectedEnrollmentIds);
      return json({
        exam_id: EXAM_ID,
        session_id: SESSION_ID,
        items: [
          { enrollment_id: 601, student_name: "김민준", school: "한빛고", grade: 1, is_selected: selected.has(601) },
          { enrollment_id: 602, student_name: "이서윤", school: "한빛고", grade: 1, is_selected: selected.has(602) },
        ],
      });
    }
    if (path === "/staffs/currently-working/") return json([]);
    if (path === "/enrollments/" || path === "/enrollments/session-enrollments/") return json([]);
    return json({ count: 0, results: [] });
  });
}

async function openExam(page: Page, state: MockState) {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "평가 운영 워크스페이스 route-mock 검증은 로컬 dev 서버 전용");
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page, state);
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams?assessment=exam%3A${EXAM_ID}`,
    { waitUntil: "domcontentloaded", timeout: 45_000 },
  );
}

test("시험 준비 상태와 전체 운영 정책을 저장·재조회하고 모바일에서도 정돈된 순서를 유지한다", async ({ page }, testInfo) => {
  const state: MockState = {
    exam: {
      id: EXAM_ID,
      title: "중간 점검",
      description: "",
      subject: "",
      exam_type: "regular",
      is_active: true,
      allow_retake: false,
      max_attempts: 1,
      pass_score: 80,
      max_score: 100,
      grading_mode: "choice",
      manual_grading_method: "score",
      choice_question_count: 0,
      segmentation_status: "ready",
      source_filename: "중간점검.pdf",
      display_order: 0,
      open_at: null,
      close_at: null,
      template_exam_id: null,
      structure_owner_id: EXAM_ID,
      can_edit_structure: true,
      answer_visibility: "hidden",
      created_at: "2026-08-02T00:00:00Z",
      updated_at: "2026-08-02T00:00:00Z",
    },
    examPatchPayloads: [],
    selectedEnrollmentIds: [601, 602],
  };

  await page.setViewportSize({ width: 1366, height: 900 });
  await openExam(page, state);

  await expect(page.getByText("시험 운영 준비", { exact: true })).toBeVisible();
  await expect(page.getByText("준비 완료", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /대상 학생: 2명 등록/ })).toBeVisible();
  await expect(page.getByText("시험 운영 설정", { exact: true })).toBeVisible();
  const gradingGroup = page.getByRole("group", { name: "시험 채점 방식" });
  await expect(gradingGroup.getByRole("button", { name: /^OMR 자동 채점/ })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: testInfo.outputPath("assessment-workspace-1366.png"),
    fullPage: true,
  });

  await gradingGroup.getByRole("button", { name: /^직접 정오 입력/ }).click();
  await page.getByLabel("응시 시작").fill("2026-08-03T09:00");
  await page.getByRole("textbox", { name: /^마감 비워/ }).fill("2026-08-03T22:00");
  await page.getByLabel("정답 공개").selectOption("after_closed");
  await page.getByLabel("재응시 허용").check();
  await page.getByLabel("최대 응시 횟수").fill("3");
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();

  await expect.poll(() => state.examPatchPayloads.length).toBe(1);
  expect(state.examPatchPayloads[0]).toMatchObject({
    grading_mode: "written",
    manual_grading_method: "correctness",
    allow_retake: true,
    max_attempts: 3,
    answer_visibility: "after_closed",
  });
  expect(state.examPatchPayloads[0].open_at).toEqual(expect.any(String));
  expect(state.examPatchPayloads[0].close_at).toEqual(expect.any(String));

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("group", { name: "시험 채점 방식" }).getByRole("button", { name: /^직접 정오 입력/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("재응시 허용")).toBeChecked();
  await expect(page.getByLabel("최대 응시 횟수")).toHaveValue("3");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("시험 운영 준비", { exact: true })).toBeVisible();
  await expect(page.getByText("시험 운영 설정", { exact: true })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("assessment-workspace-390.png"),
    fullPage: true,
  });
});
