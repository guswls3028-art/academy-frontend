/**
 * E2E Data Helper — 테스트 데이터를 동적으로 조회
 *
 * hardcoded ID 의존을 제거하기 위해 API에서 실제 존재하는 데이터를 조회한다.
 * 모든 함수는 로그인 완료된 page 컨텍스트에서 호출해야 한다.
 */
import type { Page } from "@playwright/test";
import { apiCall } from "./api";

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
  /** beforeAll 이 새로 만든 세션이면 cleanup 대상 */
  ownedSessionId: number | null;
  /** beforeAll 이 새로 추가한 참가자 (cascade 로 세션 삭제 시 같이 삭제됨, 보고용) */
  ownedParticipantId: number | null;
}

/**
 * 트리거 검증 (12-clinic-trigger-real 등) 을 위해 **오늘 세션 + 참가자** 를 보장.
 *
 * 동작:
 *  1. 오늘 참가자 있는 세션 있으면 그대로 사용 (cleanup 불필요, ownedSessionId=null)
 *  2. 없으면 자동 생성 — `[E2E-{ts}]` 태그 세션 + 학생 1명 추가
 *     - 학생 ID 우선순위: env `E2E_CLINIC_STUDENT_ID` > 첫 학생 (admin/students/?page_size=1)
 *
 * cleanupEnsuredClinicSession() 으로 짝맞게 정리 필수.
 */
export async function ensureClinicSessionForTrigger(page: Page): Promise<EnsuredClinicSession> {
  const existing = await getTodayClinicSession(page);
  if (existing) {
    return { session: existing, ownedSessionId: null, ownedParticipantId: null };
  }

  // ── 세션 생성 ──
  const today = todayISO();
  const ts = Date.now();
  const startTime = "12:00:00";
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
    throw new Error(
      `클리닉 세션 자동 생성 실패: status=${createSess.status} body=${JSON.stringify(createSess.body)}`,
    );
  }
  const newSessionId = createSess.body.id as number;

  // ── 학생 ID 결정 ──
  const envStudentId = Number.parseInt(process.env.E2E_CLINIC_STUDENT_ID || "0", 10);
  let studentId: number | null = envStudentId > 0 ? envStudentId : null;

  if (studentId === null) {
    const studRes = await apiCall(page, "GET", "/admin/students/?page_size=1");
    const arr = (studRes.body?.results ?? studRes.body ?? []) as Array<{ id: number }>;
    if (arr.length > 0) studentId = arr[0].id;
  }

  if (studentId === null) {
    // 세션은 만들었으니 정리 후 throw
    await apiCall(page, "DELETE", `/clinic/sessions/${newSessionId}/`).catch(() => {});
    throw new Error("학생을 찾을 수 없어 클리닉 setup 실패 (E2E_CLINIC_STUDENT_ID 미설정 + 학생 0명)");
  }

  // ── 참가자 추가 ──
  const createPart = await apiCall(page, "POST", "/clinic/participants/", {
    session: newSessionId,
    student: studentId,
  });
  if (createPart.status !== 201) {
    await apiCall(page, "DELETE", `/clinic/sessions/${newSessionId}/`).catch(() => {});
    throw new Error(
      `클리닉 참가자 자동 추가 실패: status=${createPart.status} body=${JSON.stringify(createPart.body)}`,
    );
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
    ownedParticipantId: createPart.body.id ?? null,
  };
}

/**
 * ensureClinicSessionForTrigger 가 만든 세션이면 삭제. 외부 세션이면 noop.
 * 세션 삭제 시 참가자는 cascade.
 */
export async function cleanupEnsuredClinicSession(
  page: Page,
  ensured: EnsuredClinicSession,
): Promise<void> {
  if (ensured.ownedSessionId === null) return;
  await apiCall(page, "DELETE", `/clinic/sessions/${ensured.ownedSessionId}/`);
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
