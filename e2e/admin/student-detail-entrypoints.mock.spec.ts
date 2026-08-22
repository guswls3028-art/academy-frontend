import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

test.use({ serviceWorkers: "block" });

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
    if (path === "/students/1001/") {
      return json({
        id: 1001,
        name: "테스트학생",
        ps_number: "S1001",
        phone: "01033334444",
        parent_phone: "01011112222",
        is_managed: true,
        tags: [],
        enrollments: [],
      });
    }
    if (path === "/students/1001/account-notifications/") {
      if (request.method() === "POST") {
        const payload = request.postDataJSON() as { target: "student" | "parent" };
        onAccountGuidance?.(payload.target);
        return json({ message: "아이디 안내 알림톡을 발송했습니다. 비밀번호는 변경되지 않았습니다." });
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
  await expect(page).toHaveURL(/\/workspace\/students\/1001$/);
  const overlay = page.getByTestId("student-detail-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole("heading", {
    name: "테스트학생",
  })).toBeVisible();
  await expect(overlay.getByRole("button", { name: "학생 화면 보기" })).toBeVisible();
  await expect(overlay.getByRole("button", { name: "아이디 안내 알림톡" })).toBeVisible();
  await expect(overlay.getByRole("button", { name: "비밀번호 초기화" })).toBeVisible();

  await overlay.getByRole("button", { name: "아이디 안내 알림톡" }).click();
  await expect(page.getByRole("heading", { name: "아이디 안내 알림톡" })).toBeVisible();
  await expect(page.getByText("등록된 번호로 로그인 아이디를 안내합니다. 현재 비밀번호와 로그인 상태는 변경되지 않습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "둘 다" })).toBeChecked();
  await page.getByRole("button", { name: "아이디 안내 보내기" }).click();
  await expect.poll(() => guidanceTargets).toEqual(["student", "parent"]);
  await expect(page.getByRole("heading", { name: "아이디 안내 알림톡" })).toHaveCount(0);
  await expect(overlay.getByRole("button", {
    name: "현재 활성, 비활성으로 변경",
  })).toBeVisible();
  await expect(overlay.getByRole("tab", { name: "수강" })).toHaveAttribute("aria-selected", "true");
  await overlay.getByRole("tab", { name: "시험 0건", exact: true }).click();
  await expect(overlay.getByRole("tab", { name: "시험 0건", exact: true })).toHaveAttribute("aria-selected", "true");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(overlay.getByRole("button", { name: "정보 수정" })).toBeVisible();
  await expect(overlay.getByRole("tab", { name: "클리닉" })).toBeVisible();
  await overlay.getByRole("button", { name: "아이디 안내 알림톡" }).click();
  const guidanceDialog = page.getByRole("dialog").filter({ hasText: "아이디 안내 알림톡" }).last();
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

  await overlay.getByRole("button", { name: "닫기" }).click();
  await expect(page).toHaveURL(/\/workspace\/lectures\/441\/sessions\/428\/attendance$/);
  await expect(studentLink).toBeVisible();
});

test("교사용 모바일 학생 상세는 아이디 안내와 비밀번호 초기화를 분리한다", async ({ page }) => {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  const guidanceTargets: string[] = [];
  await installApi(page, (target) => guidanceTargets.push(target));
  await page.setViewportSize({ width: 390, height: 844 });

  await gotoAndSettle(page, `${BASE}/workspace/mobile/students/1001`, {
    timeout: 45_000,
  });

  await expect(page.getByRole("heading", { name: "학생 상세" })).toBeVisible();
  await expect(page.getByText("아이디 안내는 현재 비밀번호와 로그인 상태를 변경하지 않습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "아이디 안내", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "비밀번호 초기화", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "아이디 안내", exact: true }).click();
  const guidanceSheet = page.getByRole("dialog").filter({ hasText: "아이디 안내 알림톡" }).last();
  await expect(guidanceSheet).toBeVisible();
  await expect(guidanceSheet.getByText("비밀번호는 바뀌지 않습니다.", { exact: false })).toBeVisible();
  await guidanceSheet.getByRole("button", { name: "둘 다", exact: true }).click();
  await expect.poll(() => guidanceSheet.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  if (process.env.CAPTURE_STUDENT_DETAIL === "1") {
    await page.screenshot({
      path: "../_artifacts/student-account-guidance-teacher-mobile.png",
      fullPage: true,
    });
  }
  await guidanceSheet.getByRole("button", { name: "학생·학부모 아이디 안내 보내기" }).click();
  await expect.poll(() => guidanceTargets).toEqual(["student", "parent"]);
  await expect(guidanceSheet).toHaveCount(0);

  await page.getByRole("button", { name: "비밀번호 초기화", exact: true }).click();
  const resetSheet = page.getByRole("dialog").filter({ hasText: "비밀번호 초기화" }).last();
  await expect(resetSheet).toBeVisible();
  await expect(resetSheet.getByText("학생의 비밀번호를 변경합니다.", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
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
  await expect(page.getByRole("heading", { name: "클리닉 만들기", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "대상자 추가", exact: true }).click();

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
