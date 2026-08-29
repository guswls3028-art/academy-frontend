import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const LECTURE_ID = 9901;
const SESSION_ID = 9902;

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

type MockState = {
  attendanceOrderings: string[];
  attendanceStatuses: Record<number, string>;
  attendanceStatusUpdates: Array<{ id: number; status: string }>;
  bulkCreatePayloads: number[][];
  lectureEnrollmentPageSizes: string[];
  lectureEnrollmentPages: string[];
  bulkSetCalls: number;
  bulkUndoTokens: string[];
  failUndo: boolean;
};

type MockOptions = {
  omitTargetSessionFromList?: boolean;
  previousRosterWithInactive?: boolean;
  currentLectureWithInactive?: boolean;
  largeLectureEnrollmentRoster?: boolean;
};

async function installApi(page: Page, state: MockState, options: MockOptions = {}) {
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
    if (path === `/lectures/sessions/${SESSION_ID}/`) {
      return json({
        id: SESSION_ID,
        lecture: LECTURE_ID,
        title: "안전 검증 2차시",
        order: 2,
        regular_order: 2,
        session_type: "REGULAR",
        date: "2026-07-31",
      });
    }
    if (path === `/lectures/lectures/${LECTURE_ID}/`) {
      return json({ id: LECTURE_ID, title: "일괄 작업 안전반", color: "#2563eb", chip_label: "안전" });
    }
    if (path === "/lectures/sessions/") {
      return json({
        count: options.omitTargetSessionFromList ? 1 : 2,
        results: [
          { id: 9900, lecture: LECTURE_ID, title: "안전 검증 1차시", order: 1, regular_order: 1, session_type: "REGULAR", date: "2026-07-24" },
          ...(!options.omitTargetSessionFromList
            ? [{ id: SESSION_ID, lecture: LECTURE_ID, title: "안전 검증 2차시", order: 2, regular_order: 2, session_type: "REGULAR", date: "2026-07-31" }]
            : []),
        ],
      });
    }
    if (path === "/lectures/attendance/" && method === "GET") {
      const ordering = url.searchParams.get("ordering") || "name";
      state.attendanceOrderings.push(ordering);
      const rows = [
        { id: 501, status: state.attendanceStatuses[501] ?? "UNSET", name: "미입력학생", student_id: 1001, parent_phone: "01011112222", student_phone: "01033334444" },
        { id: 502, status: state.attendanceStatuses[502] ?? "ABSENT", name: "결석학생", student_id: 1002, parent_phone: "01055556666", student_phone: "01077778888" },
      ];
      if (ordering === "name") rows.reverse();
      return json({
        count: 2,
        page_size: Number(url.searchParams.get("page_size")) || 50,
        results: rows,
      });
    }
    const attendanceDetailMatch = path.match(/^\/lectures\/attendance\/(\d+)\/$/);
    if (attendanceDetailMatch && method === "PATCH") {
      const id = Number(attendanceDetailMatch[1]);
      const payload = request.postDataJSON() as { status?: string };
      if (payload.status) {
        state.attendanceStatuses[id] = payload.status;
        state.attendanceStatusUpdates.push({ id, status: payload.status });
      }
      return json({ id, status: state.attendanceStatuses[id] });
    }
    if (path === "/lectures/attendance/bulk_create/" && method === "POST") {
      const payload = request.postDataJSON() as { students: number[] };
      state.bulkCreatePayloads.push(payload.students);
      return json(payload.students.map((studentId, index) => ({
        id: 700 + index,
        student_id: studentId,
        session: SESSION_ID,
        status: "UNSET",
      })), 201);
    }
    if (path === "/lectures/attendance/bulk_set_present/" && method === "POST") {
      state.bulkSetCalls += 1;
      return json({
        updated: 2,
        session: SESSION_ID,
        undo_token: "signed-bulk-present-token",
        undo_expires_in: 600,
      });
    }
    if (path === "/lectures/attendance/bulk_undo_present/" && method === "POST") {
      const payload = request.postDataJSON() as { undo_token: string };
      state.bulkUndoTokens.push(payload.undo_token);
      if (state.failUndo) {
        return json({ detail: "일부 출결이 이미 변경되어 안전하게 되돌릴 수 없습니다. 현재 상태를 확인해 주세요." }, 409);
      }
      return json({ restored: 2, session: SESSION_ID });
    }
    if (path === "/enrollments/session-enrollments/") {
      if (options.previousRosterWithInactive && url.searchParams.get("session") === "9900") {
        return json([
          { id: 8101, session: 9900, enrollment: 3001, enrollment_status: "ACTIVE", student_id: 2001, student_name: "김가람", student_school: "한빛고", student_grade: 1 },
          { id: 8102, session: 9900, enrollment: 3002, enrollment_status: "INACTIVE", student_id: 2002, student_name: "이도윤", student_school: "한빛고", student_grade: 1 },
        ]);
      }
      return json([]);
    }
    if (path === "/enrollments/") {
      state.lectureEnrollmentPageSizes.push(url.searchParams.get("page_size") || "");
      state.lectureEnrollmentPages.push(url.searchParams.get("page") || "");
      if (options.largeLectureEnrollmentRoster) {
        const page = Number(url.searchParams.get("page") || "1");
        const start = page === 1 ? 1 : 501;
        const end = page === 1 ? 500 : 501;
        return json({
          count: 501,
          results: Array.from({ length: end - start + 1 }, (_, index) => {
            const studentId = 10_000 + start + index;
            return {
              id: 20_000 + start + index,
              status: "ACTIVE",
              student: { id: studentId, name: `대형명단${start + index}`, high_school: "한빛고", grade: 1 },
            };
          }),
        });
      }
      if (options.previousRosterWithInactive || options.currentLectureWithInactive) {
        return json({
          count: 2,
          results: [
            { id: 3001, status: "ACTIVE", student: { id: 2001, name: "김가람", high_school: "한빛고", grade: 1 } },
            { id: 3002, status: "INACTIVE", student: { id: 2002, name: "이도윤", high_school: "한빛고", grade: 1 } },
          ],
        });
      }
      return json([]);
    }
    if (path === "/students/") {
      return json({
        count: 2,
        page_size: 100,
        results: [
          {
            id: 2001,
            name: "김가람",
            ps_number: "SAFE001",
            omr_code: "00002001",
            student_phone: "01010002001",
            parent_phone: "01090002001",
            school: "한빛고",
            school_type: "HIGH",
            grade: 1,
            active: true,
            tags: [],
            enrollments: options.currentLectureWithInactive
              ? [{ id: 3001, lecture: LECTURE_ID, status: "ACTIVE", lecture_name: "일괄 작업 안전반" }]
              : [],
            custom_fields: {},
          },
          {
            id: 2002,
            name: "이도윤",
            ps_number: "SAFE002",
            omr_code: "00002002",
            student_phone: "01010002002",
            parent_phone: "01090002002",
            school: "한빛고",
            school_type: "HIGH",
            grade: 1,
            active: true,
            tags: [],
            enrollments: options.currentLectureWithInactive
              ? [{ id: 3002, lecture: LECTURE_ID, status: "INACTIVE", lecture_name: "일괄 작업 안전반" }]
              : [],
            custom_fields: {},
          },
        ],
      });
    }
    if (path === "/lectures/sections/") return json([]);
    if (path === "/results/admin/clinic-targets/") return json([]);
    if (path === "/staffs/currently-working/") return json([]);
    return json({ count: 0, results: [] });
  });
}

