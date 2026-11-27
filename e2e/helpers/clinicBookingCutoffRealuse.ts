import { expect } from "@playwright/test";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
import {
  api, assertQaStudentParentRuntime, expectApi, QA_BASE, reloadStudentApp,
  type QaStudent, type QaTokens,
} from "./qaStudentParentScenario";
import { gotoAndSettle, waitForCondition } from "./wait";

type Policy = { booking_cutoff_mode: string; booking_cutoff_minutes: number; booking_cutoff_time: string; allow_late_requests: boolean };
type Args = {
  page: Page; teacherPage: Page; request: APIRequestContext; testInfo: TestInfo;
  student: QaStudent; studentTokens: QaTokens; adminAccess: string; date: string;
};

type Recipient = { type: "parent" | "student" | "clinic_teacher"; id: number; phone: string };
type Delivery = {
  id: number; notification_type: string; origin_id: string; success: boolean; provider_message_id: string;
  message_mode: string; recipient_summary: string; current_recipient_phone: string; target_type: string; target_id: string;
};

async function verifyDeliveries(request: APIRequestContext, admin: string, origin: string, recipients: Recipient[], memo: string) {
  let rows: Delivery[] = [];
  const query = new URLSearchParams({ scope: "clinic", origin_id_prefix: origin, page_size: "50" });
  await waitForCondition(async () => {
    const page = await expectApi<{ results: Delivery[] }>(request, "GET", `/messaging/log/?${query}`, admin);
    rows = page.results.filter((row) => row.origin_id === origin && row.notification_type === "clinic_reservation_created");
    return rows.length >= recipients.length && rows.every((row) => row.success);
  }, { timeoutMs: 90_000, intervalMs: 1_000, description: "clinic reservation mock delivery logs" });
  expect(rows.map((row) => row.target_type).sort()).toEqual(recipients.map((recipient) => recipient.type).sort());
  for (const recipient of recipients) {
    const row = rows.find((item) => item.target_type === recipient.type)!;
    expect(row).toMatchObject({ target_id: String(recipient.id), success: true, message_mode: "alimtalk" });
    expect(row.provider_message_id).toMatch(/^mock-/);
    expect(row.recipient_summary).toContain(recipient.phone.slice(0, 4) + "****");
    if (recipient.type !== "clinic_teacher") expect(row.current_recipient_phone).toBe(recipient.phone);
    const detail = await expectApi<{ message_body: string }>(request, "GET", `/messaging/log/${row.id}/`, admin);
    expect(detail.message_body).toContain(memo);
  }
  return rows.map((row) => ({ role: row.target_type, logId: row.id, provider: "mock" }));
}

