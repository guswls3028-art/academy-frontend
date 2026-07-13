/**
 * E2E Data Helper — 테스트 데이터를 동적으로 조회
 *
 * hardcoded ID 의존을 제거하기 위해 API에서 실제 존재하는 데이터를 조회한다.
 * 모든 함수는 로그인 완료된 page 컨텍스트에서 호출해야 한다.
 */
import type { Page } from "@playwright/test";
import { apiCall } from "./api";
import { PRODUCTION_CONTROLLED_PHONE } from "./safety";

export interface LectureSession {
  lectureId: number;
  sessionId: number;
  lectureName: string;
}

export interface ClinicSessionInfo {
  sessionId: number;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:MM or HH:MM:SS
  title?: string;
  location?: string;
  participantCount: number;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * 오늘 날짜에 **참가자가 있는** 클리닉 세션을 1건 조회한다.
 * 없으면 null — 호출자는 ensureClinicSessionForTrigger() 로 자동 setup 권장.
 */
export async function getTodayClinicSession(page: Page): Promise<ClinicSessionInfo | null> {
  const today = todayISO();
  const res = await apiCall(page, "GET", `/clinic/sessions/?date_from=${today}&date_to=${today}`);
  if (res.status !== 200) return null;

  const sessions = (res.body?.results ?? res.body ?? []) as Array<{
    id: number;
    date: string;
    start_time: string;
    title?: string;
    location?: string;
    participant_count?: number;
  }>;

  // 참가자 있는 세션 우선, 없으면 null
  const withParticipants = sessions.find((s) => (s.participant_count ?? 0) > 0);
  if (!withParticipants) return null;

  return {
    sessionId: withParticipants.id,
    date: withParticipants.date,
    startTime: withParticipants.start_time,
    title: withParticipants.title,
    location: withParticipants.location,
    participantCount: withParticipants.participant_count ?? 0,
  };
}

export interface EnsuredClinicSession {
  session: ClinicSessionInfo;
  /** 테스트가 만든 세션. cleanup 대상. */
  ownedSessionId: number;
  /** 테스트가 만든 참가자. 세션 삭제 시 cascade. */
  ownedParticipantId: number;
  /** 테스트가 만든 통제번호 학생. 세션 삭제 후 cleanup 대상. */
  ownedStudentId: number;
}

/**
 * 트리거 검증 (12-clinic-trigger-real 등) 을 위해 **오늘 세션 + 참가자** 를 보장.
 *
 * 운영 데이터는 재사용하지 않는다. `[E2E-{ts}]` 학생·세션·참가자를 모두
 * 새로 만들며 학생 연락처는 통제번호로 고정한다.
 *
 * cleanupEnsuredClinicSession() 으로 짝맞게 정리 필수.
 */
export async function ensureClinicSessionForTrigger(page: Page): Promise<EnsuredClinicSession> {
  const today = todayISO();
  const ts = Date.now();
  const startTime = "12:00:00";
  const studentName = `[E2E-${ts}] clinic trigger student`;
  const createStudent = await apiCall<{ id?: number }>(page, "POST", "/students/", {
    name: studentName,
    ps_number: `e2eclinic${String(ts).slice(-8)}`,
    parent_phone: PRODUCTION_CONTROLLED_PHONE,
    no_phone: true,
    school_type: "HIGH",
    high_school: "E2E고",
    grade: 1,
    gender: "M",
    initial_password: "test1234",
    memo: `[E2E-${ts}] clinic trigger fixture`,
  });
  if (createStudent.status !== 201 || !createStudent.body?.id) {
    throw new Error(
      `클리닉 테스트 학생 생성 실패: status=${createStudent.status} body=${JSON.stringify(createStudent.body)}`,
    );
  }
  const studentId = createStudent.body.id;

  // ── 세션 생성 ──
  const createSess = await apiCall(page, "POST", "/clinic/sessions/", {
    title: `[E2E-${ts}] auto trigger setup`,
    date: today,
    start_time: startTime,
    duration_minutes: 60,
    location: "E2E-Room",
    max_participants: 10,
    target_lecture_ids: [],
  });
  if (createSess.status !== 201) {
    await cleanupClinicTriggerStudent(page, studentId, true);
    throw new Error(
      `클리닉 세션 자동 생성 실패: status=${createSess.status} body=${JSON.stringify(createSess.body)}`,
    );
  }
  const newSessionId = Number((createSess.body as { id?: number })?.id);
  if (!Number.isFinite(newSessionId) || newSessionId <= 0) {
    await cleanupClinicTriggerStudent(page, studentId, true);
    throw new Error(`클리닉 세션 생성 응답에 id가 없습니다: ${JSON.stringify(createSess.body)}`);
  }

  // ── 참가자 추가 ──
  const createPart = await apiCall(page, "POST", "/clinic/participants/", {
    session: newSessionId,
    student: studentId,
  });
  if (createPart.status !== 201) {
    await apiCall(page, "DELETE", `/clinic/sessions/${newSessionId}/`).catch(() => {});
    await cleanupClinicTriggerStudent(page, studentId, true);
    throw new Error(
      `클리닉 참가자 자동 추가 실패: status=${createPart.status} body=${JSON.stringify(createPart.body)}`,
    );
  }

  const participantId = Number((createPart.body as { id?: number })?.id);
  if (!Number.isFinite(participantId) || participantId <= 0) {
    await apiCall(page, "DELETE", `/clinic/sessions/${newSessionId}/`).catch(() => {});
    await cleanupClinicTriggerStudent(page, studentId, true);
    throw new Error(`클리닉 참가자 생성 응답에 id가 없습니다: ${JSON.stringify(createPart.body)}`);
  }

  return {
    session: {
      sessionId: newSessionId,
      date: today,
      startTime,
      title: `[E2E-${ts}] auto trigger setup`,
      location: "E2E-Room",
      participantCount: 1,
    },
    ownedSessionId: newSessionId,
    ownedParticipantId: participantId,
    ownedStudentId: studentId,
  };
}

async function cleanupClinicTriggerStudent(
  page: Page,
  studentId: number,
  bestEffort = false,
): Promise<void> {
  for (const path of ["/students/bulk_delete/", "/students/bulk_permanent_delete/"]) {
    try {
      const response = await apiCall(page, "POST", path, { ids: [studentId] });
      if (![200, 204, 404].includes(response.status)) {
        throw new Error(`${path} -> ${response.status} ${JSON.stringify(response.body)}`);
      }
    } catch (error) {
      if (!bestEffort) throw error;
    }
  }
}

/**
 * 테스트 세션과 통제번호 학생을 순서대로 정리한다.
 */
export async function cleanupEnsuredClinicSession(
  page: Page,
  ensured: EnsuredClinicSession,
): Promise<void> {
  const sessionDelete = await apiCall(page, "DELETE", `/clinic/sessions/${ensured.ownedSessionId}/`);
  if (![200, 204, 404].includes(sessionDelete.status)) {
    throw new Error(
      `클리닉 fixture 세션 정리 실패: ${sessionDelete.status} ${JSON.stringify(sessionDelete.body)}`,
    );
  }
  await cleanupClinicTriggerStudent(page, ensured.ownedStudentId);
}

/**
 * 첫 번째 강의의 첫 번째 차시 ID를 동적 조회한다.
 * scores/attendance 테스트에서 URL 구성에 사용.
 */
export async function getFirstLectureSession(page: Page): Promise<LectureSession> {
  const res = await apiCall(page, "GET", "/admin/lectures/");
  if (res.status !== 200) {
    throw new Error(`Failed to fetch lectures: ${res.status}`);
  }

  const lectures = res.body.results ?? res.body;
  if (!lectures?.length) {
    throw new Error("No lectures found for this tenant");
  }

  const lecture = lectures[0];
  const lectureId = lecture.id;
  const lectureName = lecture.name ?? `Lecture ${lectureId}`;

  // 차시 목록 조회
  const sessRes = await apiCall(page, "GET", `/admin/lectures/${lectureId}/sessions/`);
  if (sessRes.status !== 200) {
    throw new Error(`Failed to fetch sessions for lecture ${lectureId}: ${sessRes.status}`);
  }

  const sessions = sessRes.body.results ?? sessRes.body;
  if (!sessions?.length) {
    throw new Error(`No sessions found for lecture ${lectureId}`);
  }

  return {
    lectureId,
    sessionId: sessions[0].id,
    lectureName,
  };
}

/**
 * 수강생이 있는 차시를 찾는다.
 * 점수/출결 테스트에서 의미 있는 데이터가 필요할 때 사용.
 */
export async function getSessionWithParticipants(page: Page): Promise<LectureSession | null> {
  const res = await apiCall(page, "GET", "/admin/lectures/");
  if (res.status !== 200) return null;

  const lectures = res.body.results ?? res.body;
  for (const lecture of lectures) {
    const sessRes = await apiCall(page, "GET", `/admin/lectures/${lecture.id}/sessions/`);
    if (sessRes.status !== 200) continue;

    const sessions = sessRes.body.results ?? sessRes.body;
    for (const session of sessions) {
      if (session.participant_count > 0 || session.participants_count > 0) {
        return {
          lectureId: lecture.id,
          sessionId: session.id,
          lectureName: lecture.name ?? `Lecture ${lecture.id}`,
        };
      }
    }
  }
  return null;
}
