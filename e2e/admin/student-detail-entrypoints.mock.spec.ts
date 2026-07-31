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
        active: true,
        tags: [],
        enrollments: [],
      });
    }
    if (path === "/results/admin/clinic-targets/") {
      return json([]);
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
  await expect(page.getByTestId("student-detail-overlay")).toBeVisible();
  await expect(page.getByTestId("student-detail-overlay").getByRole("heading", {
    name: "테스트학생",
  })).toBeVisible();

  await page.getByTestId("student-detail-overlay").getByRole("button", { name: "닫기" }).click();
  await expect(page).toHaveURL(/\/workspace\/lectures\/441\/sessions\/428\/attendance$/);
  await expect(studentLink).toBeVisible();
});
