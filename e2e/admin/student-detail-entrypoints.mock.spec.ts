import type { Page, Route } from "@playwright/test";
import ExcelJS from "exceljs";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

for (const width of [1366, 390]) {
  test(`학생 엑셀은 잘못된 연락처를 알리고 파일 교체 실패에서 복구한다 (${width}px)`, async ({ page }, testInfo) => {
    await installTenantOneInitScript(page);
    await page.addInitScript((jwt) => {
      localStorage.setItem("access", jwt);
      localStorage.setItem("refresh", `${jwt}-refresh`);
    }, localJwt());
    await installApi(page);
    await gotoAndSettle(page, `${BASE}/workspace/students/home`, { timeout: 45_000 });
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "학생 추가", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "엑셀 업로드", exact: true }).click();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("학생목록");
    sheet.addRows([
      [],
      ["이름", "학부모전화번호", "학생전화번호", "학교유형", "학년"],
      ["숫자연락처학생", 1077778888, 1099990000, "MIDDLE", 2],
      ["번호없는학생", "01077778888", "", "MIDDLE", 2],
      ["번호오타학생", "01077778888", "0101234567", "MIDDLE", 2],
      ["보호자누락학생", "", "01011113333", "MIDDLE", 2],
      ["보호자와같은번호학생", "01077778888", "01077778888", "MIDDLE", 2],
    ]);
    const file = { name: "student-import.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
    await dialog.locator('input[type="file"]').setInputFiles(file);
    await expect(dialog.getByText("입력 확인 필요 2명", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/5행 · 번호오타학생/)).toBeVisible();
    await expect(dialog.getByText(/6행 · 보호자누락학생/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "3명 등록 요청", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await dialog.getByText("입력 확인 필요 2명", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`student-import-${width}.png`), fullPage: true });
    await dialog.getByRole("button", { name: "3명 등록 요청", exact: true }).click();
    const confirmation = page.getByRole("alertdialog", { name: "학생 일괄 등록 최종 확인" });
    await expect(confirmation.getByText("2명 · 해당 행은 등록되지 않습니다", { exact: true })).toBeVisible();
    await expect(confirmation.getByRole("group", { name: "학생 초기 비밀번호" }).getByLabel("전화번호 뒤 4자리", { exact: true })).toBeDisabled();
    await confirmation.getByRole("button", { name: "다시 확인", exact: true }).click();
    await dialog.locator('input[type="file"]').setInputFiles({ ...file, name: "broken.xlsx", buffer: Buffer.from("not-an-xlsx") });
    await expect(dialog.getByRole("button", { name: "3명 등록 요청", exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("region", { name: "엑셀 파일 확인 결과" })).toHaveCount(0);
    await dialog.locator('input[type="file"]').setInputFiles(file);
    await expect(dialog.getByRole("button", { name: "3명 등록 요청", exact: true })).toBeEnabled();
  });
}

test.use({ serviceWorkers: "block" });

test("학생 엑셀 읽기 중 닫고 다시 열어도 이전 실패가 새 읽기를 해제하지 않는다", async ({ page }) => {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page);
  await gotoAndSettle(page, `${BASE}/workspace/students/home`, { timeout: 45_000 });
  await page.getByRole("button", { name: "학생 추가", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "엑셀 업로드", exact: true }).click();
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("학생목록").addRows([["이름", "학부모전화번호"], ["파일교체학생", "01077778888"]]);
  const file = { name: "slow.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    let rejectOld!: (reason: Error) => void;
    let releaseCurrent!: () => void;
    const oldRead = new Promise<ArrayBuffer>((_resolve, reject) => { rejectOld = reject; });
    const currentRead = new Promise<void>((resolve) => { releaseCurrent = resolve; });
    File.prototype.arrayBuffer = async function () {
      if (this.name === "slow.xlsx") return oldRead;
      if (this.name === "current.xlsx") await currentRead;
      return original.call(this);
    };
    Object.assign(window, {
      failOldExcelRead: async () => {
        rejectOld(new Error("취소한 파일의 지연 오류"));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      },
      releaseCurrentExcelRead: () => { releaseCurrent(); File.prototype.arrayBuffer = original; },
    });
  });
  await dialog.locator('input[type="file"]').setInputFiles(file);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "학생 추가", exact: true }).click();
  await dialog.getByRole("button", { name: "엑셀 업로드", exact: true }).click();
  await dialog.locator('input[type="file"]').setInputFiles({ ...file, name: "current.xlsx" });
  await expect(dialog.getByRole("button", { name: "엑셀 양식 다운로드", exact: true })).toBeDisabled();
  await page.evaluate(async () => {
    await (window as unknown as { failOldExcelRead: () => Promise<void> }).failOldExcelRead();
  });
  await expect(dialog.getByRole("button", { name: "엑셀 양식 다운로드", exact: true })).toBeDisabled();
  await expect(page.getByText("취소한 파일의 지연 오류", { exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { releaseCurrentExcelRead: () => void }).releaseCurrentExcelRead());
  await expect(dialog.getByText("current.xlsx", { exact: true })).toBeVisible();
  await expect(dialog.getByText("slow.xlsx", { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "1명 등록 요청", exact: true })).toBeEnabled();
});