// Runs inside the existing guarded student/parent canary, after its ordinary auto-approved journey.
export async function verifyClinicCutoffRealuse({ page, teacherPage, request, testInfo, student, studentTokens, adminAccess, date }: Args) {
  assertQaStudentParentRuntime();
  const saved = await expectApi<Policy>(request, "GET", "/clinic/settings/", adminAccess);
  const original = {
    booking_cutoff_mode: saved.booking_cutoff_mode, booking_cutoff_minutes: saved.booking_cutoff_minutes,
    booking_cutoff_time: saved.booking_cutoff_time, allow_late_requests: saved.allow_late_requests,
  };
  expect(original.booking_cutoff_mode).toBeDefined();
  const stamp = Date.now();
  const title = `QA 추가 신청 ${stamp}`;
  const name = `QA 클리닉 참조 ${stamp}`;
  let sessionId: number | undefined;
  let staffId: number | undefined;
  let participantId: number | undefined;
  const errors: unknown[] = [];
  try {
    await teacherPage.setViewportSize({ width: 1366, height: 900 });
    const contacts = await expectApi<{ phone: string; parent_phone: string }>(request, "GET", `/students/${student.id}/`, adminAccess);
    const phones = [contacts.phone, contacts.parent_phone].map((phone) => phone.replace(/\D/g, ""));
    const teacherPhone = ["01097", "01096", "01095"].map((prefix) => prefix + String(stamp).slice(-6))
      .find((phone) => !phones.includes(phone))!;
    expect(new Set([...phones, teacherPhone]).size).toBe(3);
    expect([...phones, teacherPhone].every((phone) => /^010\d{8}$/.test(phone))).toBe(true);
    const staff = await expectApi<{ id: number; phone: string }>(request, "POST", "/staffs/", adminAccess, {
      name, role: "TEACHER", username: `qa-clinic-notice-${stamp}`, phone: teacherPhone,
      password: student.password, is_manager: false,
    }, [201]);
    staffId = staff.id;
    expect(staff.phone.replace(/\D/g, "")).toBe(teacherPhone);
    const teachers = await expectApi<Array<{ id: number; name: string }>>(request, "GET", "/clinic/sessions/notification-teachers/", adminAccess);
    const recipient = teachers.find((teacher) => teacher.name === name);
    if (!recipient) throw new Error("Disposable clinic notification teacher is missing");
    const session = await expectApi<{ id: number }>(request, "POST", "/clinic/sessions/", adminAccess, {
      title, date, start_time: "13:00:00", duration_minutes: 240, location: title, max_participants: 4,
      booking_mode: "time_range", booking_interval_minutes: 30, booking_max_stay_minutes: 120,
      notification_teacher_id: recipient.id,
    }, [201]);
    sessionId = session.id;
    const path = `/clinic/sessions/${sessionId}/`;
    expect(await expectApi(request, "GET", path, adminAccess)).toMatchObject({ notification_teacher_id: recipient.id });
    expect(await expectApi(request, "GET", path, studentTokens.access)).not.toHaveProperty("notification_teacher_id");

    await gotoAndSettle(teacherPage, QA_BASE + "/workspace/clinic/home");
    const panel = teacherPage.getByRole("region", { name: "학생 예약 마감", exact: true });
    await panel.getByRole("button", { name: "마감 설정 변경" }).click();
    await panel.getByLabel("마감 기준").selectOption("before_start");
    await panel.getByRole("spinbutton").fill("10080");
    await panel.getByRole("checkbox").uncheck();
    await panel.getByRole("button", { name: "마감 설정 저장" }).click();
    await expect(panel.getByRole("status")).toContainText("저장했습니다");
    await gotoAndSettle(page, QA_BASE + "/student/clinic");
    const calendarDay = page.getByTestId(`clinic-calendar-day-${date}`);
    await calendarDay.click();
    const sessionButton = page.getByRole("button", { name: new RegExp(title) });
    await expect(sessionButton).toBeDisabled();
    await expect(sessionButton).toContainText("신청 마감");

    await panel.getByRole("button", { name: "마감 설정 변경" }).click();
    await panel.getByRole("checkbox").check();
    await panel.getByRole("button", { name: "마감 설정 저장" }).click();
    await expect(panel.getByRole("status")).toContainText("저장했습니다");
    await reloadStudentApp(page);
    await calendarDay.click();
    if (await sessionButton.getAttribute("aria-pressed") !== "true") await sessionButton.click();
    const selection = page.getByRole("region", { name: "선택한 클리닉 시간" });
    await selection.getByRole("button", { name: /14:30 시작/ }).click();
    await selection.getByRole("button", { name: /15:30 종료/ }).click();
    const submitted = page.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith("/clinic/participants/bulk-create/"));
    await page.getByRole("button", { name: "승인 대기로 신청하기" }).click();
    const response = await submitted;
    expect(response.ok()).toBe(true);
    const receipt = await response.json() as { participants: Array<{ id: number; status: string; requested_after_cutoff: boolean }> };
    participantId = receipt.participants[0]?.id;
    expect(receipt.participants).toHaveLength(1);
    expect(receipt.participants[0]).toMatchObject({ status: "pending", requested_after_cutoff: true });
    await reloadStudentApp(page);
    await page.getByRole("tab", { name: /내 일정/ }).click();
    const booking = page.locator("article").filter({ hasText: title });
    await expect(booking).toContainText("마감 후 신청 · 승인 대기");
    await testInfo.attach("clinic-late-request-pending", { body: await booking.screenshot(), contentType: "image/png" });

    const familyRecipients: Recipient[] = [
      { type: "student", id: student.id, phone: phones[0] }, { type: "parent", id: student.id, phone: phones[1] },
    ];
    const origin = `clinic_participant:${participantId}`;
    const range = `${date} 14:30–15:30`;
    const pendingLogs = await verifyDeliveries(request, adminAccess, `${origin}:reservation_pending`,
      [...familyRecipients, { type: "clinic_teacher", id: recipient.id, phone: teacherPhone }], `마감 후 승인 대기 · ${range}`);
    await gotoAndSettle(teacherPage, `${QA_BASE}/workspace/clinic/home`);
    await expect(panel).toContainText("시작 10080분 전");
    await expect(panel).toContainText("시작 전까지 승인 대기로 접수");
    const row = teacherPage.getByRole("table", { name: "예약 승인 대기 명단" }).getByRole("row")
      .filter({ hasText: title }).filter({ hasText: student.name });
    await expect(row).toContainText("마감 후 대기");
    await expect(row).toContainText("14:30–15:30");
    await expect(row).toContainText(name);
    await testInfo.attach("clinic-admin-pending-roster-1366", { body: await row.screenshot(), contentType: "image/png" });
    await row.getByRole("button", { name: "승인", exact: true }).click();
    await expect.poll(async () => (await expectApi<{ status: string }>(request, "GET", `/clinic/participants/${participantId}/`, adminAccess)).status).toBe("booked");
    await reloadStudentApp(page);
    await page.getByRole("tab", { name: /내 일정/ }).click();
    await expect(booking).toContainText("예약 확정");
    const approvalLogs = await verifyDeliveries(request, adminAccess, `${origin}:approval`, familyRecipients, `예약 확정 · ${range}`);
    await testInfo.attach("clinic-reservation-worker-receipts", { body: JSON.stringify({ pendingLogs, approvalLogs }), contentType: "application/json" });
  } catch (error) {
    errors.push(error);
  } finally {
    const restore = async (action: () => Promise<void>) => {
      try { await action(); } catch (error) { errors.push(error); }
    };
    await restore(async () => {
      await expectApi(request, "PATCH", "/clinic/settings/", adminAccess, original);
      expect(await expectApi(request, "GET", "/clinic/settings/", adminAccess)).toMatchObject(original);
    });
    for (const path of [sessionId && `/clinic/sessions/${sessionId}/`, staffId && `/staffs/${staffId}/`]) {
      if (path) await restore(async () => {
        expect([204, 404]).toContain((await api(request, "DELETE", path, adminAccess)).status);
        expect((await api(request, "GET", path, adminAccess)).status).toBe(404);
      });
    }
    if (participantId) await restore(async () => {
      expect((await api(request, "GET", `/clinic/participants/${participantId}/`, adminAccess)).status).toBe(404);
    });
  }
  if (errors.length) throw new AggregateError(errors, "Isolated clinic cutoff journey or cleanup failed");
}
