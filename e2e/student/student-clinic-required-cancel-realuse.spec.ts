/**
 * Disposable development proof for the required-student cancellation contract.
 * A real failed exam creates the ClinicLink; the student then books two slots,
 * cancels one, and the staff APIs prove both durable mock notification targets.
 */
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext } from "@playwright/test";

import {
  api,
  cleanupQaFamily,
  createQaFamily,
  expectApi,
  installQaStudentParentBoundary,
  loginAdmin,
  loginApi,
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
} from "../helpers/qaStudentParentScenario";
import { waitForCondition } from "../helpers/wait";

test.setTimeout(360_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

type Paged<T> = { count: number; results: T[] };
type Participant = { id: number; status: string; student: number };
type NotificationLog = {
  notification_type: string;
  origin_id: string;
  provider_message_id: string;
  recipient_summary: string;
  success: boolean;
  target_type: string;
  template_summary: string;
};

const marker = `[required-cancel-${Date.now()}]`;
const todayKst = kstYmd(0);
const clinicDate = kstYmd(1);
const created = {
  adminAccess: "",
  family: null as QaFamily | null,
  lectureId: 0,
  sourceSessionId: 0,
  enrollmentId: 0,
  examId: 0,
  clinicSessionIds: [] as number[],
  participantIds: [] as number[],
};

function kstYmd(offsetDays: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })
    .format(new Date(Date.now() + offsetDays * 86_400_000));
}

function rowsFrom<T>(body: T[] | Paged<T>): T[] {
  return Array.isArray(body) ? body : body.results;
}

async function waitForFailedResult(
  request: APIRequestContext,
  studentAccess: string,
  examId: number,
): Promise<{ total_score: number; is_pass: boolean }> {
  let result: { total_score: number; is_pass: boolean } | null = null;
  await waitForCondition(async () => {
    const response = await api<typeof result>(
      request,
      "GET",
      `/student/results/me/exams/${examId}/`,
      studentAccess,
    );
    if (response.status !== 200 || !response.body) return false;
    result = response.body;
    return result.is_pass === false;
  }, { timeoutMs: 60_000, intervalMs: 750, description: "failed result and ClinicLink source" });
  if (!result) throw new Error("failed result did not become readable");
  return result;
}