function localJwt(): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function installApi(
  page: Page,
  onAccountGuidance?: (target: "student" | "parent") => void,
  onPasswordReset?: (payload: Record<string, unknown>) => void,
  onStudentUpdate?: (payload: Record<string, unknown>) => void,
  onStudentList?: (url: URL) => Record<string, unknown>,
  onAttendanceMatrix?: () => Record<string, unknown>,
) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const path = requestUrl.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204 });
    }
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
    if (path === "/lectures/sessions/428/") {
      return json({
        id: 428,
        lecture: 441,
        title: "1차시",
        order: 1,
        regular_order: 1,
        session_type: "REGULAR",
        date: "2026-07-21",
      });
    }
    if (path === "/lectures/lectures/441/") {
      return json({
        id: 441,
        title: "고1 Hyper 특강",
        color: "#2563eb",
        chip_label: "고특",
      });
    }
    if (path === "/lectures/sessions/") {
      return json({
        count: 1,
        results: [{
          id: 428,
          lecture: 441,
          title: "1차시",
          order: 1,
          regular_order: 1,
          session_type: "REGULAR",
          date: "2026-07-21",
        }],
      });
    }
    if (path === "/lectures/attendance/") {
      return json({
        count: 1,
        page_size: 50,
        results: [{
          id: 51,
          status: "PRESENT",
          name: "테스트학생",
          student_id: 1001,
          parent_phone: "01011112222",
          student_phone: "01033334444",
          lecture_title: "고1 Hyper 특강",
          lecture_color: "#2563eb",
          lecture_chip_label: "고특",
        }],
      });
    }
    if (path === "/lectures/attendance/matrix/" && onAttendanceMatrix) {
      return json(onAttendanceMatrix());
    }
    if (path === "/students/1001/") {
      const payload = request.method() === "PATCH"
        ? request.postDataJSON() as Record<string, unknown>
        : {};
      if (request.method() === "PATCH") onStudentUpdate?.(payload);
      return json({
        id: 1001,
        name: "테스트학생",
        ps_number: "S1001",
        phone: "01033334444",
        parent_phone: payload.parent_phone ?? "01011112222",
        is_managed: true,
        account_state: "ACTIVE",
        tags: [],
        enrollments: [],
      });
    }
    if (path === "/students/password_reset_send/") {
      onPasswordReset?.(request.postDataJSON() as Record<string, unknown>);
      return json({ message: "임시 비밀번호를 설정하고 알림톡을 발송했습니다." });
    }
    if (path === "/students/1001/account-notifications/") {
      if (request.method() === "POST") {
        const payload = request.postDataJSON() as { target: "student" | "parent" };
        onAccountGuidance?.(payload.target);
        return json({ message: "로그인 정보 알림톡을 발송했습니다. 안내된 아이디와 비밀번호로 로그인할 수 있습니다." });
      }
      return json({ results: [] });
    }
    if (path === "/students/1002/") {
      return json({
        id: 1002,
        name: "클리닉학생",
        is_managed: true,
        tags: [],
        enrollments: [],
      });
    }
    if (path === "/students/") {
      if (onStudentList) return json(onStudentList(requestUrl));
      return json({
        count: 1,
        results: [{
          id: 1002,
          name: "클리닉학생",
          is_managed: true,
          parent_phone: "01055556666",
          phone: "01077778888",
          school_type: "HIGH",
          high_school: "테스트고",
          grade: 2,
          enrollments: [],
        }],
      });
    }
    if (path === "/results/admin/clinic-targets/") {
      return json([{
        enrollment_id: 2002,
        student_id: 1002,
        student_name: "클리닉학생",
        session_title: "클리닉 진단",
        created_at: "2026-08-02T00:00:00Z",
      }]);
    }
    if (
      path === "/clinic/participants/" &&
      requestUrl.searchParams.get("student") === "1001"
    ) {
      return json({
        count: 1,
        results: [{
          id: 7001,
          session: 9001,
          student: 1001,
          student_name: "테스트학생",
          session_date: "2026-08-01",
          session_start_time: "09:00:00",
          session_location: "지하 1층",
          status: "booked",
          clinic_reason: "exam",
        }],
      });
    }
    if (path === "/staffs/currently-working/") {
      return json([]);
    }
    return json({ count: 0, results: [] });
  });
}

