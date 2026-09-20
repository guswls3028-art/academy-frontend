import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function fakeJwt(role: "admin" | "teacher" | "student"): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    tenant_code: "limglish",
    user_id: role === "student" ? 703 : 71,
  })).toString("base64url");
  return `e30.${payload}.sig`;
}

function dateAfter(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function installApi(
  page: Page,
  role: "admin" | "teacher" | "student",
  createPayloads: Array<Record<string, unknown>> = [],
  overnight = false,
) {
  const date = overnight ? "2026-08-31" : dateAfter(4);
  const endDate = overnight ? "2026-09-01" : dateAfter(5);
  let booking: Record<string, unknown> | null = null;
  const timeRangeSession = {
    id: 910,
    title: "림글리쉬 야간 자율 클리닉",
    date,
    start_time: overnight ? "23:00:00" : "18:00:00",
    end_time: overnight ? "01:00:00" : "00:00:00",
    end_date: endDate,
    duration_minutes: overnight ? 120 : 360,
    location: "자율 학습실",
    max_participants: 8,
    participant_count: 0,
    booked_count: 0,
    available_slots: 8,
    is_full: false,
    booking_mode: "time_range",
    booking_interval_minutes: 60,
    booking_max_stay_minutes: 600,
    allow_multi_slot_booking: false,
    allow_time_preference: false,
    target_lecture_names: [],
  };
  await page.addInitScript(({ token, currentRole }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", token);
    localStorage.setItem("tenant_code", "limglish");
    sessionStorage.setItem("tenantCode", "limglish");
    if (currentRole === "teacher") localStorage.setItem("teacher:preferAdmin", "0");
  }, { token: fakeJwt(role), currentRole: role });

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({
      tenantCode: "limglish",
      display_name: "림글리쉬",
      ui_config: {},
      feature_flags: {},
      is_active: true,
    });
    if (path === "/core/me/") return json({
      id: role === "student" ? 703 : 71,
      username: role,
      name: role === "student" ? "QA 학생" : "QA 선생님",
      is_staff: role !== "student",
      is_superuser: role === "admin",
      tenantRole: role,
      linkedStudentId: role === "student" ? 1703 : undefined,
      linkedStudentName: role === "student" ? "QA 학생" : undefined,
      must_change_password: false,
    });
    if (path === "/clinic/settings/" && request.method() === "GET") return json({
      colors: ["#1a2e47", "#5b8cb8", "#dbeafe"],
      saved_colors: ["#1a2e47", "#5b8cb8", "#dbeafe"],
      use_daily_random: false,
      auto_approve_booking: true,
      multi_slot_booking_default: false,
      booking_mode: "time_range",
      booking_interval_minutes: 60,
      booking_max_stay_minutes: 600,
      capabilities: {
        booking_policy: { read: true, write: role === "admin" },
        student_operations: { read: role !== "student", write: role !== "student" },
        student_contacts: { read: role !== "student" },
      },
    });
    if (path === "/clinic/sessions/" && request.method() === "GET") {
      return json((role === "student" || overnight) && (url.searchParams.get("date_from") ?? "") <= date ? [timeRangeSession, ...(overnight ? [{ ...timeRangeSession, id: 912, title: "이미 끝난 전날 클리닉", start_time: "20:00:00", end_time: "22:00:00", end_date: date, duration_minutes: 120 }] : [])] : []);
    }
    if (path === "/clinic/sessions/tree/" && request.method() === "GET") return json([]);
    if (path === "/clinic/sessions/" && request.method() === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      createPayloads.push(payload);
      return json({ id: 911, ...payload }, 201);
    }
    if (path === "/clinic/sessions/910/availability/" && request.method() === "GET") return json({
      booking_mode: "time_range",
      interval_minutes: overnight ? 30 : 60,
      max_stay_minutes: 600,
      window: overnight ? { start_time: "23:00", end_time: "01:00", start_date: date, end_date: endDate } : { start_time: "18:00", end_time: "00:00" },
      slots: (overnight ? [["23:00", "23:30"], ["23:30", "00:00"], ["00:00", "00:30"], ["00:30", "01:00"]] : [
        ["18:00", "19:00"],
        ["19:00", "20:00"],
        ["20:00", "21:00"],
        ["21:00", "22:00"],
        ["22:00", "23:00"],
        ["23:00", "00:00"],
      ]).map(([start_time, end_time]) => ({ start_time, end_time, remaining_capacity: 5, ...(overnight ? { start_date: start_time < "23:00" ? endDate : date, end_date: end_time < "23:00" ? endDate : date } : {}) })),
    });
    if (path === "/clinic/participants/" && request.method() === "GET") {
      return json({ count: booking ? 1 : 0, next: null, previous: null, results: booking ? [booking] : [] });
    }
    if (path === "/clinic/participants/bulk-create/" && request.method() === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      createPayloads.push(payload);
      booking = { id: 1901, session: 910, session_title: timeRangeSession.title, session_date: date, session_start_time: timeRangeSession.start_time, session_location: "자율 학습실", status: "booked", booking_start_time: payload.booking_start_time, booking_end_time: payload.booking_end_time, booking_start_date: String(payload.booking_start_time) < timeRangeSession.start_time.slice(0, 5) ? endDate : date, booking_end_date: String(payload.booking_end_time) < timeRangeSession.start_time.slice(0, 5) ? endDate : date, created_at: "2026-09-01T00:30:00+09:00", can_self_cancel: true };
      return json({ count: 1, participants: [{ id: 1901, status: "booked" }] }, 201);
    }
    if (path === "/clinic/idcard/" && request.method() === "GET") return json({ result: "FAIL" });
    if (path === "/lectures/lectures/" || path === "/lectures/sections/" || path === "/staffs/currently-working/") return json([]);
    if (path === "/students/" && request.method() === "GET") return json({ count: 0, results: [] });
    return json({ count: 0, next: null, previous: null, results: [] });
  });
  return { date };
}

