import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function localJwt(): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function installApi(page: Page) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
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
        is_managed: true,
        tags: [],
        enrollments: [],
      });
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
  await installApi(page);

  await page.goto(
    `${BASE}/workspace/lectures/441/sessions/428/attendance`,
    { waitUntil: "domcontentloaded", timeout: 45_000 },
  );

  const studentLink = page.getByRole("link", {
    name: "테스트학생 학생 상세 열기",
  });
  await expect(studentLink).toBeVisible();

  await page.getByRole("button", {
    name: "테스트학생 출결 상태 변경",
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
  await expect(overlay.getByRole("button", {
    name: "현재 활성, 비활성으로 변경",
  })).toBeVisible();
  await expect(overlay.getByRole("tab", { name: "수강" })).toHaveAttribute("aria-selected", "true");
  await overlay.getByRole("tab", { name: "시험" }).click();
  await expect(overlay.getByRole("tab", { name: "시험" })).toHaveAttribute("aria-selected", "true");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(overlay.getByRole("button", { name: "정보 수정" })).toBeVisible();
  await expect(overlay.getByRole("tab", { name: "클리닉" })).toBeVisible();

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

test("클리닉 대상자 선택 중 학생 상세를 열고 선택 화면으로 돌아온다", async ({ page }) => {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page);

  await page.goto(`${BASE}/workspace/clinic/schedule`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  await page.getByRole("button", { name: "클리닉 만들기", exact: true }).click();
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