test("출결 상태 액션은 유지하고 학생 행은 학생 상세를 연다", async ({ page }) => {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  const guidanceTargets: string[] = [];
  await installApi(page, (target) => guidanceTargets.push(target));

  await gotoAndSettle(
    page,
    `${BASE}/workspace/lectures/441/sessions/428/attendance`,
    { timeout: 45_000 },
  );

  const studentLink = page.getByRole("link", {
    name: "테스트학생 학생 상세 열기",
  });
  await expect(studentLink).toBeVisible();

  const attendanceStatus = page.getByRole("group", {
    name: "테스트학생 출결 빠른 선택",
  });
  await attendanceStatus.getByRole("button", {
    name: "테스트학생 결석 상태로 변경",
  }).click();
  await expect(page).toHaveURL(/\/workspace\/lectures\/441\/sessions\/428\/attendance$/);
  await expect(page.getByTestId("student-detail-overlay")).toHaveCount(0);

  await studentLink.click();
  await expect(page).toHaveURL(/\/workspace\/lectures\/441\/sessions\/428\/attendance$/);
  const overlay = page.getByTestId("student-detail-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole("button", { name: "닫기" })).toBeFocused();
  await expect(overlay.getByRole("heading", {
    name: "테스트학생",
  })).toBeVisible();
  await expect(overlay.getByRole("button", { name: "학생 화면 보기" })).toBeVisible();
  await overlay.getByRole("button", { name: "계정·관리" }).click();
  await expect(overlay.getByRole("button", { name: "로그인 정보 안내 알림톡" })).toBeVisible();
  await expect(overlay.getByRole("button", { name: "비밀번호 초기화" })).toBeVisible();

  await overlay.getByRole("button", { name: "로그인 정보 안내 알림톡" }).click();
  await expect(page.getByRole("heading", { name: "로그인 정보 안내 알림톡" })).toBeVisible();
  await expect(page.getByText("등록된 번호로 실제 로그인 가능한 아이디와 비밀번호를 안내합니다. 기존 비밀번호는 유지하며, 과거 비밀번호를 확인할 수 없는 계정에는 안내용 로그인 비밀번호를 발급합니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "둘 다" })).toBeChecked();
  await page.getByRole("button", { name: "로그인 정보 안내 보내기" }).click();
  await expect.poll(() => guidanceTargets).toEqual(["student", "parent"]);
  await expect(page.getByRole("heading", { name: "로그인 정보 안내 알림톡" })).toHaveCount(0);
  await expect(overlay.getByText("로그인 가능", { exact: true })).toBeVisible();
  await expect(overlay.getByRole("button", {
    name: "현재 관리 중, 관리 대상에서 제외",
  })).toBeVisible();
  await expect(overlay.getByRole("tab", { name: "수강" })).toHaveAttribute("aria-selected", "true");
  await overlay.getByRole("tab", { name: "시험 0건", exact: true }).click();
  await expect(overlay.getByRole("tab", { name: "시험 0건", exact: true })).toHaveAttribute("aria-selected", "true");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(overlay.getByRole("button", { name: "정보 수정" })).toBeVisible();
  await expect(overlay.getByRole("tab", { name: "클리닉" })).toBeVisible();
  await overlay.getByRole("button", { name: "로그인 정보 안내 알림톡" }).click();
  const guidanceDialog = page.getByRole("dialog").filter({ hasText: "로그인 정보 안내 알림톡" }).last();
  await expect(guidanceDialog).toBeVisible();
  await expect.poll(() => guidanceDialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  if (process.env.CAPTURE_STUDENT_DETAIL === "1") {
    await page.screenshot({
      path: "../_artifacts/student-account-guidance-admin-mobile.png",
      fullPage: true,
    });
  }
  await page.keyboard.press("Escape");

  if (process.env.CAPTURE_STUDENT_DETAIL === "1") {
    await page.screenshot({
      path: "../_artifacts/student-detail-polish-mobile.png",
      fullPage: true,
    });
  }

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/workspace\/lectures\/441\/sessions\/428\/attendance$/);
  await expect(overlay).toHaveCount(0);
  await expect(studentLink).toBeVisible();
  await expect(studentLink).toBeFocused();

  const studentRow = page.getByRole("row").filter({ has: studentLink });
  await studentRow.getByRole("cell", { name: "010-3333-4444" }).click();
  await expect(page).toHaveURL(/\/workspace\/lectures\/441\/sessions\/428\/attendance$/);
  await expect(overlay).toBeVisible();
  await overlay.getByRole("button", { name: "닫기" }).click();
  await expect(page).toHaveURL(/\/workspace\/lectures\/441\/sessions\/428\/attendance$/);

  await studentLink.click();
  await expect(overlay).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/workspace\/lectures\/441\/sessions\/428\/attendance$/);
  await expect(overlay).toHaveCount(0);
});

test("학생 목록 행에서 연 상세는 Escape 뒤 같은 학생 행으로 포커스를 돌려준다", async ({ page }) => {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page);

  await gotoAndSettle(page, `${BASE}/workspace/students/home`, { timeout: 45_000 });

  const studentRow = page.locator('tr[data-student-detail-trigger="1002"]');
  await expect(studentRow).toBeVisible();
  await studentRow.click();

  const overlay = page.getByTestId("student-detail-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole("button", { name: "닫기" })).toBeFocused();

  await page.keyboard.press("Escape");

  await expect(overlay).toHaveCount(0);
  await expect(studentRow).toBeFocused();
});

test("학생 명부 이름순은 동명이인 ID와 페이지 이동에서도 유지된다", async ({ page }) => {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  const requests: Array<{ ordering: string | null; page: string | null }> = [];
  const students = [
    { id: 1001, name: "가람" },
    { id: 1002, name: "가람" },
    { id: 1003, name: "나래" },
    { id: 1004, name: "다온" },
  ];
  await installApi(page, undefined, undefined, undefined, (url) => {
    const ordering = url.searchParams.get("ordering");
    const pageNumber = Number(url.searchParams.get("page") ?? 1);
    requests.push({ ordering, page: url.searchParams.get("page") });
    const ordered = ordering?.startsWith("-") ? [...students].reverse() : students;
    return {
      count: students.length,
      page_size: 2,
      results: ordered.slice((pageNumber - 1) * 2, pageNumber * 2).map((student) => ({
        ...student,
        is_managed: true,
        enrollments: [],
        tags: [],
      })),
    };
  });

  await gotoAndSettle(page, `${BASE}/workspace/students/home`, { timeout: 45_000 });
  const rows = page.locator("tr[data-student-detail-trigger]");
  const visibleIds = () => rows.evaluateAll((items) => (
    items.map((item) => item.getAttribute("data-student-detail-trigger"))
  ));
  const nameHeader = page.getByRole("columnheader", { name: /이름/ });
  await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  await expect.poll(visibleIds).toEqual(["1001", "1002"]);
  await expect.poll(() => requests.at(-1)).toEqual({ ordering: "name,id", page: "1" });

  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect.poll(visibleIds).toEqual(["1003", "1004"]);
  await expect.poll(() => requests.at(-1)).toEqual({ ordering: "name,id", page: "2" });

  await nameHeader.click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "descending");
  await expect.poll(visibleIds).toEqual(["1004", "1003"]);
  await expect.poll(() => requests.at(-1)).toEqual({ ordering: "-name,-id", page: "1" });
  await nameHeader.click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  await expect.poll(visibleIds).toEqual(["1001", "1002"]);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  await expect(rows).toHaveCount(2);
});

test("강의 수강생은 이름순과 동명이인 ID순으로 보인다", async ({ page }) => {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page, undefined, undefined, undefined, undefined, () => ({
    lecture: { id: 441, title: "고1 Hyper 특강", color: "#2563eb" },
    sessions: [],
    students: [
      { student_id: 1003, name: "나래", phone: null, parent_phone: null, attendance: {} },
      { student_id: 1002, name: "가람", phone: null, parent_phone: null, attendance: {} },
      { student_id: 1001, name: "가람", phone: null, parent_phone: null, attendance: {} },
    ],
  }));

  await gotoAndSettle(page, `${BASE}/workspace/lectures/441`, { timeout: 45_000 });
  const nameHeader = page.getByRole("columnheader", { name: /이름/ });
  const visibleNames = () => page.locator('tbody tr input[type="checkbox"]').evaluateAll((inputs) => (
    inputs.map((input) => input.getAttribute("aria-label"))
  ));
  await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  await expect.poll(visibleNames).toEqual(["가람1 선택", "가람2 선택", "나래 선택"]);

  await nameHeader.click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "descending");
  await expect.poll(visibleNames).toEqual(["나래 선택", "가람2 선택", "가람1 선택"]);
  await nameHeader.click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  await expect.poll(visibleNames).toEqual(["가람1 선택", "가람2 선택", "나래 선택"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  await expect.poll(visibleNames).toEqual(["가람1 선택", "가람2 선택", "나래 선택"]);
});

test("교사용 모바일 학생 상세는 로그인 정보 안내와 비밀번호 초기화를 분리한다", async ({ page }) => {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  const guidanceTargets: string[] = [];
  const passwordResets: Array<Record<string, unknown>> = [];
  await installApi(
    page,
    (target) => guidanceTargets.push(target),
    (payload) => passwordResets.push(payload),
  );
  await page.setViewportSize({ width: 390, height: 844 });

  await gotoAndSettle(page, `${BASE}/workspace/mobile/students/1001`, {
    timeout: 45_000,
  });

  await expect(page.getByRole("heading", { name: "학생 상세" })).toBeVisible();
  await expect(page.getByText("로그인 정보 안내는 현재 비밀번호와 로그인 상태를 변경하지 않습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인 정보 안내", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "비밀번호 초기화", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "로그인 정보 안내", exact: true }).click();
  const guidanceSheet = page.getByRole("dialog").filter({ hasText: "로그인 정보 안내 알림톡" }).last();
  await expect(guidanceSheet).toBeVisible();
  await expect(guidanceSheet.getByText("등록된 번호로 실제 로그인 가능한 아이디와 비밀번호를 안내합니다.", { exact: false })).toBeVisible();
  await guidanceSheet.getByRole("button", { name: "둘 다", exact: true }).click();
  await expect.poll(() => guidanceSheet.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  if (process.env.CAPTURE_STUDENT_DETAIL === "1") {
    await page.screenshot({
      path: "../_artifacts/student-account-guidance-teacher-mobile.png",
      fullPage: true,
    });
  }
  await guidanceSheet.getByRole("button", { name: "학생·학부모 로그인 정보 안내 보내기" }).click();
  await expect.poll(() => guidanceTargets).toEqual(["student", "parent"]);
  await expect(guidanceSheet).toHaveCount(0);

  await page.getByRole("button", { name: "비밀번호 초기화", exact: true }).click();
  const resetSheet = page.getByRole("dialog").filter({ hasText: "비밀번호 초기화" }).last();
  await expect(resetSheet).toBeVisible();
  await expect(resetSheet.getByText("학생의 비밀번호를 변경합니다.", { exact: false })).toBeVisible();
  const submit = resetSheet.getByRole("button", { name: "비밀번호 변경", exact: true });
  await expect(submit).toBeDisabled();
  await resetSheet.getByRole("button", { name: "학부모", exact: true }).click();
  await resetSheet.getByPlaceholder("4자 이상 직접 입력").fill("chosen0982");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(() => passwordResets).toEqual([expect.objectContaining({
    target: "parent",
    parent_phone: "01011112222",
    temp_password: "chosen0982",
  })]);
  await expect(resetSheet).toHaveCount(0);
});

test("학생 수정은 새 학부모 계정에만 명시적 초기 비밀번호를 보낸다", async ({ page }) => {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  const updates: Array<Record<string, unknown>> = [];
  await installApi(page, undefined, undefined, (payload) => updates.push(payload));

  await gotoAndSettle(page, `${BASE}/workspace/students/1001`, { timeout: 45_000 });
  const overlay = page.getByTestId("student-detail-overlay");
  await overlay.getByRole("button", { name: "정보 수정" }).click();
  const dialog = page.getByRole("dialog", { name: "학생 수정" });
  const parentPassword = dialog.getByLabel("학부모 계정 초기 비밀번호");
  await expect(parentPassword).toBeVisible();
  await expect(parentPassword).toHaveValue("");
  await dialog.getByLabel("학부모 전화 앞 4자리").fill("2222");
  await dialog.getByLabel("학부모 전화 뒤 4자리").fill("3333");
  await parentPassword.fill("chosen0982");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();

  await expect.poll(() => updates).toEqual([expect.objectContaining({
    parent_phone: "01022223333",
    parent_initial_password: "chosen0982",
  })]);
});

test("삭제 학생 복원은 누락 학부모 계정에만 명시 비밀번호를 다시 받아 전송한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page);

  const restorePayloads: Record<string, unknown>[] = [];
  await page.route("**/api/v1/students/bulk_restore/", async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    restorePayloads.push(payload);
    const hasPassword = payload.parent_initial_password === "teacher-selected-password";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(hasPassword
        ? { restored: 1 }
        : {
            restored: 0,
            skipped: [{
              id: 1002,
              code: "parent_account_password_required",
              reason: "새 학부모 계정을 만들려면 초기 비밀번호를 입력해 주세요.",
            }],
          }),
    });
  });

  await gotoAndSettle(page, `${BASE}/workspace/students/deleted`, { timeout: 45_000 });
  await page.getByRole("checkbox", { name: "클리닉학생 선택" }).check();
  await page.getByRole("button", { name: "복원", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "학생 복원" });
  await expect(dialog).toBeVisible();
  await expect.poll(
    () => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await expect(dialog.getByText(/정상 학부모 계정의 비밀번호는 바뀌지 않습니다/)).toBeVisible();
  await dialog.getByRole("button", { name: "복원", exact: true }).click();
  let confirmation = page.getByRole("alertdialog", { name: "학생 복원 최종 확인" });
  await confirmation.getByRole("button", { name: "복원", exact: true }).click();
  await expect(confirmation.getByRole("alert")).toContainText("방식을 선택");
  expect(restorePayloads).toEqual([]);
  await confirmation.getByRole("button", { name: "취소", exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "복원", exact: true }).click();
  confirmation = page.getByRole("alertdialog", { name: "학생 복원 최종 확인" });
  await confirmation.getByRole("group", { name: "학부모 초기 비밀번호", exact: true }).getByRole("radio", { name: "직접 입력", exact: true }).check();
  await confirmation.getByLabel("학부모 직접 입력 비밀번호", { exact: true }).fill("teacher-selected-password");
  await confirmation.getByRole("button", { name: "복원", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(restorePayloads[0]).toEqual({ ids: [1002], parent_initial_password_mode: "fixed", parent_initial_password: "teacher-selected-password" });
});

test("학생 상세의 클리닉 이력은 해당 날짜와 세션의 출석 화면을 연다", async ({ page }) => {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page);

  await gotoAndSettle(page, `${BASE}/workspace/students/1001`, { timeout: 45_000 });

  const overlay = page.getByTestId("student-detail-overlay");
  await expect(overlay).toBeVisible({ timeout: 20_000 });

  await page.setViewportSize({ width: 390, height: 844 });
  const clinicTab = overlay.getByRole("tab", { name: "클리닉" });
  await clinicTab.click();
  await expect(clinicTab).toHaveAttribute("aria-selected", "true");

  const clinicLink = overlay.getByRole("button", {
    name: "테스트학생 클리닉 출석·진행 열기",
  });
  await expect(clinicLink).toContainText("출석·진행 열기");
  await expect(clinicLink).toBeVisible();
  if (process.env.CAPTURE_STUDENT_DETAIL === "1") {
    await page.screenshot({
      path: "../_artifacts/student-detail-clinic-link-mobile.png",
      fullPage: true,
    });
  }

  await clinicLink.press("Enter");

  await expect(page).toHaveURL(
    /\/workspace\/clinic\/operations\?date=2026-08-01&session=9001$/,
  );
  await expect(overlay).toHaveCount(0);
});

