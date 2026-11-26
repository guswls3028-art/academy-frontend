import { expect } from "@playwright/test";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
import {
  api, assertQaStudentParentRuntime, expectApi, QA_BASE, reloadStudentApp,
  type QaStudent, type QaTokens,
} from "./qaStudentParentScenario";
import { gotoAndSettle } from "./wait";

type Policy = { booking_cutoff_mode: string; booking_cutoff_minutes: number; booking_cutoff_time: string; allow_late_requests: boolean };
type Args = {
  page: Page; teacherPage: Page; request: APIRequestContext; testInfo: TestInfo;
  student: QaStudent; studentTokens: QaTokens; adminAccess: string; date: string;
};

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
    const staff = await expectApi<{ id: number }>(request, "POST", "/staffs/", adminAccess, {
      name, role: "TEACHER", username: `qa-clinic-notice-${stamp}`, phone: `01097${String(stamp).slice(-6)}`,
      password: student.password, is_manager: false,
    }, [201]);
    staffId = staff.id;
    const teachers = await expectApi<Array<{ id: number; name: string }>>(request, "GET", "/clinic/sessions/notification-teachers/", adminAccess);
    const recipient = teachers.find((teacher) => teacher.name === name);
    if (!recipient) throw new Error("Disposable clinic notification teacher is missing");
    const session = await expectApi<{ id: number }>(request, "POST", "/clinic/sessions/", adminAccess, {
      title, date, start_time: "16:00:00", duration_minutes: 60, location: title, max_participants: 4, booking_mode: "fixed_slot",
      notification_teacher_id: recipient.id,
    }, [201]);
    sessionId = session.id;
    const path = `/clinic/sessions/${sessionId}/`;
    expect(await expectApi(request, "GET", path, adminAccess)).toMatchObject({ notification_teacher_id: recipient.id });
    expect(await expectApi(request, "GET", path, studentTokens.access)).not.toHaveProperty("notification_teacher_id");

    await gotoAndSettle(teacherPage, QA_BASE + "/workspace/clinic/home");
    const panel = teacherPage.locator("details").filter({ has: teacherPage.locator("summary", { hasText: "학생 예약 마감" }) });
    await panel.locator("summary").click();
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

    await panel.getByRole("checkbox").check();
    await panel.getByRole("button", { name: "마감 설정 저장" }).click();
    await expect(panel.getByRole("status")).toContainText("저장했습니다");
    await reloadStudentApp(page);
    await calendarDay.click();
    await sessionButton.click();
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

    await gotoAndSettle(teacherPage, `${QA_BASE}/workspace/clinic/operations?date=${date}&session=${sessionId}`);
    const row = teacherPage.locator(".clinic-ops__card").filter({ hasText: student.name });
    await expect(row).toContainText("마감 후 신청");
    await row.getByRole("button", { name: "예약 승인", exact: true }).click();
    await expect.poll(async () => (await expectApi<{ status: string }>(request, "GET", `/clinic/participants/${participantId}/`, adminAccess)).status).toBe("booked");
    await reloadStudentApp(page);
    await page.getByRole("tab", { name: /내 일정/ }).click();
    await expect(booking).toContainText("예약 확정");
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
