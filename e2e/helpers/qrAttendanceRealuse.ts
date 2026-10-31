import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { api, assertNoHorizontalOverflow, assertQaStudentParentRuntime, expectApi,
  loginThroughUi, logoutStudentApp, QA_BASE, reloadStudentApp, type QaFamily } from "./qaStudentParentScenario";
import { gotoAndSettle } from "./wait";

type Point = { id: number; token: string; active: boolean };
type Participant = { id: number; status: string; checked_in_at: string | null; checked_out_at: string | null; completed_at: string | null };

/** Exact qa-* family owned by the existing clinic scenario; never production fixtures. */
export async function verifyQrAttendanceRealuse({ page, teacherPage, request, testInfo, family, adminAccess, lectureId, enrollmentId }: {
  page: Page; teacherPage: Page; request: APIRequestContext; testInfo: TestInfo; family: QaFamily;
  adminAccess: string; lectureId: number; enrollmentId: number;
}) {
  assertQaStudentParentRuntime();
  const student = family.students[0];
  const stamp = Date.now();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const label = `QA QR 출석 ${stamp}`;
  let classSessionId: number | undefined;
  let clinicSessionId: number | undefined;
  const points: Point[] = [];
  const createSign = async (route: string, kind: "class" | "clinic") => {
    await gotoAndSettle(teacherPage, `${QA_BASE}${route}`);
    await teacherPage.getByRole("button", { name: "출결 QR 출력", exact: true }).click();
    const dialog = teacherPage.getByRole("dialog", { name: "출결 QR 출력", exact: true });
    const details = dialog.locator("details");
    if (!(await details.evaluate((element) => element.hasAttribute("open")))) await details.locator("summary").click();
    await dialog.getByLabel("인쇄할 이름").fill(`${label} ${kind}`);
    if (kind === "clinic") await dialog.getByLabel("클리닉 장소", { exact: true }).fill(label);
    const saved = teacherPage.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/lectures/attendance-qr/");
    await dialog.getByRole("button", { name: "QR 발급", exact: true }).click();
    const response = await saved;
    expect(response.status()).toBe(201);
    const point = await response.json() as Point;
    points.push(point);
    const qr = dialog.getByLabel("출결 QR 인쇄 미리보기").locator(".ant-qrcode");
    await expect(qr.locator("svg")).toBeVisible();
    const photo = await qr.screenshot();
    await assertNoHorizontalOverflow(teacherPage);
    await testInfo.attach(`qr-${kind}-poster`, { body: await dialog.screenshot(), contentType: "image/png" });
    await dialog.getByRole("button", { name: "닫기", exact: true }).last().click();
    return { point, photo };
  };
  const scan = async (photo: Buffer) => {
    await gotoAndSettle(page, `${QA_BASE}/student/attendance/scan`);
    await page.locator('input[type="file"]').setInputFiles({ name: "qr-sign.png", mimeType: "image/png", buffer: photo });
  };
  try {
    await expectApi(request, "PATCH", `/lectures/lectures/${lectureId}/`, adminAccess, { start_date: today });
    const session = await expectApi<{ id: number }>(request, "POST", "/lectures/sessions/", adminAccess, { lecture: lectureId, title: label, date: today, order: 1 });
    classSessionId = session.id;
    await expectApi(request, "POST", "/enrollments/session-enrollments/bulk_create/", adminAccess, { session: classSessionId, enrollments: [enrollmentId] });
    await expectApi(request, "POST", "/lectures/attendance/bulk_create/", adminAccess, { session: classSessionId, students: [student.id] });
    const classSign = await createSign(`/workspace/lectures/${lectureId}/sessions/${classSessionId}/attendance`, "class");
    await logoutStudentApp(page);
    await loginThroughUi(page, student.ps_number, student.password);
    await page.setViewportSize({ width: 390, height: 844 });
    await scan(classSign.photo);
    await expect(page.getByText("출석이 기록되었습니다.", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "내 출결 기록 보기" }).click();
    await reloadStudentApp(page);
    await expect(page.getByText(label, { exact: false })).toBeVisible();
    const summary = await expectApi<{ count: number; results: Array<{ status: string; qr_checked_in_at: string }> }>(request, "GET", `/lectures/attendance/?session=${classSessionId}`, adminAccess);
    expect(summary.results).toEqual(expect.arrayContaining([expect.objectContaining({ status: "PRESENT", qr_checked_in_at: expect.any(String) })]));
    await teacherPage.reload({ waitUntil: "domcontentloaded" });
    await expect(teacherPage.getByText(student.name, { exact: true }).first()).toBeVisible();

    const clinic = await expectApi<{ id: number }>(request, "POST", "/clinic/sessions/", adminAccess, {
      title: label, date: today, start_time: `${time}:00`, duration_minutes: 60, location: label,
      max_participants: 5, target_lecture_ids: [], target_grade: null, target_school_type: null,
    });
    clinicSessionId = clinic.id;
    const participant = await expectApi<Participant>(request, "POST", "/clinic/participants/", adminAccess, { session: clinic.id, student: student.id });
    expect(participant.status).toBe("booked");
    const clinicSign = await createSign("/workspace/clinic/home", "clinic");
    await scan(clinicSign.photo);
    await page.getByRole("button", { name: "등원하기", exact: true }).click();
    await expect(page.getByText("등원이 기록되었습니다.", { exact: true })).toBeVisible();
    const arrival = await expectApi<Participant>(request, "GET", `/clinic/participants/${participant.id}/`, adminAccess);
    expect(arrival.status).toBe("attended"); expect(arrival.checked_in_at).toBeTruthy();
    expect(arrival.checked_out_at).toBeNull(); expect(arrival.completed_at).toBeNull();
    await scan(clinicSign.photo);
    await page.getByRole("button", { name: "하원하기", exact: true }).click();
    await expect(page.getByText("하원이 기록되었습니다.", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "내 클리닉 기록 보기" }).click();
    await reloadStudentApp(page);
    await expect(page.getByRole("region", { name: "최근 클리닉 등원·하원 기록" })).toContainText(label);
    const departure = await expectApi<Participant>(request, "GET", `/clinic/participants/${participant.id}/`, adminAccess);
    expect(departure.checked_in_at).toBe(arrival.checked_in_at);
    expect(departure.checked_out_at).toBeTruthy(); expect(departure.completed_at).toBeNull();
    await scan(clinicSign.photo);
    await page.getByRole("button", { name: "하원 기록 확인", exact: true }).click();
    await expect(page.getByText("이미 하원 기록이 있습니다.", { exact: true })).toBeVisible();
    const repeated = await expectApi<Participant>(request, "GET", `/clinic/participants/${participant.id}/`, adminAccess);
    expect(repeated.checked_out_at).toBe(departure.checked_out_at);
    await assertNoHorizontalOverflow(page);
    await testInfo.attach("qr-clinic-saved-390", { body: await page.screenshot(), contentType: "image/png" });
  } finally {
    const failures: string[] = [];
    for (const point of points) {
      try {
        const updated = await expectApi<Point>(request, "PATCH", `/lectures/attendance-qr/${point.id}/`, adminAccess, { active: false });
        expect(updated.active).toBe(false);
      } catch { failures.push("QR deactivation failed"); }
    }
    for (const path of [
      ...(clinicSessionId ? [`/clinic/sessions/${clinicSessionId}/`] : []),
      ...(classSessionId ? [`/lectures/sessions/${classSessionId}/`] : []),
    ]) {
      try {
        const removed = await api(request, "DELETE", path, adminAccess);
        expect([204, 404]).toContain(removed.status);
        expect((await api(request, "GET", path, adminAccess)).status).toBe(404);
      } catch { failures.push("QR synthetic session cleanup failed"); }
    }
    if (failures.length) throw new Error(failures.join("; "));
  }
}
