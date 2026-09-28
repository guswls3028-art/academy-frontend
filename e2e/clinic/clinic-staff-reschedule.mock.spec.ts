import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { currentClinicCountDates } from "../admin/clinic-remediation-missing.fixtures";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
type Role = "admin" | "teacher";

async function installApi(page: Page, role: Role) {
  const { today } = currentClinicCountDates();
  const sessions = [
    { id: 701, title: "기존 클리닉", start_time: "15:00:00", end_time: "16:00:00", booking_mode: "fixed_slot" },
    { id: 702, title: "자유지정 보충", start_time: "17:00:00", end_time: "21:00:00", booking_mode: "time_range" },
    { id: 703, title: "고정 보충", start_time: "21:00:00", end_time: "22:00:00", booking_mode: "fixed_slot" },
  ].map((session) => ({
    ...session, date: today, duration_minutes: session.id === 702 ? 240 : 60,
    location: "QA 학습실", max_participants: 8, participant_count: 1, booked_count: 1,
    booking_interval_minutes: 60, booking_max_stay_minutes: 180, is_full: false,
    allow_time_preference: session.id === 703, allow_multi_slot_booking: true,
  }));
  const oldBooking: Record<string, unknown> = {
    id: 801, session: 701, student: 901, student_name: "QA 일정 학생", status: "booked",
    session_date: today, session_title: "기존 클리닉", session_start_time: "15:00:00",
    session_end_time: "16:00:00", session_location: "QA 학습실", checked_in_at: null,
    checked_out_at: null, enrollment_id: 1001,
  };
  const state = {
    oldBooking,
    newBooking: null as Record<string, unknown> | null,
    failAvailability: false,
    failChange: false,
    changeStatus: 400,
    changes: [] as Array<Record<string, unknown>>,
    unexpectedWrites: [] as string[],
    releaseChange: undefined as (() => void) | undefined,
    holdChange: false,
  };
  const token = `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 71 })).toString("base64url")}.sig`;
  await page.addInitScript(({ jwt, currentRole }) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", jwt);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
    if (currentRole === "teacher") localStorage.setItem("teacher:preferAdmin", "0");
  }, { jwt: token, currentRole: role });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "QA 학원", ui_config: {}, feature_flags: {}, is_active: true });
    if (path === "/core/me/") return json({ id: 71, username: role, name: "QA 교직원", is_staff: true, is_superuser: role === "admin", tenantRole: role, must_change_password: false });
    if (path === "/clinic/settings/") return json({ capabilities: { booking_policy: { read: true, write: true }, student_operations: { read: true, write: true }, student_contacts: { read: true } } });
    if ((path === "/clinic/sessions/" || path === "/clinic/sessions/tree/") && method === "GET") return json(sessions);
    if (/^\/clinic\/sessions\/\d+\/$/.test(path) && method === "GET") return json(sessions.find((session) => path.includes(`/${session.id}/`)));
    if (path === "/clinic/sessions/702/availability/" && method === "GET") {
      if (state.failAvailability) return json({ detail: "시간 조회 실패" }, 503);
      return json({ interval_minutes: 60, max_stay_minutes: 180, window: { start_time: "17:00", end_time: "21:00" }, slots: [
        { start_time: "17:00", end_time: "18:00", remaining_capacity: 2 },
        { start_time: "18:00", end_time: "19:00", remaining_capacity: 2 },
        { start_time: "19:00", end_time: "20:00", remaining_capacity: 0 },
        { start_time: "20:00", end_time: "21:00", remaining_capacity: 1 },
      ] });
    }
    if (path === "/clinic/participants/" && method === "GET") {
      const sessionId = Number(url.searchParams.get("session") || url.searchParams.get("session_id"));
      const rows = [oldBooking, state.newBooking].filter((row) => row && row.status !== "cancelled" && (!sessionId || row.session === sessionId));
      return json({ count: rows.length, next: null, previous: null, results: rows });
    }
    if (path === "/clinic/participants/801/set_status/" && method === "PATCH") {
      oldBooking.status = request.postDataJSON().status;
      return json(oldBooking);
    }
    if (path === "/clinic/participants/801/change-booking/" && method === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.changes.push(payload);
      if (state.failChange) return json(state.changeStatus === 400
        ? { booking_time: ["선택한 예약 구간의 정원이 마감되었습니다."] }
        : { detail: "서버에 변경 내용을 저장하지 못했습니다." }, state.changeStatus);
      if (state.holdChange) await new Promise<void>((resolve) => { state.releaseChange = resolve; });
      const session = sessions.find((candidate) => candidate.id === payload.new_session_id)!;
      state.newBooking = {
        ...oldBooking, id: 802, session: session.id, status: "booked", session_title: session.title,
        session_start_time: session.start_time, session_end_time: session.end_time,
        booking_start_time: payload.booking_start_time, booking_end_time: payload.booking_end_time,
      };
      if (role === "admin") oldBooking.status = "cancelled";
      return json({ ...state.newBooking, notification: { requested: 0, failed: 0 } });
    }
    if (method !== "GET") state.unexpectedWrites.push(`${method} ${path}`);
    if (["/results/admin/clinic-targets/", "/lectures/sections/", "/staffs/currently-working/", "/messaging/auto-send/"].includes(path)) return json([]);
    return json({ count: 0, next: null, previous: null, results: [] });
  });
  return { state, today };
}

