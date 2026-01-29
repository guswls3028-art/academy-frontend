// PATH: src/features/sessions/hooks/useSessionParams.ts

import { useParams } from "react-router-dom";

/**
 * ✅ Session 파라미터 단일 진실
 * - lectures / sessions 어디서든 동일하게 사용
 * - parsing 책임을 hook으로 고정
 */
export function useSessionParams() {
  const { lectureId, sessionId } = useParams<{
    lectureId?: string;
    sessionId?: string;
  }>();

  const parsedLectureId = lectureId ? Number(lectureId) : undefined;
  const parsedSessionId = sessionId ? Number(sessionId) : undefined;

  return {
    lectureId: Number.isFinite(parsedLectureId)
      ? parsedLectureId
      : undefined,
    sessionId: Number.isFinite(parsedSessionId)
      ? parsedSessionId
      : undefined,
  };
}
