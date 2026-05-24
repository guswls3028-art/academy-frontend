import { useParams } from "react-router-dom";

export function useLectureSessionParams() {
  const { lectureId, sessionId } = useParams<{
    lectureId?: string;
    sessionId?: string;
  }>();

  const parsedLectureId = lectureId ? Number(lectureId) : undefined;
  const parsedSessionId = sessionId ? Number(sessionId) : undefined;

  return {
    lectureId: Number.isFinite(parsedLectureId) ? parsedLectureId : undefined,
    sessionId: Number.isFinite(parsedSessionId) ? parsedSessionId : undefined,
  };
}