async function openChange(page: Page, role: Role) {
  await page.goto(`${BASE}${role === "admin" ? "/workspace/clinic/operations?session=701" : "/workspace/mobile/clinic"}`, { waitUntil: "domcontentloaded" });
  if (role === "admin") {
    if ((page.viewportSize()?.width ?? 1366) < 640) {
      await page.getByRole("group", { name: "QA 일정 학생 클리닉 운영 행" }).click();
    }
    await page.getByRole("button", { name: "일정 변경", exact: true }).first().click();
  } else {
    await page.getByRole("button", { name: /자유지정 보충/ }).click();
    await expect(page.getByText("참가자가 없습니다", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /기존 클리닉/ }).click();
    await page.getByRole("button", { name: "결석", exact: true }).click();
    await page.getByRole("dialog", { name: "결석 확인" }).getByRole("button", { name: "결석 확정" }).click();
  }
  return page.getByRole("dialog", { name: role === "admin" ? "클리닉 일정 변경" : "보충 일정 정하기", exact: true });
}

async function selectRange(dialog: Locator, start = "17:00", end = "19:00") {
  await dialog.getByRole("button", { name: new RegExp(`^${start} 시작,`) }).click();
  await dialog.getByRole("button", { name: new RegExp(`^${end} 종료,`) }).click();
}

test.use({ serviceWorkers: "block" });

