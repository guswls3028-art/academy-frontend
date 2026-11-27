import type { QueryClient } from "@tanstack/react-query";
import { updateAttendance } from "@/shared/api/contracts/attendance";
import { attendanceQueryKeys } from "@/shared/api/queryKeys/attendance";
import { feedback } from "@/shared/ui/feedback/feedback";
import { scoresQueryKeys } from "./queryKeys";

export async function saveScoreAttendance(
  qc: QueryClient,
  attendanceId: number,
  change: Parameters<typeof updateAttendance>[1],
  sessionId: number,
  lectureId?: number | null,
) {
  await updateAttendance(attendanceId, change);
  void qc.invalidateQueries({ queryKey: scoresQueryKeys.attendance(sessionId) });
  void qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) });
  if (!change.restore_scope && !change.confirm_secession) return;
  void qc.invalidateQueries({ queryKey: scoresQueryKeys.attendanceMatrix(lectureId) });
  void qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionEnrollments(sessionId) });
  void qc.invalidateQueries({ queryKey: attendanceQueryKeys.enrolledIds(sessionId) });
  void qc.invalidateQueries({ queryKey: attendanceQueryKeys.lectureEnrollmentsRoot });
  feedback.success(change.restore_scope ? "수강을 복구하고 출결을 저장했습니다." : "퇴원 처리되었습니다.");
}