test("클리닉 대상자 선택 중 학생 상세를 열고 선택 화면으로 돌아온다", async ({ page }) => {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page);

  await gotoAndSettle(page, `${BASE}/workspace/clinic/schedule`, { timeout: 45_000 });

  const createClinicButton = page.getByRole("button", { name: "클리닉 만들기", exact: true });
  await expect(createClinicButton).toBeVisible({ timeout: 20_000 });
  await createClinicButton.click();
  const createDialog = page.getByRole("dialog").filter({ hasText: "클리닉 만들기" });
  await expect(createDialog.getByRole("heading", { name: "클리닉 만들기", exact: true })).toBeVisible();
  await createDialog.getByRole("button", { name: /시간지정 클리닉/ }).click();
  await createDialog.getByRole("button", { name: "대상자 추가", exact: true }).click();

  const targetGrid = page.getByRole("grid", { name: "미통과 대상자 명단" });
  await expect(targetGrid).toBeVisible();
  await targetGrid.getByRole("button", { name: "클리닉학생 학생 상세 열기" }).click();

  const overlay = page.getByTestId("student-detail-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole("heading", { name: "클리닉학생" })).toBeVisible();

  if (process.env.CAPTURE_STUDENT_DETAIL === "1") {
    await page.screenshot({
      path: "../_artifacts/student-detail-polish-nested-modal.png",
      fullPage: true,
    });
  }

  await overlay.getByRole("button", { name: "닫기" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(targetGrid).toBeVisible();
  await expect(targetGrid.getByRole("checkbox", { name: "클리닉학생 선택" })).not.toBeChecked();
});

async function prepareDetail(page: Page) {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", jwt + "-refresh");
  }, localJwt());
  await installApi(page);
}

