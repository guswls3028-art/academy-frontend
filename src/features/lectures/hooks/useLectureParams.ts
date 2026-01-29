// src/features/lectures/hooks/useLectureParams.ts
import { useParams } from "react-router-dom";

export function useLectureParams() {
  const { lectureId, sessionId } = useParams<{
    lectureId?: string;
    sessionId?: string;
  }>();

  const parsedLectureId = Number(lectureId);
  const parsedSessionId = sessionId ? Number(sessionId) : undefined;

  return {
    lectureId: parsedLectureId,
    sessionId: parsedSessionId,
  };
}