for (const role of ["admin", "teacher"] as const) {
  for (const width of [1366, 390]) {
    test(`${role} 일정 변경은 실제 구간을 저장하고 실패 후 복구한다 ${width}px`, async ({ page }, info) => {
      const { state } = await installApi(page, role);
      state.failAvailability = true;
      await page.setViewportSize({ width, height: 844 });
      const dialog = await openChange(page, role);
      await dialog.getByLabel("이동할 일정").selectOption("702");
      const submit = dialog.getByRole("button", { name: role === "admin" ? "일정 변경" : "일정 이동", exact: true });
      await expect(dialog.getByText("시간 정보를 불러오지 못했습니다.")).toBeVisible();
      await expect(submit).toBeDisabled();
      state.failAvailability = false;
      await dialog.getByRole("button", { name: "다시 확인" }).click();
      await selectRange(dialog);
      await expect(dialog.getByRole("button", { name: /^19:00 시작,/ })).toBeDisabled();
      await expect(dialog.getByRole("button", { name: /^20:00 종료,/ })).toBeDisabled();
      state.failChange = true;
      await submit.click();
      await expect(dialog.getByRole("alert")).toContainText("예약 시간: 선택한 예약 구간의 정원이 마감되었습니다.");
      expect(state.newBooking).toBeNull();
      expect(state.oldBooking.status).toBe(role === "admin" ? "booked" : "no_show");
      await expect(dialog.getByRole("button", { name: /^17:00 시작,/ })).toHaveAttribute("aria-pressed", "true");
      await expect(dialog.getByRole("button", { name: /^19:00 종료,/ })).toHaveAttribute("aria-pressed", "true");
      state.changeStatus = 503;
      await submit.click();
      await expect(dialog.getByRole("alert")).toHaveText("서버에 변경 내용을 저장하지 못했습니다.");
      expect(state.newBooking).toBeNull();
      expect(state.oldBooking.status).toBe(role === "admin" ? "booked" : "no_show");
      await selectRange(dialog, "20:00", "21:00");
      state.failChange = false;
      state.holdChange = true;
      try {
        await submit.click();
        await expect(dialog.getByRole("button", { name: "변경 중…" })).toBeDisabled();
        await dialog.getByRole("button", { name: "닫기" }).evaluate((button: HTMLButtonElement) => button.click());
        await expect(dialog).toBeVisible();
        await expect.poll(() => state.changes.length).toBe(3);
        expect(state.changes[2]).toMatchObject({ new_session_id: 702, booking_start_time: "20:00", booking_end_time: "21:00", send_to: "parent" });
        expect(state.changes[2]).not.toHaveProperty("preferred_start_time");
        expect(await dialog.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight;
        })).toBe(true);
        await page.screenshot({ path: info.outputPath(`${role}-reschedule-${width}.png`) });
      } finally {
        state.releaseChange?.();
      }
      await expect(dialog).toBeHidden();
      expect(state.oldBooking.status).toBe(role === "admin" ? "cancelled" : "no_show");
      if (role === "admin") {
        await page.goto(`${BASE}/workspace/clinic/operations?session=702`, { waitUntil: "domcontentloaded" });
      } else {
        await page.getByRole("button", { name: /자유지정 보충/ }).click();
        await expect(page.getByText(/예약 20:00–21:00/).first()).toBeVisible();
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: /자유지정 보충/ }).click();
      }
      await expect(page.getByText("QA 일정 학생", { exact: true }).first()).toBeVisible();
      await expect(page.getByText(/예약 20:00–21:00/).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect(state.unexpectedWrites).toEqual([]);
    });
  }

  test(`${role} 고정 시간대 변경은 이전 실제 구간을 보내지 않고 취소는 저장하지 않는다`, async ({ page }) => {
    const { state } = await installApi(page, role);
    await page.setViewportSize({ width: 390, height: 844 });
    let dialog = await openChange(page, role);
    await dialog.getByLabel("이동할 일정").selectOption("702");
    await selectRange(dialog);
    await dialog.getByRole("button", { name: "닫기" }).click();
    await expect(dialog).toBeHidden();
    expect(state.changes).toEqual([]);
    expect(state.newBooking).toBeNull();
    // A teacher opens this sheet as the next step of marking an absence.
    // Reset only the mock fixture before starting that journey again.
    state.oldBooking.status = "booked";
    dialog = await openChange(page, role);
    await dialog.getByLabel("이동할 일정").selectOption("702");
    await selectRange(dialog);
    await dialog.getByLabel("이동할 일정").selectOption("703");
    await expect(dialog.getByRole("region", { name: "실제 예약 시간" })).toHaveCount(0);
    if (role === "teacher") {
      await dialog.getByLabel("희망 시작").fill("21:10");
      await dialog.getByLabel("희망 종료").fill("21:40");
    }
    await dialog.getByRole("button", { name: role === "admin" ? "일정 변경" : "일정 이동", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(state.changes).toHaveLength(1);
    expect(state.changes[0]).toMatchObject({ new_session_id: 703 });
    expect(state.changes[0]).not.toHaveProperty("booking_start_time");
    expect(state.changes[0]).not.toHaveProperty("booking_end_time");
    if (role === "teacher") expect(state.changes[0]).toMatchObject({ preferred_start_time: "21:10", preferred_end_time: "21:40" });
    expect(state.unexpectedWrites).toEqual([]);
  });
}
