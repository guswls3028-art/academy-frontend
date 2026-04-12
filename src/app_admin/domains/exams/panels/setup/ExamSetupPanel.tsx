import { useSearchParams } from "react-router-dom";
import { useSessionParams } from "@admin/domains/sessions/hooks/useSessionParams";
import ExamPolicyPanel from "./ExamPolicyPanel";
import ExamEnrollmentPanel from "./ExamEnrollmentPanel";
import ExamBulkActionsPanel from "./ExamBulkActionsPanel";

export default function ExamSetupPanel({ examId }: { examId: number }) {
  const { sessionId: sessionIdFromPath, lectureId: lectureIdFromPath } = useSessionParams();
  const [sp] = useSearchParams();
  const sessionIdFromQuery = Number(sp.get("session_id"));
  const sessionId = Number.isFinite(sessionIdFromQuery) && sessionIdFromQuery > 0
    ? sessionIdFromQuery
    : (sessionIdFromPath ?? 0);
  const lectureId = lectureIdFromPath ?? 0;

  const hasSession = Number.isFinite(sessionId) && sessionId > 0;

  return (
    <div className="space-y-6">
      <ExamPolicyPanel examId={examId} lectureId={lectureId} sessionId={sessionId} />
      {hasSession && <ExamEnrollmentPanel examId={examId} />}

      <ExamBulkActionsPanel examId={examId} />
    </div>
  );
}