test("학생 상세는 1366·1100·390px에서 주요 작업과 전체 탭에 접근할 수 있다", async ({ page }, testInfo) => {
  await prepareDetail(page);
  await page.route("**/api/v1/students/1001/", (route) => route.fulfill({ json: {
    id: 1001, name: "동명이인구분이필요한긴이름학생", ps_number: "student.name+1001",
    parent_phone: "01011112222", phone: "01033334444", is_managed: true,
    high_school: "이름이 긴 학교 정보도 확인할 수 있는 가상고등학교", grade: 2,
    tags: [], enrollments: [],
  } }));
  for (const width of [1366, 1100, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await gotoAndSettle(page, BASE + "/workspace/students/1001");
    const overlay = page.getByTestId("student-detail-overlay");
    await expect(overlay.getByRole("button", { name: "정보 수정" })).toBeVisible();
    await expect(overlay.getByRole("button", { name: "학생 화면 보기" })).toBeVisible();
    for (const label of ["수강", "시험", "과제", "오답노트", "클리닉", "질문", "활동"]) {
      await expect(overlay.getByRole("tab", { name: new RegExp("^" + label) })).toBeInViewport();
    }
    if (width === 390) {
      await expect(overlay.getByRole("textbox", { name: "학생 공통 메모" })).toBeHidden();
      await overlay.getByRole("button", { name: "연락처·메모 보기" }).click();
    }
    await expect(overlay.getByRole("button", { name: "학부모 전화 010-1111-2222 복사" })).toBeVisible();
    await expect.poll(() => overlay.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await overlay.getByRole("tab", { name: /^수강/ }).focus();
    await page.keyboard.press("End");
    await expect(overlay.getByRole("tab", { name: /^활동/ })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(overlay.getByRole("tab", { name: /^수강/ })).toHaveAttribute("aria-selected", "true");
    await page.screenshot({ path: testInfo.outputPath("student-detail-" + width + ".png") });
  }
});

test("학생 메모는 느린 저장 중 재입력한 내용을 보존하고 닫기 중복을 막는다", async ({ page }) => {
  await prepareDetail(page);
  let serverMemo = "기존 메모";
  let releaseFirst!: () => void;
  const firstSaved = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const patches: string[] = [];
  await page.route("**/api/v1/students/1001/", async (route) => {
    if (route.request().method() === "PATCH") {
      const text = (route.request().postDataJSON() as { memo: string }).memo;
      patches.push(text);
      if (patches.length === 1) await firstSaved;
      serverMemo = text;
    }
    await route.fulfill({ json: { id: 1001, name: "메모학생", ps_number: "memo.1001", memo: serverMemo, is_managed: true, tags: [], enrollments: [] } });
  });
  await gotoAndSettle(page, BASE + "/workspace/students/home");
  await page.goto(BASE + "/workspace/students/1001");
  const overlay = page.getByTestId("student-detail-overlay");
  const input = overlay.getByRole("textbox", { name: "학생 공통 메모" });
  await input.fill("잠시 입력한 값");
  await input.fill("기존 메모");
  await overlay.getByRole("tab", { name: /^수강/ }).click();
  expect(patches).toEqual([]);
  await input.fill("첫 번째 메모");
  await overlay.getByRole("tab", { name: /^수강/ }).click();
  await expect.poll(() => patches).toEqual(["첫 번째 메모"]);
  await input.fill("새로 입력한 최종 메모");
  await overlay.getByRole("button", { name: "닫기", exact: true }).dblclick();
  await expect(overlay).toBeVisible();
  releaseFirst();
  await expect(overlay).toHaveCount(0);
  await expect(page).toHaveURL(/\/workspace\/students\/home$/);
  expect(patches).toEqual(["첫 번째 메모", "새로 입력한 최종 메모"]);
  await page.goto(BASE + "/workspace/students/1001");
  await expect(page.getByRole("textbox", { name: "학생 공통 메모" })).toHaveValue("새로 입력한 최종 메모");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "학생 공통 메모" })).toHaveValue(serverMemo);
});

