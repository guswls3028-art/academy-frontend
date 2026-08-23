import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";


const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function seed(page: Page) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "관리자 클리닉 route-mock 검증은 로컬 dev 서버 전용",
  );
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
}

test("여러 강의를 듣는 클리닉 대상자는 학생 한 행에 아바타와 강의 딱지를 모아 표시한다", async ({ page }, testInfo) => {
  await seed(page);
  const sessionDate = new Date();
  const date = [
    sessionDate.getFullYear(),
    String(sessionDate.getMonth() + 1).padStart(2, "0"),
    String(sessionDate.getDate()).padStart(2, "0"),
  ].join("-");

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({ tenantCode: "hakwonplus", display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true });
    }
    if (path === "/core/me/") {
      return json({ id: 12, username: "admin", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false });
    }
    if (path === "/clinic/sessions/" && method === "GET") {
      return json([{
        id: 7001,
        date,
        start_time: "17:00:00",
        duration_minutes: 60,
        location: "클리닉실",
        max_participants: 10,
        title: "중복 행 회귀 검증",
      }]);
    }
    if (path === "/results/admin/clinic-targets/" && method === "GET") {
      return json([
        {
          enrollment_id: 9101,
          student_id: 8101,
          student_name: "유현진",
          session_title: "A강의 진단",
          lecture_title: "A강의",
          lecture_color: "#2563eb",
          lecture_chip_label: "A",
          profile_photo_url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
          created_at: "2026-08-22T09:00:00+09:00",
        },
        {
          enrollment_id: 9102,
          student_id: 8101,
          student_name: "유현진",
          session_title: "B강의 진단",
          lecture_title: "B강의",
          lecture_color: "#16a34a",
          lecture_chip_label: "B",
          profile_photo_url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
          created_at: "2026-08-22T10:00:00+09:00",
        },
      ]);
    }
    if (path === "/clinic/participants/" && method === "GET") return json({ count: 0, next: null, previous: null, results: [] });
    if (path === "/lectures/sections/" || path === "/staffs/currently-working/") return json([]);
    if (path.startsWith("/community/") || path.startsWith("/student/notifications/")) return json({ count: 0, results: [] });
    return json({ count: 0, results: [] });
  });

  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/schedule`, { timeout: 45_000 });
  const sessionCard = page.getByRole("article").filter({ hasText: "중복 행 회귀 검증" });
  await expect(sessionCard).toBeVisible({ timeout: 30_000 });
  await sessionCard.getByRole("button", { name: "학생 추가", exact: true }).click();

  const targetGrid = page.getByRole("grid", { name: "미통과 대상자 명단" });
  const studentRows = targetGrid.locator("tbody tr").filter({ hasText: "유현진" });
  await expect(studentRows).toHaveCount(1);
  await expect(studentRows.locator(".student-name-chip__avatar img")).toHaveAttribute("src", /^data:image\/gif/);
  await expect(studentRows.locator("[data-lecture-chip]")).toHaveText(["A", "B"]);
  await studentRows.getByRole("checkbox", { name: "유현진 선택" }).check();
  await expect(page.locator(".clinic-target-select-modal__selected-count")).toHaveText("1명 선택됨");

  if (process.env.CAPTURE_CLINIC_TARGET === "1") {
    await page.screenshot({ path: testInfo.outputPath("clinic-target-student-row-1366.png") });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(sessionCard).toBeVisible({ timeout: 30_000 });
  await sessionCard.getByRole("button", { name: "학생 추가", exact: true }).click();
  await expect(studentRows).toHaveCount(1);
  await expect(studentRows.locator("[data-lecture-chip]")).toHaveText(["A", "B"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  if (process.env.CAPTURE_CLINIC_TARGET === "1") {
    await page.screenshot({ path: testInfo.outputPath("clinic-target-student-row-390.png") });
  }
});

test("미응시를 판정 대기로 구분하고 사유를 남겨 면제한 뒤 이력을 조회한다", async ({ page }, testInfo) => {
  await seed(page);
  const waiverPayloads: Array<Record<string, unknown>> = [];
  let waived = false;
  let failLectures = true;
  let failStudents = true;

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
      return json({ tenantCode: "hakwonplus", display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true });
    }
    if (path === "/core/me/") {
      return json({ id: 12, username: "admin", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false });
    }
    if (path === "/results/admin/clinic-targets/waive-missing/" && method === "POST") {
      waiverPayloads.push(request.postDataJSON() as Record<string, unknown>);
      waived = true;
      return json({ clinic_link_id: 881, resolution_type: "WAIVED" }, 201);
    }
    if (path === "/results/admin/clinic-targets/" && method === "GET") {
      if (waived && url.searchParams.get("include_resolved") !== "true") return json([]);
      return json([{
        enrollment_id: 901,
        student_id: 301,
        student_name: "결시 학생",
        session_title: "8월 2주차",
        reason: "missing",
        clinic_reason: "exam",
        exam_score: null,
        cutline_score: 60,
        meta_status: "NOT_SUBMITTED",
        clinic_link_id: waived ? 881 : null,
        resolution_type: waived ? "WAIVED" : null,
        resolved_at: waived ? "2026-08-20T10:00:00+09:00" : null,
        session_id: 701,
        lecture_id: 501,
        exam_id: 801,
        source_type: "exam",
        source_id: 801,
        source_title: "전자기유도 단원평가",
        lecture_title: "중3 과학",
        max_score: 100,
        latest_attempt_index: 0,
        attempt_history: [],
        created_at: "2026-08-19T21:00:00+09:00",
      }]);
    }
    if (path === "/clinic/participants/" && method === "GET") return json({ count: 0, next: null, previous: null, results: [] });
    if (path === "/lectures/lectures/" && method === "GET") {
      return failLectures ? json({ detail: "temporary" }, 503) : json([]);
    }
    if (path === "/students/" && method === "GET") {
      return failStudents ? json({ detail: "temporary" }, 503) : json({ count: 0, results: [] });
    }
    if (path === "/lectures/sections/" || path === "/staffs/currently-working/") return json([]);
    if (path.startsWith("/community/") || path.startsWith("/student/notifications/")) return json({ count: 0, results: [] });
    return json({ count: 0, results: [] });
  });

  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/bookings`, { timeout: 45_000 });

  await expect(page.getByText("판정 대기", { exact: true })).toBeVisible();
  await expect(page.getByText("미응시", { exact: true })).toBeVisible();
  await expect(page.getByText("전자기유도 단원평가", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "면제", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "클리닉 면제 처리" });
  await expect(dialog).toContainText("점수 합격과 구분해 면제로 기록");
  const submit = dialog.getByRole("button", { name: "사유 남기고 면제", exact: true });
  await expect(submit).toBeDisabled();
  await dialog.getByPlaceholder(/이전 수업 결석/).fill("이전 수업 결석으로 면제");
  await submit.click();

  await expect.poll(() => waiverPayloads).toEqual([{
    session_id: 701,
    enrollment_id: 901,
    exam_id: 801,
    memo: "이전 수업 결석으로 면제",
  }]);
  await expect(page.getByText("진행중 항목이 없습니다", { exact: true })).toBeVisible();

  await page.getByRole("checkbox", { name: "해결 완료 포함" }).check();
  await expect(page.getByText("전자기유도 단원평가", { exact: true })).toBeVisible();
  await expect(page.getByText("면제", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 640 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/schedule`, { timeout: 45_000 });
  const clinicForm = page.locator(".clinic-create--modal");
  const openClinicForm = page.getByRole("button", { name: "클리닉 만들기", exact: true });
  await expect(clinicForm.or(openClinicForm)).toBeVisible({ timeout: 30_000 });
  if (!(await clinicForm.isVisible())) {
    await openClinicForm.click({ timeout: 2_000 }).catch(async (error) => {
      if (!(await clinicForm.isVisible())) throw error;
    });
  }
  await expect(clinicForm).toBeVisible();
  await expect.poll(() => clinicForm.locator(".clinic-create__form").evaluate((element) => ({
    overflowY: getComputedStyle(element).overflowY,
    canScroll: element.scrollHeight > element.clientHeight,
  }))).toEqual({ overflowY: "auto", canScroll: true });
  const clinicCreateButton = clinicForm.getByRole("button", { name: /^클리닉 만들기 \(정원/ });
  await expect(clinicCreateButton).toBeVisible();
  await expect.poll(async () => {
    const box = await clinicCreateButton.boundingBox();
    return box ? box.y + box.height <= 640 : false;
  }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("clinic-create-scroll-390x640.png") });

  await clinicForm.getByRole("button", { name: /대상 조건/ }).click();
  await expect(clinicForm.getByText("강의 목록을 불러오지 못했습니다.", { exact: true })).toBeVisible();
  await expect(clinicCreateButton).toBeDisabled();
  failLectures = false;
  await clinicForm.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(clinicForm.getByText("강의 목록을 불러오지 못했습니다.", { exact: true })).toHaveCount(0);
  await expect(clinicCreateButton).toBeEnabled();

  await clinicForm.getByRole("button", { name: "대상자 추가", exact: true }).click();
  const targetDialog = page.getByRole("dialog", { name: "대상자 선택" });
  await targetDialog.getByRole("button", { name: "전체 학생", exact: true }).click();
  await expect(targetDialog.getByText("대상자 명단을 불러오지 못했습니다", { exact: true })).toBeVisible();
  await expect(targetDialog.getByRole("button", { name: /^선택 확정/ })).toBeDisabled();
  failStudents = false;
  await targetDialog.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(targetDialog.getByText("표시할 대상이 없습니다.", { exact: true })).toBeVisible();
});

test("유효한 클리닉 링크가 있어도 미응시 시험은 면제만 허용한다", async ({ page }) => {
  await seed(page);

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({ tenantCode: "hakwonplus", display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true });
    }
    if (path === "/core/me/") {
      return json({ id: 12, username: "admin", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false });
    }
    if (path === "/results/admin/clinic-targets/" && method === "GET") {
      return json([{
        enrollment_id: 902,
        student_id: 302,
        student_name: "링크결시 학생",
        session_title: "8월 3주차",
        reason: "missing",
        clinic_reason: "exam",
        exam_score: null,
        cutline_score: 60,
        meta_status: "NOT_SUBMITTED",
        clinic_link_id: 882,
        resolution_type: null,
        resolved_at: null,
        session_id: 702,
        lecture_id: 502,
        exam_id: 802,
        source_type: "exam",
        source_id: 802,
        source_title: "미응시 확인 시험",
        lecture_title: "중2 수학",
        max_score: 100,
        latest_attempt_index: 0,
        attempt_history: [],
        created_at: "2026-08-22T21:00:00+09:00",
      }]);
    }
    if (path === "/clinic/participants/" && method === "GET") return json({ count: 0, next: null, previous: null, results: [] });
    if (path === "/lectures/sections/" || path === "/staffs/currently-working/") return json([]);
    if (path.startsWith("/community/") || path.startsWith("/student/notifications/")) return json({ count: 0, results: [] });
    return json({ count: 0, results: [] });
  });

  await gotoAndSettle(page, `${BASE}/workspace/clinic/bookings`, { timeout: 45_000 });

  const row = page.getByRole("row").filter({ hasText: "미응시 확인 시험" });
  await expect(row.getByRole("button", { name: "면제", exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "제출 확인·완료", exact: true })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "수동 통과", exact: true })).toHaveCount(0);
  await expect(row.getByRole("button", { name: /^통과/ })).toHaveCount(0);
  await expect(row.getByRole("spinbutton")).toHaveCount(0);
});

test("미제출 과제의 완료 식별자가 누락되거나 0이면 완료 버튼을 숨긴다", async ({ page }) => {
  await seed(page);
  const invalidTargets = [
    { label: "링크 누락", clinic_link_id: undefined, session_id: 711, enrollment_id: 911, source_id: 811 },
    { label: "링크 0", clinic_link_id: 0, session_id: 712, enrollment_id: 912, source_id: 812 },
    { label: "세션 누락", clinic_link_id: 893, session_id: undefined, enrollment_id: 913, source_id: 813 },
    { label: "세션 0", clinic_link_id: 894, session_id: 0, enrollment_id: 914, source_id: 814 },
    { label: "수강 누락", clinic_link_id: 895, session_id: 715, enrollment_id: undefined, source_id: 815 },
    { label: "수강 0", clinic_link_id: 896, session_id: 716, enrollment_id: 0, source_id: 816 },
    { label: "과제 누락", clinic_link_id: 897, session_id: 717, enrollment_id: 917, source_id: undefined },
    { label: "과제 0", clinic_link_id: 898, session_id: 718, enrollment_id: 918, source_id: 0 },
  ];

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({ tenantCode: "hakwonplus", display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true });
    }
    if (path === "/core/me/") {
      return json({ id: 12, username: "admin", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false });
    }
    if (path === "/results/admin/clinic-targets/" && method === "GET") {
      return json(invalidTargets.map((target, index) => ({
        enrollment_id: target.enrollment_id,
        student_id: 320 + index,
        student_name: `식별자 학생 ${index + 1}`,
        session_title: "8월 식별자 점검",
        reason: "missing",
        clinic_reason: "homework",
        homework_score: null,
        homework_cutline: 8,
        clinic_link_id: target.clinic_link_id,
        session_id: target.session_id,
        source_type: "homework",
        source_id: target.source_id,
        source_title: target.label,
        lecture_title: "중1 수학",
        max_score: 10,
        latest_attempt_index: 0,
        attempt_history: [],
        created_at: "2026-08-23T15:30:00+09:00",
      })));
    }
    if (path === "/clinic/participants/" && method === "GET") return json({ count: 0, next: null, previous: null, results: [] });
    if (path === "/lectures/sections/" || path === "/staffs/currently-working/") return json([]);
    if (path.startsWith("/community/") || path.startsWith("/student/notifications/")) return json({ count: 0, results: [] });
    return json({ count: 0, results: [] });
  });

  await gotoAndSettle(page, `${BASE}/workspace/clinic/bookings`, { timeout: 45_000 });

  for (const target of invalidTargets) {
    const row = page.getByRole("row").filter({ hasText: target.label });
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: "제출 확인·완료", exact: true })).toHaveCount(0);
  }
});

test("문자 등으로 제출한 무점수 과제를 사유와 함께 완료하고 재조회한다", async ({ page }) => {
  await seed(page);
  const resolutionPayloads: Array<Record<string, unknown>> = [];
  let resolved = false;
  let targetRequests = 0;
  let participantRequests = 0;

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
      return json({ tenantCode: "hakwonplus", display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true });
    }
    if (path === "/core/me/") {
      return json({ id: 12, username: "admin", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false });
    }
    if (path === "/results/admin/sessions/703/score-correction/" && method === "PATCH") {
      resolutionPayloads.push(request.postDataJSON() as Record<string, unknown>);
      resolved = true;
      return json({
        correction_status: "COMPLETED",
        correction_completed_at: "2026-08-23T16:40:00+09:00",
        correction_note: "문자 제출 확인",
        correction_updated_at: "2026-08-23T16:40:00+09:00",
        teacher_resolved: true,
      });
    }
    if (path === "/results/admin/clinic-targets/" && method === "GET") {
      targetRequests += 1;
      if (resolved && url.searchParams.get("include_resolved") !== "true") return json([]);
      return json([{
        enrollment_id: 903,
        student_id: 303,
        student_name: "문자제출 학생",
        session_title: "8월 4주차",
        reason: "score",
        clinic_reason: "homework",
        homework_score: null,
        homework_cutline: 8,
        clinic_link_id: 883,
        resolution_type: resolved ? "MANUAL_OVERRIDE" : null,
        resolved_at: resolved ? "2026-08-23T16:40:00+09:00" : null,
        session_id: 703,
        lecture_id: 503,
        exam_id: null,
        source_type: "homework",
        source_id: 803,
        source_title: "연산 숙제 12쪽",
        lecture_title: "중1 수학",
        max_score: 10,
        latest_attempt_index: 0,
        attempt_history: [],
        created_at: "2026-08-23T15:30:00+09:00",
      }]);
    }
    if (path === "/clinic/participants/" && method === "GET") {
      participantRequests += 1;
      return json({ count: 0, next: null, previous: null, results: [] });
    }
    if (path === "/lectures/sections/" || path === "/staffs/currently-working/") return json([]);
    if (path.startsWith("/community/") || path.startsWith("/student/notifications/")) return json({ count: 0, results: [] });
    return json({ count: 0, results: [] });
  });

  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/bookings`, { timeout: 45_000 });

  await expect(page.getByText("문자제출 학생", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "제출 확인·완료", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "제출 확인·완료", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "과제 제출 확인·완료" });
  await expect(dialog).toContainText("문자·사진·종이 등 사이트 밖으로 제출한 과제");
  const submit = dialog.getByRole("button", { name: "제출 확인하고 완료", exact: true });
  await expect(submit).toBeDisabled();
  await dialog.getByPlaceholder(/문자 제출/).fill("문");
  await expect(submit).toBeDisabled();
  await dialog.getByPlaceholder(/문자 제출/).fill("문자 제출 확인");
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect.poll(() => resolutionPayloads).toEqual([{
    enrollment_id: 903,
    source_type: "homework",
    source_id: 803,
    completed: true,
    note: "문자 제출 확인",
  }]);
  await expect.poll(() => targetRequests).toBeGreaterThan(1);
  await expect.poll(() => participantRequests).toBeGreaterThan(1);
  await expect(page.getByText("진행중 항목이 없습니다", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("진행중 항목이 없습니다", { exact: true })).toBeVisible();
  expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("과제 클리닉 대상은 개별 퍼센트 기준을 과제 점수로 한 번만 표시한다", async ({ page }) => {
  await seed(page);

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({ tenantCode: "hakwonplus", display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true });
    }
    if (path === "/core/me/") {
      return json({ id: 12, username: "admin", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false });
    }
    if (path === "/results/admin/clinic-targets/" && method === "GET") {
      return json([{
        enrollment_id: 902,
        student_id: 302,
        student_name: "과제 학생",
        session_title: "8월 3주차",
        reason: "score",
        clinic_reason: "homework",
        exam_score: null,
        cutline_score: null,
        homework_score: 10,
        homework_cutline: 14,
        homework_cutline_mode: "PERCENT",
        homework_cutline_value: 70,
        homework_round_unit_percent: 5,
        clinic_link_id: 882,
        session_id: 702,
        lecture_id: 502,
        exam_id: null,
        source_type: "homework",
        source_id: 802,
        source_title: "연산 복습",
        lecture_title: "중2 수학",
        max_score: 20,
        latest_attempt_index: 1,
        attempt_history: [{ attempt_index: 1, score: 10, max_score: 20, passed: false, at: "2026-08-20T10:00:00+09:00" }],
        created_at: "2026-08-20T10:00:00+09:00",
      }]);
    }
    if (path === "/clinic/participants/" && method === "GET") return json({ count: 0, next: null, previous: null, results: [] });
    if (path === "/lectures/sections/" || path === "/staffs/currently-working/") return json([]);
    if (path.startsWith("/community/") || path.startsWith("/student/notifications/")) return json({ count: 0, results: [] });
    return json({ count: 0, results: [] });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/bookings`, { timeout: 45_000 });

  await expect(page.getByText("연산 복습", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "10점", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "70%", exact: true })).toBeVisible();
  await expect(page.getByText(/시험 10/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "제출 확인·완료", exact: true })).toHaveCount(0);
  await expect(page.getByTitle("수동 통과")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});

test("클리닉 조회 실패를 빈 목록으로 숨기지 않고 재시도한다", async ({ page }) => {
  await seed(page);
  let failTargets = true;
  let failParticipants = true;

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({ tenantCode: "hakwonplus", display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true });
    }
    if (path === "/core/me/") {
      return json({ id: 12, username: "admin", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false });
    }
    if (path === "/results/admin/clinic-targets/" && method === "GET") {
      return failTargets ? json({ detail: "temporary" }, 503) : json([]);
    }
    if (path === "/clinic/participants/" && method === "GET") {
      return failParticipants ? json({ detail: "temporary" }, 503) : json({ count: 0, next: null, previous: null, results: [] });
    }
    if (path === "/lectures/sections/" || path === "/staffs/currently-working/") return json([]);
    if (path.startsWith("/community/") || path.startsWith("/student/notifications/")) return json({ count: 0, results: [] });
    return json({ count: 0, results: [] });
  });

  await gotoAndSettle(page, `${BASE}/workspace/clinic/bookings?focus=pending`, { timeout: 45_000 });

  const approvals = page.locator(".clinic-bookings__pending");
  const remediation = page.locator(".clinic-bookings-page__remediation");
  await expect(
    approvals.getByText("예약 신청을 불러오지 못했습니다", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    remediation.getByText("클리닉 대상자를 불러오지 못했습니다", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("모든 학생이 시험/과제를 통과했습니다.")).toHaveCount(0);

  failParticipants = false;
  await approvals.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(approvals.getByText("승인 대기 예약이 없습니다.", { exact: true })).toBeVisible();

  failTargets = false;
  await remediation.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(remediation.getByText("진행중 항목이 없습니다", { exact: true })).toBeVisible();
});

test("백그라운드에서 생긴 작업을 탭 복귀 시 즉시 다시 폴링한다", async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => {
    let visibility: DocumentVisibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    Object.defineProperty(window, "__setWorkerPollVisibility", {
      configurable: true,
      value: (next: DocumentVisibilityState) => {
        visibility = next;
        document.dispatchEvent(new Event("visibilitychange"));
      },
    });
  });
  let progressRequests = 0;

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({ tenantCode: "hakwonplus", display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true });
    }
    if (path === "/core/me/") {
      return json({ id: 12, username: "admin", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false });
    }
    if (path === "/jobs/hidden-excel/progress/") {
      progressRequests += 1;
      return json({
        job_id: "hidden-excel",
        job_type: "excel_parsing",
        status: "DONE",
        result: { created: 1, duplicates: [], restored: [], failed: [] },
      });
    }
    if (path === "/results/admin/clinic-targets/") return json([]);
    if (path === "/clinic/participants/") return json({ count: 0, next: null, previous: null, results: [] });
    if (path === "/lectures/sections/" || path === "/staffs/currently-working/") return json([]);
    if (path.startsWith("/community/") || path.startsWith("/student/notifications/")) return json({ count: 0, results: [] });
    return json({ count: 0, results: [] });
  });

  await gotoAndSettle(page, `${BASE}/workspace/clinic/bookings`, { timeout: 45_000 });
  await page.evaluate(async () => {
    const { asyncStatusStore } = await import("/src/shared/ui/asyncStatus/asyncStatusStore.ts");
    asyncStatusStore.addWorkerJob(
      "숨겨진 탭 학생 등록",
      "hidden-excel",
      "excel_parsing",
    );
  });

  await expect(
    page.waitForRequest(
      (request) => request.url().includes("/jobs/hidden-excel/progress/"),
      { timeout: 300 },
    ),
  ).rejects.toThrow();
  expect(progressRequests).toBe(0);
  await page.evaluate(() => {
    (window as typeof window & {
      __setWorkerPollVisibility: (next: DocumentVisibilityState) => void;
    }).__setWorkerPollVisibility("visible");
  });

  await expect.poll(() => progressRequests).toBeGreaterThan(0);
  await expect(page.getByText("학생 일괄 등록 — 신규 등록 1명", { exact: true })).toBeVisible();
});
