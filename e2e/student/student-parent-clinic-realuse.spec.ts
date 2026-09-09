/** Student clinic booking -> parent selected-child projection in qa-* development. */
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext } from "@playwright/test";
import {
  api,
  assertNoHorizontalOverflow,
  assertQaStudentParentRuntime,
  cleanupQaFamily,
  createQaFamily,
  expectApi,
  installQaStudentParentBoundary,
  loginAdmin,
  loginThroughUi,
  logoutStudentApp,
  QA_BASE,
  reloadStudentApp,
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
} from "../helpers/qaStudentParentScenario";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

test.setTimeout(300_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

type ClinicParticipant = {
  id: number;
  student: number;
  student_name?: string;
  status: string;
  memo?: string;
  can_self_cancel?: boolean;
};

let family: QaFamily | null = null;
let adminAccess = "";
let sessionId: number | undefined;
let participantId: number | undefined;

const runStamp = Date.now();
const clinicDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })
  .format(new Date(Date.now() + 24 * 60 * 60 * 1000));
const sessionTitle = `QA 학부모 클리닉 ${runStamp}`;
const bookingMemo = `qa-* 학생 예약 ${runStamp}`;

function listFrom(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) return body as Array<Record<string, unknown>>;
  if (body && typeof body === "object" && Array.isArray((body as { results?: unknown }).results)) {
    return (body as { results: Array<Record<string, unknown>> }).results;
  }
  return [];
}

async function waitForParticipant(request: APIRequestContext, studentId: number): Promise<ClinicParticipant> {
  let matched: ClinicParticipant | undefined;
  await waitForCondition(async () => {
    const body = await expectApi<unknown>(
      request,
      "GET",
      `/clinic/participants/by_session/?session_id=${sessionId}`,
      adminAccess,
    );
    matched = (listFrom(body) as unknown as ClinicParticipant[]).find((row) => (
      row.student === studentId && ["pending", "booked"].includes(row.status)
    ));
    return Boolean(matched);
  }, { timeoutMs: 45_000, intervalMs: 750, description: "student clinic booking persistence" });
  if (!matched) throw new Error("clinic participant did not persist");
  participantId = matched.id;
  return matched;
}

async function cleanup(request: APIRequestContext): Promise<void> {
  if (!adminAccess) return;
  const failures: string[] = [];
  const remove = async (method: string, path: string) => {
    try {
      const result = await api(request, method, path, adminAccess);
      if (![200, 202, 204, 404].includes(result.status)) failures.push(`${method} ${path} -> ${result.status}`);
    } catch (error) {
      failures.push(`${method} ${path} -> ${String(error)}`);
    }
  };
  if (sessionId) await remove("DELETE", `/clinic/sessions/${sessionId}/`);
  await cleanupQaFamily(request, adminAccess, family);
  if (sessionId) {
    const residue = await api(request, "GET", `/clinic/sessions/${sessionId}/`, adminAccess);
    if (residue.status !== 404) failures.push(`verify clinic session ${sessionId} absent -> ${residue.status}`);
  }
  if (participantId) {
    const residue = await api(request, "GET", `/clinic/participants/${participantId}/`, adminAccess);
    if (residue.status !== 404) failures.push(`verify clinic participant ${participantId} absent -> ${residue.status}`);
  }
  if (failures.length) throw new Error(`student/parent clinic cleanup failed:\n${failures.join("\n")}`);
}