test("메모 저장 이전에 시작한 상세 재조회가 저장 결과를 되돌리지 않는다", async ({ page }) => {
  await prepareDetail(page);
  let serverMemo = "저장 전 메모";
  let removed = false;
  let reads = 0;
  let releaseSave!: () => void;
  let releaseRead!: () => void;
  const saving = new Promise<void>((resolve) => { releaseSave = resolve; });
  const reading = new Promise<void>((resolve) => { releaseRead = resolve; });
  await page.route("**/api/v1/students/1001/remove_tag/", async (route) => {
    removed = true;
    await route.fulfill({ json: {} });
  });
  await page.route("**/api/v1/students/1001/", async (route) => {
    if (route.request().method() === "PATCH") {
      await saving;
      serverMemo = (route.request().postDataJSON() as { memo: string }).memo;
      return route.fulfill({ json: { id: 1001, memo: serverMemo } });
    }
    const memo = serverMemo;
    reads++;
    if (reads === 2) await reading;
    return route.fulfill({ json: { id: 1001, name: "재조회학생", memo,
      tags: removed ? [] : [{ id: 91, name: "재조회 태그", color: "#2563eb" }], enrollments: [] } });
  });
  await gotoAndSettle(page, BASE + "/workspace/students/1001");
  const overlay = page.getByTestId("student-detail-overlay");
  const input = overlay.getByRole("textbox", { name: "학생 공통 메모" });
  await input.fill("저장 완료한 메모");
  await overlay.getByRole("button", { name: "재조회 태그 태그 제거", exact: true }).click();
  await expect.poll(() => reads).toBe(2);
  releaseSave();
  await expect(overlay.getByText("저장됨", { exact: true })).toBeVisible();
  const lateResponse = page.waitForResponse((response) => response.request().method() === "GET"
    && new URL(response.url()).pathname === "/api/v1/students/1001/");
  releaseRead();
  await lateResponse;
  await expect(overlay.getByRole("button", { name: "재조회 태그 태그 제거", exact: true })).toHaveCount(0);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(input).toHaveValue("저장 완료한 메모");
});

test("빈 메모의 null 응답은 저장으로 확인하고 누락 응답은 재시도한다", async ({ page }) => {
  await prepareDetail(page);
  let serverMemo: string | null = "지울 메모";
  let omitResult = false;
  await page.route("**/api/v1/students/1001/", async (route) => {
    if (route.request().method() === "PATCH") {
      serverMemo = (route.request().postDataJSON() as { memo: string }).memo.trim() || null;
      return route.fulfill({ json: omitResult ? { id: 1001 } : { id: 1001, memo: serverMemo } });
    }
    return route.fulfill({ json: { id: 1001, name: "메모학생", memo: serverMemo, tags: [], enrollments: [] } });
  });
  await gotoAndSettle(page, BASE + "/workspace/students/1001");
  const detail = page.getByTestId("student-detail-overlay");
  const input = detail.getByRole("textbox", { name: "학생 공통 메모" });
  await input.fill("");
  await detail.getByRole("tab", { name: /^수강/ }).click();
  await expect(detail.getByText("저장됨", { exact: true })).toBeVisible();
  expect(serverMemo).toBeNull();
  await page.reload();
  await expect(input).toHaveValue("");
  omitResult = true;
  await input.fill("다시 확인할 메모");
  await detail.getByRole("tab", { name: /^수강/ }).click();
  await expect(detail.getByRole("button", { name: "다시 저장", exact: true })).toBeVisible();
  await expect(input).toHaveValue("다시 확인할 메모");
  omitResult = false;
  await detail.getByRole("button", { name: "다시 저장", exact: true }).click();
  await expect(detail.getByText("저장됨", { exact: true })).toBeVisible();
});

