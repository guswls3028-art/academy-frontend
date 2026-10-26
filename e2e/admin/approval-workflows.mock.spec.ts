import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

async function installApprovals(page: Page) {
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
  await page.addInitScript((access) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
  }, token);
  const state = {
    signupAuto: false, clinicAuto: false, failSettings: false, failList: false,
    failApproval: false, moreRequests: false,
    settingsWrites: [] as Record<string, unknown>[], approvals: [] as number[],
    requests: [101, 102].map((id) => ({ id, name: id === 101 ? "김승인" : "이확인", status: "pending", phone: "01000001111", parent_phone: "01000002222", parent_password_selected: true, school_type: "HIGH", high_school: "가나다고등학교", grade: 2, created_at: "2026-10-26T09:00:00Z" })),
    participants: [201, 202].map((id) => ({ id, student: id, student_name: id === 201 ? "김예약" : "이대기", session: 1, status: "pending", session_date: "2026-10-29", session_start_time: "16:00:00", session_location: "본관", student_request_memo: "수업 종료 후 참여합니다." })),
  };
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    if (["/core/program/", "/core/me/", "/token/refresh/", "/results/admin/clinic-targets/"].includes(path)) return route.fallback();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/clinic/settings/" || path.endsWith("/registration_requests/settings/")) {
      if (req.method() === "PATCH") {
        const payload = req.postDataJSON();
        state.settingsWrites.push(payload);
        if (state.failSettings) return route.fulfill({ status: 400, json: { detail: "설정을 저장하지 못했습니다. 다시 시도해 주세요." } });
        if ("auto_approve" in payload) state.signupAuto = payload.auto_approve;
        if ("auto_approve_booking" in payload) state.clinicAuto = payload.auto_approve_booking;
      }
      return route.fulfill({ json: { auto_approve: state.signupAuto, auto_approve_booking: state.clinicAuto, colors: ["#ef4444", "#3b82f6", "#22c55e"] } });
    }
    if (path === "/students/registration_requests/bulk_approve/") {
      const ids: number[] = req.postDataJSON().ids;
      state.approvals.push(...ids);
      const failed = state.failApproval ? ids.filter((id) => id === 102) : [];
      state.requests = state.requests.filter((r) => !ids.includes(r.id) || failed.includes(r.id));
      return route.fulfill({ json: { approved: ids.length - failed.length, failed: failed.map((id) => ({ id, detail: "학교 정보를 확인해 주세요." })) } });
    }
    if (/registration_requests\/\d+\/approve\/$/.test(path)) {
      const id = Number(path.split("/").at(-3));
      state.approvals.push(id);
      state.requests = state.requests.filter((r) => r.id !== id);
      return route.fulfill({ json: { id, name: "김승인" } });
    }
    if (path === "/students/registration_requests/") {
      const next = url.searchParams.get("page") === "2";
      if (state.failList && next) return route.fulfill({ status: 400, json: { detail: "목록 확인 실패" } });
      return route.fulfill({ json: { count: state.requests.length + (state.moreRequests ? 1 : 0), results: next ? [{ ...state.requests[0], id: 103, name: "박다음" }] : state.requests } });
    }
    if (/^\/clinic\/participants\/\d+\/set_status\/$/.test(path) && req.method() === "PATCH") {
      const id = Number(path.split("/").at(-3));
      state.approvals.push(id);
      if (state.failApproval && id === 202) return route.fulfill({ status: 400, json: { detail: "예약 시간을 확인해 주세요." } });
      const participant = state.participants.find((p) => p.id === id)!;
      participant.status = req.postDataJSON().status;
      return route.fulfill({ json: participant });
    }
    if (path === "/clinic/participants/") {
      const rows = url.searchParams.get("status") === "pending" ? state.participants.filter((p) => p.status === "pending") : [];
      return route.fulfill({ json: { count: rows.length, results: rows, next: null, previous: null } });
    }
    return route.fulfill({ json: { count: 0, results: [], next: null, previous: null } });
  });
  return state;
}

test.use({ serviceWorkers: "block" });