test.describe.serial("[real-use] 학생 예약에서 학부모 클리닉 projection", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Enable only inside the isolated qa-* development runner.");

  test.beforeAll(() => {
    assertQaStudentParentRuntime();
  });

  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("390px 예약·authoritative participant·학부모 조회·reload/relogin·desktop을 완료한다", async ({ page, request }) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const browser = attachStrictBrowserGuards(page);
    const admin = await loginAdmin(request);
    adminAccess = admin.access;
    family = await createQaFamily(request, admin.access, "clinic", 1, { withStudentPhones: true });
    const student = family.students[0];
    const clinicSession = await expectApi<{ id: number }>(request, "POST", "/clinic/sessions/", admin.access, {
      title: sessionTitle,
      date: clinicDate,
      start_time: "17:00:00",
      duration_minutes: 60,
      location: "QA 격리 학습실",
      max_participants: 10,
      target_grade: null,
      target_school_type: null,
      target_lecture_ids: [],
      allow_multi_slot_booking: false,
    });
    sessionId = Number(clinicSession.id);

    await page.setViewportSize({ width: 390, height: 844 });
    await loginThroughUi(page, student.ps_number, student.password);
    await gotoAndSettle(page, `${QA_BASE}/student/clinic`, { timeout: 30_000 });
    const dateRegion = page.getByRole("region", {
      name: new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
        timeZone: "Asia/Seoul",
      }).format(new Date(`${clinicDate}T12:00:00+09:00`)).replace(/\.$/, ""),
    });
    await dateRegion.getByRole("button", { name: sessionTitle }).click();
    const selection = page.getByRole("region", { name: "선택한 클리닉 시간" });
    await selection.getByLabel("학원에 전할 내용 (선택)").fill(bookingMemo);
    await selection.getByRole("button", { name: "이 일정 예약하기" }).click();
    await expect(page.getByRole("status")).toContainText(/예약(?:이 확정| 신청이 접수)되었습니다/);

    const participant = await waitForParticipant(request, student.id);
    expect(participant.student_name).toBe(student.name);
    await page.getByRole("tab", { name: /내 일정/ }).click();
    await expect(page.locator("article").filter({ hasText: sessionTitle })).toContainText(bookingMemo);
    await assertNoHorizontalOverflow(page);

    await logoutStudentApp(page);
    await loginThroughUi(page, family.parentPhone, family.parentPassword);
    await gotoAndSettle(page, `${QA_BASE}/student/clinic`, { timeout: 30_000 });
    await page.getByRole("tab", { name: /내 일정/ }).click();
    await expect(page.locator("article").filter({ hasText: sessionTitle })).toContainText(bookingMemo);

    await reloadStudentApp(page);
    await page.getByRole("tab", { name: /내 일정/ }).click();
    await expect(page.locator("article").filter({ hasText: sessionTitle })).toBeVisible();
    await logoutStudentApp(page);
    await loginThroughUi(page, family.parentPhone, family.parentPassword);
    await gotoAndSettle(page, `${QA_BASE}/student/clinic`, { timeout: 30_000 });
    await page.getByRole("tab", { name: /내 일정/ }).click();
    const parentBookingCard = page.locator("article").filter({ hasText: sessionTitle });
    await expect(parentBookingCard).toBeVisible();
    const cancelButton = parentBookingCard.getByRole("button", { name: "예약 취소" });
    await expect(cancelButton).toBeEnabled();
    const cancelResponse = page.waitForResponse((response) => (
      response.request().method() === "PATCH"
      && new URL(response.url()).pathname.endsWith(`/api/v1/clinic/participants/${participantId}/set_status/`)
    ));
    await cancelButton.click();
    await page.getByRole("alertdialog", { name: "예약 취소" })
      .getByRole("button", { name: "예약 취소" })
      .click();
    const cancelled = await cancelResponse;
    const cancellationBody = await cancelled.json() as Record<string, unknown>;
    const cancellationFailure = {
      code: cancellationBody.code,
      detail: cancellationBody.detail,
    };
    expect(
      cancelled.status(),
      `clinic cancellation failed: ${JSON.stringify(cancellationFailure)}`,
    ).toBe(200);
    expect(cancellationBody).toMatchObject({
      status: "cancelled",
      notification: {
        requested: 2,
        send_to: "both",
        targets: expect.arrayContaining([
          { target: "student", requested: true },
          { target: "parent", requested: true },
        ]),
      },
    });
    await expect(page.getByText(/예약 취소가 저장되었습니다/)).toBeVisible();
    await reloadStudentApp(page);
    await page.getByRole("tab", { name: /내 일정/ }).click();
    await expect(page.locator("article").filter({ hasText: sessionTitle })).toHaveCount(0);

    await page.setViewportSize({ width: 1366, height: 900 });
    await assertNoHorizontalOverflow(page);
    boundary.assertClean();
    browser.assertZeroDefects();
  });
});