async function cleanup(request: APIRequestContext): Promise<void> {
  if (!created.adminAccess) return;
  const failures: string[] = [];
  const remove = async (method: string, path: string, data?: Record<string, unknown>) => {
    const response = await api(request, method, path, created.adminAccess, data);
    if (![200, 202, 204, 404].includes(response.status)) {
      failures.push(`${method} ${path} -> ${response.status}`);
    }
  };

  // Permanently remove the disposable student first so its participant rows
  // cascade without exercising the user-facing session-cancellation notifier.
  if (created.family) {
    try {
      const deletion = await cleanupQaFamily(request, created.adminAccess, created.family);
      expect(deletion).toMatchObject({ deleted: 1, storage_cleanup: { pending: 0, failed: 0 } });
    } catch (error) {
      failures.push(`family cleanup -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const id of [...created.clinicSessionIds].reverse()) await remove("DELETE", `/clinic/sessions/${id}/`);
  if (created.examId && created.sourceSessionId) {
    await remove("DELETE", `/exams/${created.examId}/?session_id=${created.sourceSessionId}`);
  }
  if (created.sourceSessionId) await remove("DELETE", `/lectures/sessions/${created.sourceSessionId}/`);
  if (created.lectureId) await remove("DELETE", `/lectures/lectures/${created.lectureId}/`);
  if (failures.length) throw new Error(`required cancellation cleanup failed: ${failures.join("; ")}`);
}

test.describe.serial("[development] 필수 클리닉 2회 예약 중 1회 취소", () => {
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Enable only inside the isolated qa-* development runner.");

  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("실제 실패 성적부터 학생·학부모 mock 알림 2건까지 봉인한다", async ({ page, request }) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const admin = await loginAdmin(request);
    created.adminAccess = admin.access;
    created.family = await createQaFamily(
      request,
      admin.access,
      "clinic-required-cancel",
      1,
      { withStudentPhones: true },
    );
    const student = created.family.students[0];
    const studentTokens = await loginApi(request, student.ps_number, student.password);

    const lecture = await expectApi<{ id: number }>(request, "POST", "/lectures/lectures/", admin.access, {
      title: `${marker} 강의`,
      name: "QA필수취소",
      subject: "수학",
      description: "실패 성적 기반 필수 클리닉 취소 실사용",
      start_date: todayKst,
      lecture_time: "월 17:00 ~ 19:00",
      color: "#2563eb",
      chip_label: "필취",
      is_active: true,
    }, [201]);
    created.lectureId = Number(lecture.id);

    const sourceSession = await expectApi<{ id: number }>(request, "POST", "/lectures/sessions/", admin.access, {
      lecture: created.lectureId,
      title: `${marker} 원천 차시`,
      date: todayKst,
      order: 1,
    }, [201]);
    created.sourceSessionId = Number(sourceSession.id);

    const enrollments = await expectApi<Array<{ id: number }>>(
      request,
      "POST",
      "/enrollments/bulk_create/",
      admin.access,
      { lecture: created.lectureId, students: [student.id] },
    );
    created.enrollmentId = Number(enrollments[0].id);
    await expectApi(request, "POST", "/enrollments/session-enrollments/bulk_create/", admin.access, {
      session: created.sourceSessionId,
      enrollments: [created.enrollmentId],
    }, [201]);

    const exam = await expectApi<{ id: number }>(request, "POST", "/exams/", admin.access, {
      title: `${marker} 필수 대상 시험`,
      description: "필수 클리닉 대상 자동 생성 검증",
      exam_type: "regular",
      session_id: created.sourceSessionId,
      pass_score: 80,
      max_score: 100,
      answer_visibility: "hidden",
    });
    created.examId = Number(exam.id);
    const questions = await expectApi<Array<{ id: number; number: number }>>(
      request,
      "POST",
      `/exams/${created.examId}/questions/init/`,
      admin.access,
      { total_questions: 5, default_score: 20 },
    );
    const questionIds = questions.sort((a, b) => a.number - b.number).map((question) => question.id);
    await expectApi(request, "POST", "/exams/answer-keys/", admin.access, {
      exam: created.examId,
      answers: Object.fromEntries(questionIds.map((id, index) => [String(id), String(index + 1)])),
    });
    await expectApi(
      request,
      "PUT",
      `/exams/${created.examId}/enrollments/?session_id=${created.sourceSessionId}`,
      admin.access,
      { enrollment_ids: [created.enrollmentId] },
      [200],
    );

    const submitted = await api(
      request,
      "POST",
      `/student/exams/${created.examId}/submit/`,
      studentTokens.access,
      { answers: questionIds.map((id) => ({ exam_question_id: id, answer: "5" })) },
    );
    expect(submitted.status).toBe(201);
    const failedResult = await waitForFailedResult(request, studentTokens.access, created.examId);
    expect(failedResult).toMatchObject({ total_score: 20, is_pass: false });

    let clinicTarget: Record<string, unknown> | null = null;
    await waitForCondition(async () => {
      const body = await expectApi<Array<Record<string, unknown>> | Paged<Record<string, unknown>>>(
        request,
        "GET",
        "/results/admin/clinic-targets/",
        admin.access,
      );
      clinicTarget = rowsFrom(body).find((row) => (
        Number(row.enrollment_id) === created.enrollmentId
        && Number(row.source_id) === created.examId
        && row.source_type === "exam"
        && Number(row.clinic_link_id) > 0
      )) ?? null;
      return clinicTarget !== null;
    }, { timeoutMs: 60_000, intervalMs: 1_000, description: "required ClinicLink target" });
    expect(clinicTarget).toMatchObject({ exam_score: 20, cutline_score: 80 });

    for (const [hour, suffix] of [["17:00:00", "17시"], ["18:00:00", "18시"]] as const) {
      const session = await expectApi<{ id: number }>(request, "POST", "/clinic/sessions/", admin.access, {
        title: `${marker} ${suffix}`,
        date: clinicDate,
        start_time: hour,
        duration_minutes: 60,
        location: `${marker} 실사용실`,
        max_participants: 5,
        target_grade: null,
        target_school_type: null,
        target_lecture_ids: [created.lectureId],
        allow_multi_slot_booking: true,
      }, [201]);
      created.clinicSessionIds.push(Number(session.id));
    }

    const booking = await expectApi<{ count: number; participants: Participant[] }>(
      request,
      "POST",
      "/clinic/participants/bulk-create/",
      studentTokens.access,
      {
        session_ids: created.clinicSessionIds,
        student_request_memo: "필수 대상 같은 주 2회 예약 후 1회 취소 검증",
      },
      [201],
    );
    expect(booking.count).toBe(2);
    expect(booking.participants).toHaveLength(2);
    expect(booking.participants.every((row) => ["pending", "booked"].includes(row.status))).toBe(true);
    expect(booking.participants.every((row) => row.student === student.id)).toBe(true);
    created.participantIds = booking.participants.map((row) => row.id);

    const cancelParticipantId = created.participantIds[0];
    const cancelled = await expectApi<Participant & {
      notification: {
        requested: number;
        failed: number;
        send_to: string;
        targets: Array<{ target: string; requested: boolean }>;
      };
    }>(
      request,
      "PATCH",
      `/clinic/participants/${cancelParticipantId}/set_status/`,
      studentTokens.access,
      { status: "cancelled" },
      [200],
    );
    expect(cancelled).toMatchObject({
      status: "cancelled",
      notification: {
        requested: 2,
        failed: 0,
        send_to: "both",
        targets: expect.arrayContaining([
          { target: "student", requested: true },
          { target: "parent", requested: true },
        ]),
      },
    });

    const remaining = await expectApi<Participant[]>(
      request,
      "GET",
      `/clinic/participants/by_session/?session_id=${created.clinicSessionIds[1]}`,
      admin.access,
    );
    expect(remaining).toContainEqual(expect.objectContaining({
      id: created.participantIds[1],
      student: student.id,
      status: expect.stringMatching(/^(pending|booked)$/),
    }));

    const originPrefix = `clinic_participant:${cancelParticipantId}:clinic_cancelled`;
    let deliveryRows: NotificationLog[] = [];
    await waitForCondition(async () => {
      const logs = await expectApi<Paged<NotificationLog>>(
        request,
        "GET",
        `/messaging/log/?scope=clinic&status=success&origin_id_prefix=${encodeURIComponent(originPrefix)}&page_size=50`,
        admin.access,
      );
      deliveryRows = logs.results.filter((row) => row.notification_type === "clinic_cancelled");
      return deliveryRows.length === 2;
    }, { timeoutMs: 90_000, intervalMs: 1_000, description: "two mock cancellation deliveries" });
    expect(deliveryRows).toHaveLength(2);
    expect(deliveryRows.map((row) => row.target_type).sort()).toEqual(["parent", "student"]);
    // Redacted phone summaries can legitimately collide when both recipients share
    // the same visible prefix. Distinct durable target types prove the two deliveries.
    expect(deliveryRows.every((row) => row.recipient_summary.length > 0)).toBe(true);
    expect(new Set(deliveryRows.map((row) => row.template_summary)).size).toBe(1);
    expect(deliveryRows.every((row) => row.template_summary.length > 0)).toBe(true);
    expect(deliveryRows.every((row) => row.success)).toBe(true);
    expect(deliveryRows.every((row) => row.origin_id.startsWith(originPrefix))).toBe(true);
    expect(deliveryRows.every((row) => row.provider_message_id.startsWith("mock-"))).toBe(true);

    boundary.assertClean();
  });
});