test.use({ serviceWorkers: "block" });

test("선생님은 클리닉 방식부터 고르고 자유지정 운영 시간을 만든다", async ({ page }, testInfo) => {
  const payloads: Array<Record<string, unknown>> = [];
  await installApi(page, "teacher", payloads);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/workspace/mobile/clinic`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "클리닉 만들기" }).click();
  const sheet = page.getByRole("dialog", { name: "클리닉 만들기" });
  const chooser = sheet.getByRole("group", { name: "클리닉 예약 방식" });
  await expect(chooser.getByRole("button", { name: /시간지정 클리닉/ })).toContainText("정해진 한 타임");
  await expect(chooser.getByRole("button", { name: /자유지정 클리닉/ })).toContainText("등원·하원 시간을 선택");
  await expect(sheet.locator('input[type="time"]')).toHaveCount(0);
  await sheet.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const choiceBoxes = await chooser.getByRole("button").evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
  }));
  expect(
    choiceBoxes.every((box) => box.top >= 0 && box.bottom <= 844 && box.left >= 0 && box.right <= 390),
    JSON.stringify(choiceBoxes),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("teacher-mode-choice-390.png"), fullPage: true });

  await chooser.getByRole("button", { name: /자유지정 클리닉/ }).click();
  await expect(sheet).toContainText("선택한 방식 · 자유지정 클리닉");
  await expect(sheet.getByRole("button", { name: "방식 다시 선택" })).toBeVisible();
  await sheet.locator('input[type="time"]').nth(0).fill("23:00");
  await sheet.locator('input[type="time"]').nth(1).fill("01:00");
  await sheet.getByPlaceholder("예: 3층 자습실").fill("자율 학습실");
  await sheet.getByRole("button", { name: "생성", exact: true }).click();
  await expect.poll(() => payloads).toEqual([expect.objectContaining({
    start_time: "23:00:00",
    duration_minutes: 120,
    booking_mode: "time_range",
    booking_interval_minutes: 60,
    booking_max_stay_minutes: 600,
    allow_multi_slot_booking: false,
  })]);
});

test("관리자 생성 모달의 두 방식은 데스크톱과 모바일에서 잘리지 않는다", async ({ page }, testInfo) => {
  await installApi(page, "admin");
  await page.setViewportSize({ width: 1366, height: 850 });
  await page.goto(`${BASE}/workspace/clinic/schedule`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "클리닉 만들기", exact: true }).first().click();
  const dialog = page.getByRole("dialog").filter({ hasText: "클리닉 만들기" });
  const chooser = dialog.getByRole("group", { name: "클리닉 예약 방식" });
  await expect(chooser.getByRole("button")).toHaveCount(2);
  const boxes = await chooser.getByRole("button").evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  expect(boxes.every((box) => box.left >= 0 && box.right <= 1366 && box.bottom <= 850)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("admin-mode-choice-1366.png"), fullPage: false });

  await chooser.getByRole("button", { name: /시간지정 클리닉/ }).click();
  await expect(dialog).toContainText("선택한 방식 · 시간지정 클리닉");
  await expect(dialog.getByText("같은 날 여러 시간대 예약")).toBeVisible();
  await dialog.getByRole("button", { name: "방식 다시 선택" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(page.getByRole("main")).toBeVisible();
  await page.getByRole("button", { name: "클리닉 만들기", exact: true }).first().click();
  const mobileDialog = page.getByRole("dialog").filter({ hasText: "클리닉 만들기" });
  const mobileChooser = mobileDialog.getByRole("group", { name: "클리닉 예약 방식" });
  await expect(mobileChooser.getByRole("button")).toHaveCount(2);
  await mobileDialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
  });
  await expect(mobileDialog).toBeVisible();
  await expect(mobileChooser.getByRole("button")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("admin-mode-choice-390.png"), fullPage: false });
});

test("관리자 운영 화면은 만들기 창을 닫았다 다시 열어도 방식 선택부터 시작한다", async ({ page }) => {
  await installApi(page, "admin");
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto(`${BASE}/workspace/clinic/operations`, { waitUntil: "domcontentloaded" });
  const openCreate = page.getByTitle("클리닉 만들기").first();
  await openCreate.click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /시간지정 클리닉/ }).click();
  await expect(dialog).toContainText("선택한 방식 · 시간지정 클리닉");
  await expect(dialog.getByRole("button", { name: "시작 시간" })).toBeVisible();
  await dialog.getByRole("button", { name: "대화상자 종료" }).click();
  await expect(dialog).toBeHidden();

  await openCreate.click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("group", { name: "클리닉 예약 방식" })).toBeVisible();
  await expect(dialog.locator('input[type="time"]')).toHaveCount(0);
});

test("학생은 자정 종료까지 선택한 구간을 연결된 시간 막대로 확인한다", async ({ page }, testInfo) => {
  const payloads: Array<Record<string, unknown>> = [];
  const { date } = await installApi(page, "student", payloads);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });
  await page.getByTestId(`clinic-calendar-day-${date}`).click();
  const scrollBeforeCta = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeCta);
  const pickerCta = page.getByRole("button", { name: "아래에서 시간 선택" });
  await expect(pickerCta).toBeVisible();
  await pickerCta.click();
  const pickerHeading = page.getByRole("heading", { name: "실제 이용 시간 선택" });
  await expect(pickerHeading).toBeFocused();
  const pickerHeadingBox = await pickerHeading.boundingBox();
  expect(pickerHeadingBox?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((pickerHeadingBox?.y ?? 845) + (pickerHeadingBox?.height ?? 0)).toBeLessThanOrEqual(844);
  const selection = page.getByRole("region", { name: "선택한 클리닉 시간" });
  await selection.getByRole("button", { name: "21:00 시작, 잔여 5자리" }).click();
  await selection.getByRole("button", { name: "익일 00:00 종료, 총 3시간" }).click();
  await expect(selection.locator("strong").first()).toHaveText("21:00–익일 00:00");
  const rail = selection.getByRole("img", {
    name: "운영 시간 18:00부터 00:00, 선택 21:00부터 00:00",
  });
  await expect(rail).toBeVisible();
  const railBox = await rail.boundingBox();
  const selectedBox = await rail.getByTestId("clinic-time-range-selection").boundingBox();
  expect(railBox).not.toBeNull();
  expect(selectedBox).not.toBeNull();
  expect(selectedBox!.x).toBeGreaterThan(railBox!.x);
  expect(selectedBox!.x + selectedBox!.width).toBeLessThanOrEqual(railBox!.x + railBox!.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("student-midnight-range-390.png"), fullPage: true });

  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(rail).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("student-midnight-range-1100.png"), fullPage: true });
  await selection.getByRole("button", { name: "이 일정 예약하기" }).click();
  await expect.poll(() => payloads).toContainEqual({
    session_ids: [910],
    booking_start_time: "21:00",
    booking_end_time: "00:00",
  });
});

for (const width of [1366, 390]) {
  test(`자정 이후 학생은 전날 진행 중인 클리닉의 실제 날짜로 예약하고 재조회한다 (${width}px)`, async ({ page }, testInfo) => {
    await page.clock.install({ time: new Date("2026-09-01T00:30:00") });
    const payloads: Array<Record<string, unknown>> = [];
    await installApi(page, "student", payloads, true);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("이미 끝난 전날 클리닉")).toHaveCount(0);
    await page.getByTestId("clinic-calendar-day-2026-08-31").click();
    await expect(page.getByText(/전날 시작·진행 중/)).toBeVisible();
    await page.getByRole("button", { name: "아래에서 시간 선택" }).click();
    const picker = page.getByRole("region", { name: "선택한 클리닉 시간" });
    // The existing whole-window policy remains available, including earlier slots.
    await expect(picker.getByRole("button", { name: "23:00 시작, 잔여 5자리" })).toBeEnabled();
    await picker.getByRole("button", { name: "2026-09-01 00:30 시작, 잔여 5자리" }).click();
    await picker.getByRole("button", { name: "2026-09-01 01:00 종료, 총 30분" }).click();
    await page.screenshot({ path: testInfo.outputPath(`overnight-student-selection-${width}.png`), fullPage: true });
    await picker.getByRole("button", { name: "이 일정 예약하기" }).click();
    await expect.poll(() => payloads).toContainEqual({ session_ids: [910], booking_start_time: "00:30", booking_end_time: "01:00" });
    await page.getByRole("tab", { name: /내 일정/ }).click();
    await expect(page.getByText("이용 2026-09-01 00:30–01:00")).toBeVisible();
    // Discovery eligibility may change after booking; saved bookings remain authoritative.
    await page.route("**/api/v1/clinic/sessions/?*", (route) => route.fulfill({ json: [] }));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: /내 일정/ }).click();
    await expect(page.getByText("이용 2026-09-01 00:30–01:00")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`overnight-student-booked-${width}.png`), fullPage: true });
    await page.clock.setSystemTime(new Date("2026-09-01T01:01:00"));
    await page.clock.fastForward(30_000);
    await expect(page.getByText("이용 2026-09-01 00:30–01:00")).toHaveCount(0);
  });
}

test("교사는 전날 진행 중 조회 실패를 재시도하고 운영일로 이동한다", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-09-01T00:30:00"));
  await installApi(page, "teacher", [], true);
  let fail = true;
  await page.route("**/api/v1/clinic/sessions/?*", (route) => {
    if (new URL(route.request().url()).searchParams.get("date_from") === "2026-08-31" && fail) {
      return route.fulfill({ status: 503, json: { detail: "일시적으로 확인할 수 없습니다." } });
    }
    return route.fallback();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/workspace/mobile/clinic`, { waitUntil: "domcontentloaded" });
  const error = page.getByRole("alert").filter({ hasText: "전날 진행 중인 클리닉을 확인하지 못했습니다." });
  await expect(error).toBeVisible();
  fail = false;
  await error.getByRole("button", { name: "다시 확인" }).click();
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "전날 시작·진행 중 · 2026-08-31 23:00" }).click();
    await expect(page.locator('input[type="date"]').first()).toHaveValue("2026-08-31");
    await expect(page.getByText("운영 23:00–2026-09-01 01:00")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`overnight-teacher-discovery-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.reload({ waitUntil: "domcontentloaded" });
  }
});
