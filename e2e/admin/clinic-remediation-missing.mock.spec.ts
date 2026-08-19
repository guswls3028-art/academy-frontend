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

test("미응시를 판정 대기로 구분하고 사유를 남겨 면제한 뒤 이력을 조회한다", async ({ page }, testInfo) => {
  await seed(page);
  const waiverPayloads: Array<Record<string, unknown>> = [];
  let waived = false;

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
    if (path === "/clinic/participants/" && method === "GET") return json({ count: 0, results: [] });
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
  await page.getByRole("button", { name: "클리닉 만들기", exact: true }).click();
  const clinicForm = page.locator(".clinic-create--modal");
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
});