async function openAttendance(page: Page, state: MockState, options: MockOptions = {}) {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "일괄 출결 route-mock 검증은 로컬 dev 서버 전용");
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page, state, options);
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/attendance`,
    { waitUntil: "domcontentloaded", timeout: 45_000 },
  );
  await expect(page.getByRole("button", { name: "수강생 등록" }).first()).toBeVisible();
}

function createState(overrides: Partial<MockState> = {}): MockState {
  return {
    attendanceOrderings: [],
    attendanceStatuses: { 501: "UNSET", 502: "ABSENT" },
    attendanceStatusUpdates: [],
    bulkCreatePayloads: [],
    lectureEnrollmentPageSizes: [],
    lectureEnrollmentPages: [],
    bulkSetCalls: 0,
    bulkUndoTokens: [],
    failUndo: false,
    ...overrides,
  };
}

test("차시 헤더 집계는 탭 이동에도 남고 공지는 커뮤니티로 튕기지 않는다", async ({ page }, testInfo) => {
  const state = createState();
  await openAttendance(page, state);

  const headerSummary = page.locator('[aria-label^="차시 출결 집계:"]');
  await expect(headerSummary).toContainText("총2");

  await page.getByRole("tab", { name: "공지·게시판" }).click();
  await expect(page).toHaveURL(new RegExp(
    `/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/notice\\?`,
  ));
  await expect(page).not.toHaveURL(/\/workspace\/community\/notice/);
  await expect(page.locator(".notice-tree--embedded")).toBeVisible();
  await expect(page.locator(".notice-tree__nav")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "공지사항" })).toBeVisible();
  await expect(headerSummary).toContainText("미입력1");
  await expect(headerSummary).toContainText("결석1");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('[aria-label^="차시 출결 집계:"]')).toBeVisible();
  await expect(page.locator(".notice-tree--embedded > .qna-inbox__list")).toBeVisible();
  await expect(page.locator(".notice-tree--embedded > .qna-inbox__thread")).toBeHidden();
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("session-notice-summary-390.png"), fullPage: true });
});

test("출석 명단은 이름 가나다순이 기본이고 계정별 정렬 선택을 새로고침 후에도 유지한다", async ({ page }) => {
  const state = createState();
  await openAttendance(page, state);

  const headerSummary = page.locator('[aria-label^="차시 출결 집계:"]');
  await expect(headerSummary).toContainText("총2");
  await expect(headerSummary).toContainText("미입력1");
  await expect(headerSummary).toContainText("결석1");

  const studentLinks = page.locator('tbody a[aria-label$=" 학생 상세 열기"]');
  await expect(studentLinks).toHaveCount(2);
  await expect(studentLinks.nth(0)).toHaveAttribute("aria-label", "결석학생 학생 상세 열기");
  await expect(page.getByRole("columnheader", { name: /이름/ })).toHaveAttribute("aria-sort", "ascending");
  await expect.poll(() => state.attendanceOrderings).toContain("name");

  await page.getByRole("columnheader", { name: /이름/ }).click();
  await expect(studentLinks.nth(0)).toHaveAttribute("aria-label", "미입력학생 학생 상세 열기");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("attendance:sort:hakwonplus:user:12"))).toBe("-name");
  await expect.poll(() => state.attendanceOrderings).toContain("-name");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "수강생 등록" }).first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /이름/ })).toHaveAttribute("aria-sort", "descending");
  await expect(studentLinks.nth(0)).toHaveAttribute("aria-label", "미입력학생 학생 상세 열기");
});

test("이전 상태순 설정은 이름순으로 복구하고 출결 저장 뒤에도 학생 행을 고정한다", async ({ page }) => {
  const state = createState();
  await page.addInitScript(() => {
    localStorage.setItem("attendance:sort:hakwonplus:user:12", "status");
  });
  await openAttendance(page, state);

  const studentLinks = page.locator('tbody a[aria-label$=" 학생 상세 열기"]');
  await expect(studentLinks.nth(0)).toHaveAttribute("aria-label", "결석학생 학생 상세 열기");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("attendance:sort:hakwonplus:user:12"))).toBe("name");
  await expect(page.getByRole("columnheader", { name: /출결 상태/ })).not.toHaveAttribute("aria-sort");

  const quickRail = page.getByRole("group", { name: "결석학생 출결 빠른 선택" });
  await quickRail.getByRole("button", { name: "결석학생 지각 상태로 변경" }).click();
  await expect.poll(() => state.attendanceStatusUpdates).toEqual([{ id: 502, status: "LATE" }]);
  await expect(studentLinks.nth(0)).toHaveAttribute("aria-label", "결석학생 학생 상세 열기");
  await expect.poll(() => state.attendanceOrderings.at(-1)).toBe("name");
});

test("데스크톱은 모든 출결 상태를 한 줄에서 저장하고 모바일은 압축 선택기를 유지한다", async ({ page }, testInfo) => {
  const state = createState();
  await page.setViewportSize({ width: 1366, height: 850 });
  await openAttendance(page, state);

  const quickRail = page.getByRole("group", { name: "결석학생 출결 빠른 선택" });
  await expect(quickRail).toBeVisible();
  await expect(quickRail.getByRole("button")).toHaveCount(11);
  await expect(quickRail.getByRole("button", { name: "결석학생 결석 상태로 변경" })).toHaveAttribute("aria-pressed", "true");
  const inactivePresent = quickRail.getByRole("button", { name: "결석학생 현장 상태로 변경" });
  const inactiveOnline = quickRail.getByRole("button", { name: "결석학생 영상 상태로 변경" });
  const inactiveBackgrounds = await Promise.all([inactivePresent, inactiveOnline].map((button) => (
    button.locator(".ds-status-badge").evaluate((node) => getComputedStyle(node).backgroundColor)
  )));
  expect(inactiveBackgrounds[0]).toBe(inactiveBackgrounds[1]);
  await expect(quickRail.getByRole("button", { name: "결석학생 부재 상태로 변경" })).toHaveAttribute("data-critical", "true");
  await expect(quickRail.getByRole("button", { name: "결석학생 퇴원 상태로 변경" })).toHaveAttribute("data-critical", "true");
  await expect.poll(async () => (await quickRail.boundingBox())?.width ?? 0).toBeGreaterThan(500);
  const optionWidths = await quickRail.getByRole("button").evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().width),
  );
  expect(Math.max(...optionWidths) - Math.min(...optionWidths)).toBeLessThanOrEqual(1);
  const badgeWidths = await quickRail.locator(".ds-status-badge").evaluateAll((badges) =>
    badges.map((badge) => badge.getBoundingClientRect().width),
  );
  expect(Math.max(...badgeWidths) - Math.min(...badgeWidths)).toBeLessThanOrEqual(1);

  await quickRail.getByRole("button", { name: "결석학생 지각 상태로 변경" }).click();
  await expect.poll(() => state.attendanceStatusUpdates).toEqual([{ id: 502, status: "LATE" }]);
  await expect(quickRail.getByRole("button", { name: "결석학생 지각 상태로 변경" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[aria-label^="차시 출결 집계:"]')).toContainText("지각1");
  await page.screenshot({ path: testInfo.outputPath("attendance-inline-status-1366.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("group", { name: "결석학생 출결 빠른 선택" })).toHaveCount(0);
  const compactTrigger = page.getByRole("button", { name: "결석학생 출결 상태 변경" });
  await expect(compactTrigger).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await compactTrigger.click();
  await expect(page.locator(".attendance-popover").getByRole("button")).toHaveCount(11);
  await page.screenshot({ path: testInfo.outputPath("attendance-compact-status-390.png"), fullPage: true });
});

test("차시 수강생은 선택 목록에서 undo/redo와 최종 확인 후 미입력으로 등록한다", async ({ page }) => {
  const state = createState();
  await openAttendance(page, state);
  await expect(page.getByRole("columnheader", { name: "등원 예정" })).toHaveCount(0);

  await page.getByRole("button", { name: "수강생 등록" }).first().click();
  await expect(page.getByText("차시 수강생 등록", { exact: true })).toBeVisible();
  await expect(page.getByLabel("등록 후 출결 시작 상태")).toContainText("등록 후 출결: 미입력");

  await page.getByRole("checkbox", { name: "김가람 선택" }).check();
  await page.getByRole("checkbox", { name: "이도윤 선택" }).check();
  await expect(page.getByText("2명 선택됨", { exact: true }).last()).toBeVisible();

  await page.getByRole("button", { name: "선택 되돌리기" }).click();
  await expect(page.getByText("1명 선택됨", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "선택 다시 실행" }).click();
  await expect(page.getByText("2명 선택됨", { exact: true }).last()).toBeVisible();

  const reviewAndRegister = page.getByRole("button", { name: "2명 검토 후 등록" });
  await expect(reviewAndRegister).toBeEnabled();
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "2명 검토 후 등록");
    if (!button) throw new Error("수강등록 검토 버튼을 찾지 못했습니다.");
    button.click();
  });
  const confirmation = page.getByRole("alertdialog", { name: "차시 수강생으로 등록할까요?" });
  await expect(confirmation).toHaveCount(1);
  await expect(confirmation.getByText("김가람, 이도윤", { exact: true })).toBeVisible();
  await expect(confirmation.getByText("미입력", { exact: true })).toBeVisible();
  await expect(confirmation).toContainText("자동 수납 항목이 배정될 수 있습니다");
  await expect(confirmation.getByRole("button", { name: "취소" })).toBeVisible();
  expect(state.bulkCreatePayloads).toHaveLength(0);
  await confirmation.getByRole("button", { name: "2명 등록", exact: true }).click();

  await expect.poll(() => state.bulkCreatePayloads).toEqual([[2001, 2002]]);
  await expect(page.getByText("차시 수강생 등록", { exact: true })).toHaveCount(0);
});

test("직전 차시 불러오기는 현재 활성 수강생만 등록 대상으로 가져온다", async ({ page }) => {
  const state = createState();
  await openAttendance(page, state, { previousRosterWithInactive: true });

  await page.getByRole("button", { name: "수강생 등록" }).first().click();
  await page.getByRole("button", { name: "직전 차시 불러오기" }).click();

  await expect(page.getByText("1명 선택됨", { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/현재 비활성·대기 수강생 1명은 제외/)).toBeVisible();
  expect(state.lectureEnrollmentPageSizes).toHaveLength(0);

  await page.getByRole("button", { name: "1명 검토 후 등록" }).click();
  const confirmation = page.getByRole("alertdialog", { name: "차시 수강생으로 등록할까요?" });
  await expect(confirmation).toContainText("김가람");
  await expect(confirmation).not.toContainText("이도윤");
  await confirmation.getByRole("button", { name: "1명 등록", exact: true }).click();

  await expect.poll(() => state.bulkCreatePayloads).toEqual([[2001]]);
  await expect.poll(() => state.lectureEnrollmentPageSizes).toContain("500");
});

test("전체 학생 선택은 현재 강의의 비활성 수강 이력을 자동 제외한다", async ({ page }) => {
  const state = createState();
  await openAttendance(page, state, { currentLectureWithInactive: true });

  await page.getByRole("button", { name: "수강생 등록" }).first().click();

  await expect(page.getByRole("checkbox", { name: "김가람 선택" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "이도윤 선택" })).toHaveCount(0);
  await expect(page.getByText(/현재 강의의 비활성·대기 수강생 1명은 제외/)).toBeVisible();

  await page.getByRole("checkbox", { name: "김가람 선택" }).check();
  await page.getByRole("button", { name: "1명 검토 후 등록" }).click();
  await page.getByRole("alertdialog", { name: "차시 수강생으로 등록할까요?" })
    .getByRole("button", { name: "1명 등록", exact: true })
    .click();

  await expect.poll(() => state.bulkCreatePayloads).toEqual([[2001]]);
});

test("선택 뒤 수강 상태가 바뀌어도 최종 확인 전에 비활성 학생을 다시 제외한다", async ({ page }) => {
  const state = createState();
  await openAttendance(page, state, { previousRosterWithInactive: true });

  await page.getByRole("button", { name: "수강생 등록" }).first().click();
  await page.getByRole("checkbox", { name: "김가람 선택" }).check();
  await page.getByRole("checkbox", { name: "이도윤 선택" }).check();
  await page.getByRole("button", { name: "2명 검토 후 등록" }).click();

  await expect(page.getByText(/현재 강의의 비활성·대기 수강생 1명은 제외/)).toBeVisible();
  const confirmation = page.getByRole("alertdialog", { name: "차시 수강생으로 등록할까요?" });
  await expect(confirmation).toContainText("등록 인원1명");
  await expect(confirmation).toContainText("김가람");
  await expect(confirmation).not.toContainText("이도윤");
  await confirmation.getByRole("button", { name: "1명 등록", exact: true }).click();

  await expect.poll(() => state.bulkCreatePayloads).toEqual([[2001]]);
});

test("강의 활성 수강생 500명 초과도 다음 페이지까지 모두 불러온다", async ({ page }) => {
  const state = createState();
  await openAttendance(page, state, { largeLectureEnrollmentRoster: true });

  await page.getByRole("button", { name: "수강생 등록" }).first().click();
  await page.getByRole("button", { name: "강의 수강생 가져오기" }).click();

  await expect(page.getByText("501명 선택됨", { exact: true }).last()).toBeVisible();
  expect(state.lectureEnrollmentPages).toEqual(["1", "2"]);
});

test("대상 차시를 확인할 수 없으면 단축키로도 수강등록 확인을 우회하지 못한다", async ({ page }) => {
  const state = createState();
  await openAttendance(page, state, { omitTargetSessionFromList: true });

  await page.getByRole("button", { name: "수강생 등록" }).first().click();
  await page.getByRole("checkbox", { name: "김가람 선택" }).check();
  await expect(page.getByRole("button", { name: "1명 검토 후 등록" })).toBeDisabled();

  await page.locator("body").press("Control+Enter");
  await expect(page.getByRole("alertdialog", { name: "차시 수강생으로 등록할까요?" })).toHaveCount(0);
  expect(state.bulkCreatePayloads).toHaveLength(0);
});

test("전체 현장 출석은 최근 작업 기록에서 서명 토큰으로 되돌린다", async ({ page }) => {
  const state = createState();
  await openAttendance(page, state);

  await page.getByRole("button", { name: "전체 현장 출석" }).click();
  await expect(page.getByText("퇴원·비활성 학생은 변경하지 않습니다.")).toBeVisible();
  await page.getByRole("button", { name: "전체 현장 적용", exact: true }).click();

  await expect.poll(() => state.bulkSetCalls).toBe(1);
  const record = page.getByRole("region", { name: "최근 일괄 출결 작업" });
  await expect(record).toContainText("전체 현장 출석 적용됨");
  await expect(record).toContainText("2명의 기존 상태");
  await record.getByRole("button", { name: "되돌리기" }).click();

  await expect.poll(() => state.bulkUndoTokens).toEqual(["signed-bulk-present-token"]);
  await expect(record).toHaveCount(0);
});

test("일괄 출결 이후 충돌하면 기록을 유지하고 일부 복구처럼 보이지 않는다", async ({ page }) => {
  const state = createState({ failUndo: true });
  await openAttendance(page, state);

  await page.getByRole("button", { name: "전체 현장 출석" }).click();
  await page.getByRole("button", { name: "전체 현장 적용", exact: true }).click();
  const record = page.getByRole("region", { name: "최근 일괄 출결 작업" });
  await expect(record).toBeVisible();
  await record.getByRole("button", { name: "되돌리기" }).click();

  await expect.poll(() => state.bulkUndoTokens).toHaveLength(1);
  await expect(record).toBeVisible();
  await expect(page.getByText("일부 출결이 이미 변경되어 안전하게 되돌릴 수 없습니다. 현재 상태를 확인해 주세요.")).toBeVisible();
});

test("수강생 검토 레일과 최근 작업은 1366·1100·390px에서 접근 가능하다", async ({ page }) => {
  const state = createState();
  for (const viewport of [
    { width: 1366, height: 850 },
    { width: 1100, height: 760 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openAttendance(page, state);
    await page.getByRole("button", { name: "수강생 등록" }).first().click();
    await expect(page.getByLabel("등록 후 출결 시작 상태")).toBeVisible();
    await expect(page.getByRole("button", { name: "0명 검토 후 등록" })).toBeVisible();
    await page.getByRole("button", { name: "취소", exact: true }).click();
  }
});