test("저장 중 뒤로 갔다 다시 연 학생의 새 메모는 앞선 쓰기를 추월하지 않는다", async ({ page }) => {
  await prepareDetail(page);
  let serverMemo = "처음 값";
  let releaseFirst!: () => void;
  const firstSave = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const patches: string[] = [];
  await page.route("**/api/v1/students/1002/", async (route) => {
    if (route.request().method() === "PATCH") {
      const memo = (route.request().postDataJSON() as { memo: string }).memo;
      patches.push(memo);
      if (patches.length === 1) await firstSave;
      serverMemo = memo;
      return route.fulfill({ json: { id: 1002, memo: serverMemo } });
    }
    return route.fulfill({ json: { id: 1002, name: "클리닉학생", memo: serverMemo, tags: [], enrollments: [] } });
  });
  await gotoAndSettle(page, BASE + "/workspace/students/home");
  const row = page.locator('tr[data-student-detail-trigger="1002"]');
  await row.click();
  const detail = page.getByTestId("student-detail-overlay");
  const input = detail.getByRole("textbox", { name: "학생 공통 메모" });
  await input.fill("먼저 저장한 값");
  await detail.getByRole("tab", { name: /^수강/ }).click();
  await expect.poll(() => patches).toEqual(["먼저 저장한 값"]);
  await page.goBack();
  await expect(detail).toHaveCount(0);
  await row.click();
  await input.fill("다시 열어 수정한 값");
  await detail.getByRole("tab", { name: /^수강/ }).click();
  await expect(detail.getByText("저장 중…", { exact: true })).toBeVisible();
  expect(patches).toEqual(["먼저 저장한 값"]);
  releaseFirst();
  await expect(detail.getByText("저장됨", { exact: true })).toBeVisible();
  expect(patches).toEqual(["먼저 저장한 값", "다시 열어 수정한 값"]);
  expect(serverMemo).toBe("다시 열어 수정한 값");
  await page.reload();
  await expect(input).toHaveValue("다시 열어 수정한 값");
});

test("인증 세션이 바뀌면 대기하던 메모를 자동 전송하지 않고 명시적으로 다시 저장한다", async ({ page }) => {
  await prepareDetail(page);
  let serverMemo = "처음 값";
  let releaseFirst!: () => void;
  const firstSave = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const patches: string[] = [];
  await page.route("**/api/v1/students/1002/", async (route) => {
    if (route.request().method() === "PATCH") {
      const value = (route.request().postDataJSON() as { memo: string }).memo;
      patches.push(value);
      if (patches.length === 1) await firstSave;
      serverMemo = value;
      return route.fulfill({ json: { id: 1002, memo: serverMemo } });
    }
    return route.fulfill({ json: { id: 1002, name: "클리닉학생", memo: serverMemo, tags: [], enrollments: [] } });
  });
  await gotoAndSettle(page, BASE + "/workspace/students/home");
  const row = page.locator('tr[data-student-detail-trigger="1002"]');
  await row.click();
  const detail = page.getByTestId("student-detail-overlay");
  const input = detail.getByRole("textbox", { name: "학생 공통 메모" });
  await input.fill("진행 중 메모");
  await detail.getByRole("tab", { name: /^수강/ }).click();
  await expect.poll(() => patches).toEqual(["진행 중 메모"]);
  await page.goBack();
  await expect(detail).toHaveCount(0);
  await row.click();
  await input.fill("이전 세션에서 대기한 메모");
  await detail.getByRole("tab", { name: /^수강/ }).click();
  await expect(detail.getByText("저장 중…", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const key = "academy:auth-active-generation:v1";
    const generation = localStorage.getItem(key);
    const envelope = JSON.parse(localStorage.getItem(`academy:auth-tokens:v1:${generation}`) ?? "null");
    if (!envelope) throw new Error("Active authentication envelope missing");
    const nextGeneration = "student-memo-new-session";
    localStorage.setItem(`academy:auth-tokens:v1:${nextGeneration}`, JSON.stringify({ ...envelope, generation: nextGeneration }));
    localStorage.setItem(key, nextGeneration);
  });
  releaseFirst();
  await expect(detail.getByRole("button", { name: "다시 저장", exact: true })).toBeVisible();
  expect(patches).toEqual(["진행 중 메모"]);
  await expect(input).toHaveValue("이전 세션에서 대기한 메모");
  await detail.getByRole("button", { name: "다시 저장", exact: true }).click();
  await expect(detail.getByText("저장됨", { exact: true })).toBeVisible();
  expect(patches).toEqual(["진행 중 메모", "이전 세션에서 대기한 메모"]);
});

