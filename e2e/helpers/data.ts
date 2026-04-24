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
