import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import {
  assertQaStudentParentRuntime, expectApi, installQaStudentParentBoundary, loginApi, loginThroughUi,
  QA_ADMIN_PASSWORD, QA_API, QA_BASE, QA_TENANT, selectParentStudentThroughUi, type QaFamily,
} from "./qaStudentParentScenario";

type ClinicDayFixture = {
  family: QaFamily;
  adminAccess: string;
  sessionId: number;
  enrollmentId: number;
  homeworkId: number;
  clinicLinkId: number;
  participantId: number;
  examTitle: string;
  clinicTitle: string;
};

type Card = {
  current_targets: Array<{ clinic_link_id: number }>;
  valid_bookings: Array<{ participant_id: number }>;
};

async function visitCard(page: Page, fixture: ClinicDayFixture, viewer: "student" | "parent" | "sibling",
  passed: boolean, wrongCompletion = false) {
  const sibling = viewer === "sibling";
  const child = fixture.family.students[sibling ? 1 : 0];
  // Listen on the new document. The previous passcard may still have a poll in flight.
  await page.bringToFront();
  await page.goto(`${QA_BASE}/student/idcard`, { waitUntil: "commit" });
  const response = await page.waitForResponse(res => res.request().method() === "GET"
    && new URL(res.url()).pathname === "/api/v1/clinic/idcard/");
  expect(response.status()).toBe(200);
  const headers = await response.request().allHeaders();
  expect(headers["x-tenant-code"]).toBe(QA_TENANT);
  expect(headers["x-student-id"]).toBe(viewer === "student" ? undefined : String(child.id));
  const card = await response.json() as Card;
  expect(card).toMatchObject({
    student_name: child.name, today_assessments_passed: passed,
    current_result: sibling ? "SUCCESS" : "FAIL",
    passcard_state: sibling ? "PASSED" : "BOOKING_CONFIRMED",
    current_booking: sibling ? null : { participant_id: fixture.participantId, status: "booked" },
  });
  expect(card.valid_bookings.map(b => b.participant_id)).toEqual(sibling ? [] : [fixture.participantId]);
  if (sibling) expect(card.current_targets).toEqual([]);
  else expect(card.current_targets.map(item => item.clinic_link_id)).toContain(fixture.clinicLinkId);
  const panel = page.getByTestId("clinic-passcard");
  await expect(panel).toContainText(child.name);
  await expect(panel.getByRole("region", { name: wrongCompletion ? "현재 오답 상태" : "현재 클리닉 상태" })).toBeVisible();
  const dailyLabel = passed && !wrongCompletion;
  await expect(panel.getByRole("heading", { name: dailyLabel || sibling ? "합격자" : "예약완료", exact: true })).toBeVisible();
  await expect(panel.getByText("오늘 수업 통과", { exact: true })).toHaveCount(dailyLabel ? 1 : 0);
  const booking = panel.getByRole("region", { name: "클리닉 예약 상태" });
  if (sibling) await expect(booking).toHaveCount(0);
  else await expect(booking).toContainText(fixture.clinicTitle);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

async function visitTargets(page: Page, examTitle: string, hasBooking: boolean) {
  if (hasBooking) await page.getByRole("link", { name: "예약 일정 확인하기" }).click();
  else await page.goto(`${QA_BASE}/student/clinic`, { waitUntil: "domcontentloaded" });
  const summary = page.getByRole("region", { name: "내 클리닉 대상 현황" });
  if (hasBooking) {
    await expect(summary.getByTestId("clinic-target-item").filter({ hasText: examTitle })).toBeVisible();
  } else {
    await expect(summary.getByRole("heading", { name: "현재 보강이 필요한 항목이 없어요" })).toBeVisible();
    await expect(summary.getByTestId("clinic-target-item")).toHaveCount(0);
  }
}

async function selectChild(page: Page, child: QaFamily["students"][number]) {
  await page.goto(`${QA_BASE}/student/dashboard`, { waitUntil: "domcontentloaded" });
  await selectParentStudentThroughUi(page, child);
}

type GradeBlock = { score: number | null; updated_at?: string | null };
type Scores = { rows: Array<{ enrollment_id: number; homeworks: Array<{ homework_id: number; block: GradeBlock }> }> };

async function saveGrade(request: APIRequestContext, f: ClinicDayFixture, score: number, expectedUpdatedAt: string | null) {
  const draftUrl = `${QA_API}/api/v1/results/admin/sessions/${f.sessionId}/score-draft/`;
  const headers = {
    Authorization: `Bearer ${f.adminAccess}`, "X-Tenant-Code": QA_TENANT,
    "X-Score-Editor-Client": `qa-clinic-day-${f.sessionId}`, "X-Score-Session-Id": String(f.sessionId),
  };
  const lease = await request.put(draftUrl, { headers, data: { changes: [] } });
  expect(lease.status()).toBe(200);
  try {
    const response = await request.patch(`${QA_API}/api/v1/homework/scores/quick/`, { headers, data: {
      session_id: f.sessionId, enrollment_id: f.enrollmentId, homework_id: f.homeworkId,
      score, max_score: 100, expected_updated_at: expectedUpdatedAt,
    } });
    expect(response.status()).toBe(200);
    const saved = await response.json() as { updated_at: string };
    expect(saved).toMatchObject({ score, passed: score >= 80, teacher_approved: false, updated_at: expect.any(String) });
    return saved.updated_at;
  } finally {
    const released = await request.post(`${draftUrl}commit/`, { headers, data: { release_lease: true } });
    expect(released.status()).toBe(204);
  }
}

export async function verifyClinicDayPass(page: Page, request: APIRequestContext, f: ClinicDayFixture) {
  assertQaStudentParentRuntime();
  const owner = await loginApi(request, "ymath-qa-organization-owner", QA_ADMIN_PASSWORD);
  expect(await expectApi(request, "GET", "/core/me/", owner.access)).toMatchObject({ tenantRole: "owner" });
  const program = () => expectApi<{ tenantCode: string; feature_flags: Record<string, unknown> }>(
    request, "GET", "/core/program/", owner.access,
  );
  const original = await program();
  expect(original).toMatchObject({ tenantCode: QA_TENANT, feature_flags: { assessment_status_display: "wrong_completion" } });
  const standard = { ...original.feature_flags };
  delete standard.assessment_status_display;
  const setFlags = async (flags: Record<string, unknown>) => {
    await expectApi(request, "PATCH", "/core/program/", owner.access, { feature_flags: flags }, [200]);
    const stored = await program();
    expect(stored.tenantCode).toBe(QA_TENANT);
    expect(stored.feature_flags).toEqual(flags);
  };

  const scores = await expectApi<Scores>(request, "GET", `/results/admin/sessions/${f.sessionId}/scores/`, f.adminAccess);
  const block = scores.rows.find(row => row.enrollment_id === f.enrollmentId)?.homeworks.find(hw => hw.homework_id === f.homeworkId)?.block;
  expect(block?.score).toBeNull();
  await visitCard(page, f, "student", false, true);
  let version = await saveGrade(request, f, 90, block?.updated_at ?? null);
  await visitCard(page, f, "student", true, true);

  try {
    await setFlags(standard);
    const parentContext = await page.context().browser()!.newContext({ serviceWorkers: "block" });
    try {
      const parent = await parentContext.newPage();
      const guard = await installQaStudentParentBoundary(parent, request);
      await loginThroughUi(parent, f.family.parentPhone, f.family.parentPassword);
      const [primary, sibling] = f.family.students;
      await selectChild(parent, primary);
      for (const width of [390, 1366]) {
        for (const [screen, role] of [[page, "student"], [parent, "parent"]] as const) {
          await screen.setViewportSize({ width, height: 844 });
          await visitCard(screen, f, role, true);
          await visitTargets(screen, f.examTitle, true);
        }
        await selectChild(parent, sibling);
        await visitCard(parent, f, "sibling", false);
        await visitTargets(parent, f.examTitle, false);
        await selectChild(parent, primary);
      }
      version = await saveGrade(request, f, 0, version);
      await visitCard(page, f, "student", false);
      await visitCard(parent, f, "parent", false);
      await saveGrade(request, f, 90, version);
      await visitCard(parent, f, "parent", true);
      guard.assertClean();
    } finally {
      await parentContext.close();
    }
  } finally {
    await setFlags(original.feature_flags);
  }
  // A fresh page reads the restored program and the same persisted passing grade.
  await visitCard(page, f, "student", true, true);
}