test("학생 메모 저장 실패는 입력과 상세를 유지하고 재시도로 복구한다", async ({ page }) => {
  await prepareDetail(page);
  let failSave = true;
  let serverMemo = "보존할 메모";
  await page.route("**/api/v1/students/1001/", async (route) => {
    if (route.request().method() === "PATCH") {
      if (failSave) return route.fulfill({ status: 503, json: { detail: "test save unavailable" } });
      serverMemo = (route.request().postDataJSON() as { memo: string }).memo.trim();
      return route.fulfill({ json: { id: 1001, memo: serverMemo } });
    }
    return route.fulfill({ json: { id: 1001, name: "테스트학생", memo: serverMemo, tags: [{ id: 91, name: "보존할 태그", color: "#2563eb" }], enrollments: [] } });
  });
  await gotoAndSettle(page, BASE + "/workspace/students/1001");
  const overlay = page.getByTestId("student-detail-overlay");
  const input = overlay.getByRole("textbox", { name: "학생 공통 메모" });
  await input.fill("실패해도 유지할 변경  ");
  await overlay.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(overlay.getByRole("button", { name: "다시 저장", exact: true })).toBeVisible();
  await expect(input).toHaveValue("실패해도 유지할 변경  ");
  expect(serverMemo).toBe("보존할 메모");
  failSave = false;
  await overlay.getByRole("button", { name: "다시 저장", exact: true }).click();
  await expect(overlay.getByText("저장됨", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("실패해도 유지할 변경");
  await expect(overlay.getByRole("button", { name: "보존할 태그 태그 제거", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "학생 공통 메모" })).toHaveValue("실패해도 유지할 변경");
});

test("학생 질문·클리닉은 실패를 빈 기록으로 표시하지 않고 50건 이후도 읽는다", async ({ page }) => {
  await prepareDetail(page);
  let failRead = true;
  let failNextPage = true;
  const requestedPages: string[] = [];
  await page.route("**/api/v1/community/posts/?**", async (route) => {
    const url = new URL(route.request().url());
    if (!url.searchParams.has("author_student")) return route.fallback();
    expect(url.searchParams.get("author_student")).toBe("1001");
    expect(url.searchParams.get("post_type")).toBe("qna");
    if (failRead) return route.fulfill({ status: 503, json: { detail: "test history unavailable" } });
    const current = url.searchParams.get("page") || "1";
    if (current === "2" && failNextPage) return route.fulfill({ status: 503, json: { detail: "test next page unavailable" } });
    requestedPages.push(current);
    const rows = current === "1" ? Array.from({ length: 50 }, (_, i) => ({ id: 100 + i, post_type: "qna", title: "질문 " + (i + 1) })) : [{ id: 149, post_type: "qna", title: "질문 50" }, { id: 150, post_type: "qna", title: "질문 51" }];
    return route.fulfill({ json: { count: 51, next: current === "1" ? "?page=2" : null, results: rows } });
  });
  await page.route("**/api/v1/clinic/participants/?**", async (route) => {
    if (!new URL(route.request().url()).searchParams.has("student")) return route.fallback();
    expect(new URL(route.request().url()).searchParams.get("student")).toBe("1001");
    return route.fulfill({ status: failRead ? 503 : 200, json: failRead ? { detail: "test unavailable" } : { count: 0, results: [], next: null } });
  });
  await gotoAndSettle(page, BASE + "/workspace/students/1001");
  const overlay = page.getByTestId("student-detail-overlay");
  await overlay.getByRole("tab", { name: /^질문/ }).click();
  await expect(overlay.getByRole("alert")).toContainText("질문 이력을 불러오지 못했습니다", { timeout: 30000 });
  await expect(overlay.getByText("질문 이력이 없습니다.")).toHaveCount(0);
  failRead = false;
  await overlay.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(overlay.getByRole("tab", { name: "질문 51건", exact: true })).toBeVisible();
  await overlay.getByRole("button", { name: "질문 이력 더 보기" }).click();
  await expect(overlay.getByRole("alert")).toContainText("이미 불러온 기록은 유지됩니다", { timeout: 30000 });
  await expect(overlay.getByRole("button", { name: "질문 질문 1", exact: true })).toBeVisible();
  failNextPage = false;
  await overlay.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(overlay.getByRole("button", { name: "질문 질문 51", exact: true })).toBeVisible();
  await expect(overlay.getByRole("button", { name: "질문 질문 50", exact: true })).toHaveCount(1);
  expect(requestedPages).toEqual(["1", "2"]);
  await overlay.getByRole("tab", { name: /^클리닉/ }).click();
  await expect(overlay.getByRole("button", { name: "다시 불러오기" })).toBeVisible();
  await overlay.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(overlay.getByText("클리닉/상담 이력이 없습니다.")).toBeVisible();
});

test("학생 ID 복사는 구두점을 보존하고 키보드로 사용할 수 있다", async ({ page }) => {
  await prepareDetail(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (value: string) => { document.documentElement.dataset.copiedStudentId = value; },
    } });
  });
  await page.route("**/api/v1/students/1001/", (route) => route.fulfill({
    json: { id: 1001, name: "학생", ps_number: "student.name+01", tags: [], enrollments: [] },
  }));
  await gotoAndSettle(page, BASE + "/workspace/students/1001");
  await page.getByRole("button", { name: "아이디 student.name+01 복사", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-copied-student-id", "student.name+01");
});

test("잘못된 학생 ID는 무한 로딩 대신 복귀 가능한 오류를 표시한다", async ({ page }) => {
  await prepareDetail(page);
  await gotoAndSettle(page, BASE + "/workspace/students/not-a-student");
  const overlay = page.getByTestId("student-detail-overlay");
  await expect(overlay.getByText("학생 정보를 찾을 수 없습니다")).toBeVisible();
  await overlay.getByRole("button", { name: "닫기", exact: true }).first().click();
  await expect(page).toHaveURL(/\/workspace\/students\/home$/);
});

test("저장 실패 후 뒤로 이동해도 같은 학생을 다시 열면 메모 초안을 복원한다", async ({ page }) => {
  await prepareDetail(page);
  let fail = true;
  let savedMemo = "원래 값";
  let attempts = 0;
  await page.route("**/api/v1/students/1002/", async (route) => {
    if (route.request().method() === "PATCH") {
      attempts++;
      if (fail) return route.fulfill({ status: 503, json: { detail: "QA 일시 저장 실패" } });
      savedMemo = (route.request().postDataJSON() as { memo: string }).memo;
    }
    return route.fulfill({ json: { id: 1002, name: "클리닉학생", memo: savedMemo, tags: [], enrollments: [] } });
  });
  await gotoAndSettle(page, BASE + "/workspace/students/home");
  const row = page.locator('tr[data-student-detail-trigger="1002"]');
  await row.click();
  await page.getByRole("textbox", { name: "학생 공통 메모" }).fill("돌아와서 복구할 메모");
  await page.getByRole("tab", { name: /^수강/ }).click();
  await expect(page.getByRole("button", { name: "다시 저장", exact: true })).toBeVisible();
  await expect.poll(() => attempts).toBeGreaterThan(0);
  await page.goBack();
  await expect(page.getByTestId("student-detail-overlay")).toHaveCount(0);
  await row.click();
  const input = page.getByRole("textbox", { name: "학생 공통 메모" });
  await expect(input).toHaveValue("돌아와서 복구할 메모");
  fail = false;
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => savedMemo).toBe("돌아와서 복구할 메모");
});
