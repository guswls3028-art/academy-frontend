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
      const expectedUpdatedAt = request.headers()["x-expected-updated-at"];
      if (!expectedUpdatedAt) {
        return json({ detail: "수정 기준 시각이 필요합니다." }, 428);
      }
      if (expectedUpdatedAt !== state.exam.updated_at) {
        return json({
          detail: "다른 화면에서 변경된 시험입니다.",
          code: "stale_resource",
          current_updated_at: state.exam.updated_at,
        }, 409);
      }
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

  await gradingGroup.getByRole("button", { name: /^OMR \+ 직접 채점/ }).click();
  await expect(page.getByLabel("앞쪽 선택형 문항 수")).toHaveValue("1");
  await expect(page.getByLabel("앞쪽 선택형 문항 수")).toBeDisabled();

  await page.getByLabel("합격 기준").fill("");
  await expect(page.getByRole("alert")).toContainText("합격 기준을 입력해 주세요.");
  await expect(page.getByRole("button", { name: "운영 설정 저장", exact: true })).toBeDisabled();
  await page.getByLabel("합격 기준").fill("80");

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

test("미저장 시험 설정은 탭 이동 전에 확인하고 동시 수정은 덮어쓰지 않는다", async ({ page }) => {
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

  await openExam(page, state);
  await page.getByLabel("합격 기준").fill("79");

  await page.getByRole("tab", { name: "채점·결과", exact: true }).click();
  const discardDialog = page.getByRole("alertdialog", { name: "저장하지 않은 설정이 있습니다" });
  await expect(discardDialog).toBeVisible();
  await discardDialog.getByRole("button", { name: "계속 편집", exact: true }).click();
  await expect(page.getByLabel("합격 기준")).toHaveValue("79");

  state.exam = { ...state.exam, pass_score: 75, updated_at: "2026-08-02T00:10:00Z" };
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("다른 화면에서 설정이 변경되었습니다");
  expect(state.examPatchPayloads).toHaveLength(0);

  await page.getByRole("tab", { name: "채점·결과", exact: true }).click();
  await page.getByRole("alertdialog", { name: "저장하지 않은 설정이 있습니다" })
    .getByRole("button", { name: "저장하지 않고 이동", exact: true })
    .click();
  await expect(page.getByRole("tab", { name: "채점·결과", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("브라우저가 종료되어도 같은 계정·같은 서버 버전의 시험 초안만 복구한다", async ({ page }, testInfo) => {
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

  await openExam(page, state);
  await page.getByLabel("합격 기준").fill("79");
  await expect.poll(() => page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) =>
      candidate.includes("assessment-policy-draft:v1:") && candidate.endsWith(":exam:9972"));
    if (!key) return null;
    const stored = JSON.parse(localStorage.getItem(key) ?? "null") as { form?: { passScore?: string } } | null;
    return stored?.form?.passScore ?? null;
  })).toBe("79");

  await page.reload({ waitUntil: "domcontentloaded" });
  const recovery = page.getByTestId("assessment-draft-recovery");
  await expect(recovery).toContainText("저장되지 않은 시험 설정이 있습니다");
  await page.screenshot({
    path: testInfo.outputPath("assessment-draft-recovery-1366.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("assessment-draft-recovery")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  await recovery.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("assessment-draft-recovery-390.png"),
    fullPage: true,
  });
  await recovery.getByRole("button", { name: "이어서 편집", exact: true }).click();
  await expect(page.getByLabel("합격 기준")).toHaveValue("79");
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();
  await expect.poll(() => state.examPatchPayloads.length).toBe(1);
  await expect.poll(() => page.evaluate(() =>
    Object.keys(localStorage).some((candidate) =>
      candidate.includes("assessment-policy-draft:v1:") && candidate.endsWith(":exam:9972")),
  )).toBe(false);

  await page.getByLabel("합격 기준").fill("78");
  await expect.poll(() => page.evaluate(() =>
    Object.keys(localStorage).some((candidate) =>
      candidate.includes("assessment-policy-draft:v1:") && candidate.endsWith(":exam:9972")),
  )).toBe(true);
  state.exam = { ...state.exam, pass_score: 77, updated_at: "2026-08-03T02:00:00Z" };
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("assessment-draft-recovery")).toHaveCount(0);
  await expect(page.getByLabel("합격 기준")).toHaveValue("77");

  await page.getByLabel("합격 기준").fill("76");
  await expect.poll(() => page.evaluate(() =>
    Object.keys(localStorage).some((candidate) =>
      candidate.includes("assessment-policy-draft:v1:") && candidate.endsWith(":exam:9972")),
  )).toBe(true);
  await page.getByLabel("합격 기준").fill("77");
  await expect.poll(() => page.evaluate(() =>
    Object.keys(localStorage).some((candidate) =>
      candidate.includes("assessment-policy-draft:v1:") && candidate.endsWith(":exam:9972")),
  )).toBe(false);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("assessment-draft-recovery")).toHaveCount(0);
});
