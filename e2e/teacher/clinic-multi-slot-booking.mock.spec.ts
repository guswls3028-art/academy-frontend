import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    tenant_code: "hakwonplus",
    user_id: 71,
  })).toString("base64url");
  return `e30.${payload}.sig`;
}

test.use({
  viewport: { width: 390, height: 844 },
  serviceWorkers: "block",
});

test("선생님이 학생 여러 명을 17시부터 19시까지 두 시간대에 원자적으로 추가한다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const date = "2026-09-05";
  const sessions = [
    {
      id: 701,
      title: "오후 클리닉 A",
      date,
      start_time: "17:00:00",
      end_time: "18:00:00",
      duration_minutes: 60,
      location: "클리닉 1실",
      participant_count: 0,
      booked_count: 0,
      max_participants: 10,
      is_full: false,
      allow_multi_slot_booking: true,
    },
    {
      id: 702,
      title: "오후 클리닉 B",
      date,
      start_time: "18:00:00",
      end_time: "19:00:00",
      duration_minutes: 60,
      location: "클리닉 1실",
      participant_count: 0,
      booked_count: 0,
      max_participants: 10,
      is_full: false,
      allow_multi_slot_booking: true,
    },
    {
      id: 703,
      title: "오후 클리닉 C",
      date,
      start_time: "19:00:00",
      end_time: "20:00:00",
      duration_minutes: 60,
      location: "클리닉 1실",
      participant_count: 0,
      booked_count: 0,
      max_participants: 10,
      is_full: false,
      allow_multi_slot_booking: false,
    },
    {
      id: 705,
      title: "야간 클리닉",
      date,
      start_time: "21:00:00",
      end_time: "22:00:00",
      duration_minutes: 60,
      location: "클리닉 1실",
      participant_count: 0,
      booked_count: 0,
      max_participants: 10,
      is_full: false,
      allow_multi_slot_booking: true,
    },
    {
      id: 706,
      title: "자유 운영 클리닉",
      date,
      start_time: "09:00:00",
      end_time: "17:00:00",
      duration_minutes: 480,
      location: "클리닉 2실",
      participant_count: 0,
      booked_count: 0,
      max_participants: 2,
      is_full: false,
      allow_multi_slot_booking: false,
      booking_mode: "time_range",
      booking_interval_minutes: 30,
      booking_max_stay_minutes: 180,
    },
  ];
  const students = [
    { id: 801, name: "김학생", grade: 2, school: "가람중", is_managed: true },
    { id: 802, name: "이학생", grade: 2, school: "나래중", is_managed: true },
    { id: 803, name: "정학생", grade: 2, school: "다온중", is_managed: true },
  ];
  const participants = new Map<number, Array<Record<string, unknown>>>([
    [701, [{
      id: 900,
      session: 701,
      student: 803,
      student_name: "정학생",
      status: "booked",
      preferred_start_time: "17:15:00",
      preferred_end_time: "17:45:00",
      booking_start_time: "17:00:00",
      booking_end_time: "18:00:00",
      student_request_memo: "오답 정리 뒤 참여",
    }]],
    [702, []],
    [703, []],
    [705, []],
  ]);
  const bulkPayloads: unknown[] = [];
  const createdSessionPayloads: unknown[] = [];
  let retrySearchRequests = 0;
  let releaseStudents: (() => void) | undefined;
  const studentsGate = new Promise<void>((resolve) => {
    releaseStudents = resolve;
  });
  let releaseSettings: (() => void) | undefined;
  const settingsGate = new Promise<void>((resolve) => {
    releaseSettings = resolve;
  });

  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", token);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
    localStorage.setItem("teacher:preferAdmin", "0");
  }, fakeJwt());

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 71,
        username: "teacher",
        name: "담당 선생님",
        is_staff: true,
        is_superuser: false,
        tenantRole: "teacher",
        must_change_password: false,
      });
    }
    if (path === "/clinic/settings/" && request.method() === "GET") {
      await settingsGate;
      return json({ multi_slot_booking_default: false });
    }
    if (path === "/clinic/sessions/" && request.method() === "GET") return json(sessions);
    if (path === "/clinic/sessions/" && request.method() === "POST") {
      const payload = request.postDataJSON();
      createdSessionPayloads.push(payload);
      return json({ id: 704, ...payload }, 201);
    }
    if (path === "/clinic/sessions/706/availability/" && request.method() === "GET") {
      return json({
        booking_mode: "time_range",
        interval_minutes: 30,
        max_stay_minutes: 180,
        window: { start_time: "09:00", end_time: "17:00" },
        slots: [
          { start_time: "10:00", end_time: "10:30", remaining_capacity: 2 },
          { start_time: "10:30", end_time: "11:00", remaining_capacity: 2 },
          { start_time: "11:00", end_time: "11:30", remaining_capacity: 1 },
        ],
      });
    }
    if (path === "/students/" && request.method() === "GET") {
      if (!url.searchParams.get("search")) await studentsGate;
      if (url.searchParams.get("search") === "retry") {
        retrySearchRequests += 1;
        if (retrySearchRequests <= 3) {
          return json({ detail: "temporary failure" }, 503);
        }
      }
      if (url.searchParams.get("search") === "missing") {
        return json({ count: 0, results: [] });
      }
      return json({ count: students.length, results: students });
    }
    if (path === "/clinic/participants/" && request.method() === "GET") {
      const sessionId = Number(url.searchParams.get("session"));
      const rows = participants.get(sessionId) ?? [];
      return json({ count: rows.length, results: rows });
    }
    if (path === "/clinic/participants/bulk-create/" && request.method() === "POST") {
      const payload = request.postDataJSON() as {
        session_ids: number[];
        student_ids: number[];
        booking_start_time?: string;
        booking_end_time?: string;
      };
      bulkPayloads.push(payload);
      const created = payload.student_ids.flatMap((studentId) => payload.session_ids.map((sessionId) => {
        const student = students.find((item) => item.id === studentId)!;
        const row = {
          id: sessionId * 1000 + studentId,
          session: sessionId,
          student: studentId,
          student_name: student.name,
          status: "booked",
          booking_start_time: payload.booking_start_time ?? null,
          booking_end_time: payload.booking_end_time ?? null,
        };
        participants.set(sessionId, [...(participants.get(sessionId) ?? []), row]);
        return row;
      }));
      return json({ count: created.length, participants: created }, 201);
    }
    return json({ count: 0, results: [] });
  });

  await page.goto(`${BASE}/workspace/mobile/clinic`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  const firstSessionButton = page.getByRole("button", { name: /오후 클리닉 A/ });
  await expect(firstSessionButton).toBeVisible({ timeout: 30_000 });
  await firstSessionButton.click();
  await expect(page.getByText("희망 17:15–17:45")).toBeVisible();
  await expect(page.getByText("예약 17:00–18:00")).toBeVisible();
  await expect(page.getByText("오답 정리 뒤 참여")).toBeVisible();
  const addStudentTrigger = page.getByRole("button", { name: "학생 추가" });
  await addStudentTrigger.click();

  const sheet = page.getByRole("dialog", { name: "학생 추가" });
  await expect(sheet.getByPlaceholder("학생 이름/전화 검색")).toBeFocused();
  await expect(sheet.getByText("학생 목록을 불러오는 중...")).toBeVisible();
  releaseStudents?.();
  await expect(sheet.getByRole("button", { name: /김학생/ })).toBeVisible();
  expect(await sheet.evaluate((element) => ({
    animationName: getComputedStyle(element).animationName,
    transform: getComputedStyle(element).transform,
  }))).toEqual({ animationName: "none", transform: "none" });
  const backdrop = sheet.locator("xpath=preceding-sibling::div[1]");
  const mobileSheetBox = await sheet.boundingBox();
  const mobileBackdropBox = await backdrop.boundingBox();
  expect(mobileSheetBox?.x).toBe(0);
  expect(mobileSheetBox?.width).toBe(390);
  expect(mobileBackdropBox?.x).toBe(0);
  expect(mobileBackdropBox?.width).toBe(390);
  await expect(sheet.getByRole("button", { name: /19:00–20:00 · 한 타임/ })).toBeDisabled();
  await sheet.getByRole("button", { name: /21:00–22:00/ }).click();
  await expect(sheet.getByRole("region", { name: "선택한 클리닉 시간" })).toContainText("17:00–18:00");
  await expect(page.getByText("이어진 시간대만 함께 선택할 수 있습니다.")).toBeVisible();
  await sheet.getByRole("button", { name: /18:00–19:00/ }).click();
  await expect(sheet.getByRole("region", { name: "선택한 클리닉 시간" })).toContainText("17:00–19:00");
  await sheet.getByRole("button", { name: /김학생/ }).click();
  await sheet.getByPlaceholder("학생 이름/전화 검색").fill("retry");
  await expect.poll(() => retrySearchRequests).toBe(3);
  await expect(sheet.getByText("학생 목록을 불러오지 못했습니다")).toBeVisible();
  await expect(sheet.getByText("추가 가능한 학생이 없습니다")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "1명을 2개 시간대에 추가" })).toBeVisible();
  await sheet.getByRole("button", { name: "다시 시도" }).click();
  await expect.poll(() => retrySearchRequests).toBe(4);
  await expect(sheet.getByRole("button", { name: /김학생/ })).toBeVisible();
  await expect(sheet.getByRole("region", { name: "선택한 클리닉 시간" })).toContainText("17:00–19:00");
  await expect(sheet.getByRole("button", { name: "1명을 2개 시간대에 추가" })).toBeVisible();
  await sheet.getByRole("button", { name: /김학생/ }).click();
  await sheet.getByPlaceholder("학생 이름/전화 검색").fill("missing");
  await expect(sheet.getByText("검색 결과 없음")).toBeVisible();
  await expect(sheet.getByText("학생 목록을 불러오지 못했습니다")).toHaveCount(0);
  await sheet.getByPlaceholder("학생 이름/전화 검색").fill("");
  await expect(sheet.getByRole("button", { name: /김학생/ })).toBeVisible();
  expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/teacher-clinic-multi-slot-390.png", fullPage: true });

  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(sheet.getByRole("region", { name: "선택한 클리닉 시간" })).toContainText("17:00–19:00");
  const sidebarWidth = await page.evaluate(() => Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--tc-sidebar-w"),
  ));
  const desktopSheetBox = await sheet.boundingBox();
  const desktopBackdropBox = await backdrop.boundingBox();
  const titleBox = await sheet.getByText("학생 추가", { exact: true }).boundingBox();
  const timeRailBox = await sheet.getByRole("region", { name: "선택한 클리닉 시간" }).boundingBox();
  expect(desktopSheetBox?.x).toBe(sidebarWidth);
  expect(desktopBackdropBox?.x).toBe(sidebarWidth);
  expect(desktopSheetBox?.width).toBe(1100 - sidebarWidth);
  expect(desktopBackdropBox?.width).toBe(1100 - sidebarWidth);
  expect(titleBox?.x).toBeGreaterThanOrEqual(sidebarWidth);
  expect(timeRailBox?.x).toBeGreaterThanOrEqual(sidebarWidth);
  expect((timeRailBox?.x ?? 0) + (timeRailBox?.width ?? 0)).toBeLessThanOrEqual(1100);
  expect(await sheet.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await backdrop.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/teacher-clinic-multi-slot-1100.png", fullPage: true });

  await backdrop.click({ position: { x: 12, y: 12 } });
  await expect(sheet).toBeVisible();
  const closeButton = sheet.getByRole("button", { name: "닫기" });
  await closeButton.focus();
  await page.keyboard.press("Shift+Tab");
  expect(await sheet.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await expect(closeButton).not.toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(addStudentTrigger).toBeFocused();
  await addStudentTrigger.click();
  const reopenedSheet = page.getByRole("dialog", { name: "학생 추가" });
  await reopenedSheet.getByRole("button", { name: /18:00–19:00/ }).click();

  await reopenedSheet.getByRole("button", { name: /김학생/ }).click();
  await reopenedSheet.getByRole("button", { name: /이학생/ }).click();
  await reopenedSheet.getByRole("button", { name: "2명을 2개 시간대에 추가" }).click();

  await expect.poll(() => bulkPayloads).toEqual([{
    session_ids: [701, 702],
    student_ids: [801, 802],
  }]);
  await expect(page.getByText("2명이 2개 시간대에 추가되었습니다.")).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(firstSessionButton).toBeVisible({ timeout: 30_000 });
  await firstSessionButton.click();
  await expect(page.getByText("김학생", { exact: true })).toBeVisible();
  await expect(page.getByText("이학생", { exact: true })).toBeVisible();
  expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  const freeTimeSessionButton = page.getByRole("button", { name: /자유 운영 클리닉/ });
  await expect(freeTimeSessionButton).toContainText("운영 09:00–17:00");
  await freeTimeSessionButton.click();
  await page.getByRole("button", { name: "학생 추가" }).click();
  const rangeSheet = page.getByRole("dialog", { name: "학생 추가" });
  await expect(rangeSheet.getByRole("heading", { name: "실제 이용 시간 선택" })).toBeVisible();
  await expect(rangeSheet.getByText("운영 시간", { exact: true }).first()).toBeVisible();
  await expect(rangeSheet.getByText("추가할 시간대", { exact: true })).toHaveCount(0);
  await expect(rangeSheet.getByText(/한 타임|개 시간대/)).toHaveCount(0);
  await rangeSheet.getByRole("button", { name: /김학생/ }).click();
  await rangeSheet.getByRole("button", { name: /이학생/ }).click();
  const rangeStartButton = rangeSheet.getByRole("button", { name: "10:00 시작, 잔여 2자리" });
  await rangeStartButton.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  expect(await rangeStartButton.evaluate((element) => ({
    outlineStyle: getComputedStyle(element).outlineStyle,
    outlineWidth: getComputedStyle(element).outlineWidth,
  }))).toEqual({ outlineStyle: "solid", outlineWidth: "3px" });
  await rangeStartButton.click();
  await expect(rangeSheet.getByRole("button", { name: "11:30 종료, 2명 선택에는 구간 잔여가 부족" })).toBeDisabled();
  await expect(rangeSheet).toContainText("2명 선택에는 부족");
  await rangeSheet.getByRole("button", { name: "11:00 종료, 총 1시간" }).click();
  await rangeSheet.getByRole("button", { name: "2명 추가" }).click();
  await expect.poll(() => bulkPayloads[1]).toEqual({
    session_ids: [706],
    student_ids: [801, 802],
    booking_start_time: "10:00",
    booking_end_time: "11:00",
  });
  await expect(page.getByText("예약 10:00–11:00")).toHaveCount(2);
  expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.getByRole("button", { name: /자유 운영 클리닉/ }).click();
  await expect(page.getByText("예약 10:00–11:00")).toHaveCount(2);
  expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await page.getByRole("button", { name: "클리닉 만들기" }).click();
  const createSheet = page.getByRole("dialog", { name: "클리닉 만들기" });
  await createSheet.getByRole("button", { name: /시간지정 클리닉/ }).click();
  let multiSlotToggle = createSheet.getByRole("checkbox", { name: /같은 날 여러 시간대 예약/ });
  let timePreferenceToggle = createSheet.getByRole("checkbox", { name: /학생 희망 시간 받기/ });
  await expect(multiSlotToggle).not.toBeChecked();
  await expect(timePreferenceToggle).not.toBeChecked();
  await timePreferenceToggle.check();
  await createSheet.getByRole("button", { name: "방식 다시 선택" }).click();
  await createSheet.getByRole("button", { name: /자유지정 클리닉/ }).click();
  await expect(createSheet.getByText("학생이 예약 가능한 실제 시작·종료 시간을 직접 선택합니다.")).toBeVisible();
  await expect(timePreferenceToggle).toHaveCount(0);
  const timeInputs = createSheet.locator('input[type="time"]');
  await timeInputs.first().fill("23:00");
  await timeInputs.nth(1).fill("01:00");
  await createSheet.getByPlaceholder("예: 3층 자습실").fill("심야 자습실");
  await expect(createSheet.getByText("익일 종료는 자정(00:00)까지만 지원합니다. 종료 시간을 같은 날 또는 00:00으로 선택해 주세요.")).toBeVisible();
  await expect(createSheet.getByRole("button", { name: "생성", exact: true })).toBeDisabled();
  await timeInputs.first().fill("18:00");
  await timeInputs.nth(1).fill("00:00");
  await expect(createSheet.getByRole("button", { name: "생성", exact: true })).toBeEnabled();
  await createSheet.getByRole("button", { name: "방식 다시 선택" }).click();
  await createSheet.getByRole("button", { name: /시간지정 클리닉/ }).click();
  multiSlotToggle = createSheet.getByRole("checkbox", { name: /같은 날 여러 시간대 예약/ });
  timePreferenceToggle = createSheet.getByRole("checkbox", { name: /학생 희망 시간 받기/ });
  await expect(timePreferenceToggle).not.toBeChecked();
  await multiSlotToggle.check();
  await timePreferenceToggle.check();
  releaseSettings?.();
  await expect(multiSlotToggle).toBeChecked();
  await createSheet.locator('input[type="time"]').first().fill("17:00");
  await createSheet.getByPlaceholder("예: 3층 자습실").fill("클리닉 2실");
  await createSheet.getByRole("button", { name: "생성", exact: true }).click();
  await expect.poll(() => createdSessionPayloads).toEqual([
    expect.objectContaining({
      allow_multi_slot_booking: true,
      allow_time_preference: true,
      start_time: "17:00:00",
      location: "클리닉 2실",
    }),
  ]);
});