for (const width of [1366, 390]) {
  test(`${width}px 승인 화면 구성`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await installApprovals(page);
    await page.goto(`${BASE}/workspace/students/requests`);
    await expect(page.getByText("김승인", { exact: true })).toBeVisible({ timeout: 45_000 });
    await page.screenshot({ path: info.outputPath(`signup-approval-${width}.png`), fullPage: true });
    await page.goto(`${BASE}/workspace/clinic/home`);
    await expect(page.getByText("예약 자동 승인", { exact: true })).toBeVisible();
    await expect(page.getByText("김예약", { exact: true })).toBeVisible();
    await expect(page.getByText("오늘 예정된 클리닉이 없습니다.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath(`clinic-approval-${width}.png`), fullPage: true });
  });

  for (const kind of ["signup", "clinic"] as const) {
    test(`${width}px ${kind} 자동 승인 저장 실패 복구와 새로고침`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const state = await installApprovals(page);
      await page.goto(`${BASE}/workspace/${kind === "signup" ? "students/requests" : "clinic/home"}`);
      const toggle = page.getByRole("switch", { name: kind === "signup" ? "가입 자동 승인" : "예약 자동 승인", exact: true });
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      state.failSettings = true;
      await toggle.click();
      await expect(page.getByRole("alert").filter({ hasText: "마지막 저장값" })).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      state.failSettings = false;
      await page.getByRole("button", { name: "저장 다시 시도" }).click();
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await expect(page.getByRole("status").filter({ hasText: "승인 설정을 저장했습니다" })).toBeVisible();
      expect(state.settingsWrites).toEqual(Array(2).fill(kind === "signup" ? { auto_approve: true } : { auto_approve_booking: true }));
      expect(state.approvals).toEqual([]);
      await page.reload();
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await expect(page.getByText(kind === "signup" ? "김승인" : "김예약", { exact: true })).toBeVisible();
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      await page.reload();
      await expect(toggle).toHaveAttribute("aria-checked", "false");
    });
  }

  test(`${width}px 가입 선택 승인 부분 실패와 재시도`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await installApprovals(page);
    state.failApproval = true;
    await page.goto(`${BASE}/workspace/students/requests`);
    await page.getByRole("checkbox", { name: "불러온 신청 전체 선택" }).check();
    await page.getByRole("button", { name: "선택 승인", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "승인", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "1건 처리하지 못했습니다" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "이확인 선택", exact: true })).toBeChecked();
    await expect(page.getByText("김승인", { exact: true })).toHaveCount(0);
    state.failApproval = false;
    await page.getByRole("button", { name: "선택 승인", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "승인", exact: true }).click();
    await expect(page.getByText("대기 중인 가입 신청이 없습니다", { exact: true })).toBeVisible();
    expect(state.approvals).toEqual([101, 102, 102]);
    await page.reload();
    await expect(page.getByText("대기 중인 가입 신청이 없습니다", { exact: true })).toBeVisible();
  });

  test(`${width}px 클리닉 일괄 승인 확인·부분 실패·재시도`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await installApprovals(page);
    state.failApproval = true;
    await page.goto(`${BASE}/workspace/clinic/home`);
    await page.getByRole("button", { name: "일괄 승인", exact: true }).click();
    const dialog = page.getByRole("alertdialog", { name: "예약 일괄 승인" });
    await expect(dialog).toBeVisible();
    expect(state.approvals).toEqual([]);
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    expect(state.approvals).toEqual([]);
    await page.getByRole("button", { name: "일괄 승인", exact: true }).click();
    await dialog.getByRole("button", { name: "2건 승인", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "1건 승인 · 1건 실패" })).toBeVisible();
    await expect(page.getByText("김예약", { exact: true })).toHaveCount(0);
    state.failApproval = false;
    await page.getByRole("button", { name: "일괄 승인", exact: true }).click();
    await dialog.getByRole("button", { name: "1건 승인", exact: true }).click();
    await expect(page.getByText("대기 중인 예약이 없습니다.", { exact: false })).toBeVisible();
    expect(state.approvals).toEqual([201, 202, 202]);
    await page.reload();
    await expect(page.getByText("대기 중인 예약이 없습니다.", { exact: false })).toBeVisible();
  });
}

test("가입 다음 페이지 실패에도 선택을 유지하고 키보드로 상세를 연다", async ({ page }) => {
  const state = await installApprovals(page);
  state.moreRequests = true;
  state.failList = true;
  await page.goto(`${BASE}/workspace/students/requests`);
  await page.getByRole("checkbox", { name: "김승인 선택", exact: true }).check();
  await page.getByRole("button", { name: "신청 더 보기" }).click();
  await expect(page.getByText("다음 신청을 불러오지 못했습니다.", { exact: false })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "김승인 선택", exact: true })).toBeChecked();
  state.failList = false;
  await page.getByRole("button", { name: "다음 신청 다시 시도" }).click();
  await expect(page.getByText("박다음", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "김승인 선택", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "박다음 신청 상세" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").filter({ hasText: "가입 신청 상세" })).toBeVisible();
  expect(state.approvals).toEqual([]);
});
