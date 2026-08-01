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
  bulkCreatePayloads: number[][];
  bulkSetCalls: number;
  bulkUndoTokens: string[];
  failUndo: boolean;
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
        count: 2,
        results: [
          { id: 9900, lecture: LECTURE_ID, title: "안전 검증 1차시", order: 1, regular_order: 1, session_type: "REGULAR", date: "2026-07-24" },
          { id: SESSION_ID, lecture: LECTURE_ID, title: "안전 검증 2차시", order: 2, regular_order: 2, session_type: "REGULAR", date: "2026-07-31" },
        ],
      });
    }
    if (path === "/lectures/attendance/" && method === "GET") {
      const ordering = url.searchParams.get("ordering") || "name";
      state.attendanceOrderings.push(ordering);
      const rows = [
        { id: 501, status: "UNSET", name: "미입력학생", student_id: 1001, parent_phone: "01011112222", student_phone: "01033334444" },
        { id: 502, status: "ABSENT", name: "결석학생", student_id: 1002, parent_phone: "01055556666", student_phone: "01077778888" },
      ];
      if (ordering === "name") rows.reverse();
      return json({
        count: 2,
        page_size: Number(url.searchParams.get("page_size")) || 50,
        results: rows,
      });
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
    if (path === "/enrollments/session-enrollments/") return json([]);
    if (path === "/enrollments/") return json([]);
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
            enrollments: [],
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
            enrollments: [],
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

async function openAttendance(page: Page, state: MockState) {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "일괄 출결 route-mock 검증은 로컬 dev 서버 전용");
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page, state);
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/attendance`,
    { waitUntil: "domcontentloaded", timeout: 45_000 },
  );
  await expect(page.getByRole("button", { name: "수강생 등록" }).first()).toBeVisible();
}

function createState(overrides: Partial<MockState> = {}): MockState {
  return {
    attendanceOrderings: [],
    bulkCreatePayloads: [],
    bulkSetCalls: 0,
    bulkUndoTokens: [],
    failUndo: false,
    ...overrides,
  };
}

test("출석 명단은 이름 가나다순이 기본이고 계정별 정렬 선택을 새로고침 후에도 유지한다", async ({ page }) => {
  const state = createState();
  await openAttendance(page, state);

  const studentLinks = page.locator('tbody a[aria-label$=" 학생 상세 열기"]');
  await expect(studentLinks).toHaveCount(2);
  await expect(studentLinks.nth(0)).toHaveAttribute("aria-label", "결석학생 학생 상세 열기");
  await expect(page.getByRole("columnheader", { name: /이름/ })).toHaveAttribute("aria-sort", "ascending");
  await expect.poll(() => state.attendanceOrderings).toContain("name");

  await page.getByRole("columnheader", { name: /이름/ }).click();
  await expect(studentLinks.nth(0)).toHaveAttribute("aria-label", "미입력학생 학생 상세 열기");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("attendance:sort:u12"))).toBe("-name");
  await expect.poll(() => state.attendanceOrderings).toContain("-name");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "수강생 등록" }).first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /이름/ })).toHaveAttribute("aria-sort", "descending");
  await expect(studentLinks.nth(0)).toHaveAttribute("aria-label", "미입력학생 학생 상세 열기");
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

  await page.getByLabel("등록 후 출결 시작 상태").dispatchEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
  });
  await expect.poll(() => state.bulkCreatePayloads.length).toBe(0);

  await page.getByRole("button", { name: "2명 검토 후 등록" }).dispatchEvent("click");
  await expect(page.getByText("출결은 '미입력'으로 시작합니다.")).toBeVisible();
  expect(state.bulkCreatePayloads).toHaveLength(0);
  await page.getByRole("button", { name: "2명 등록", exact: true }).click();

  await expect.poll(() => state.bulkCreatePayloads).toEqual([[2001, 2002]]);
  await expect(page.getByText("차시 수강생 등록", { exact: true })).toHaveCount(0);
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
