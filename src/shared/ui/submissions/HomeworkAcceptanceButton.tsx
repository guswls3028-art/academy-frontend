import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { notificationQueryKeys } from "@/shared/api/queryKeys/notifications";
import { assessmentQueryKeys } from "@/shared/api/queryKeys/assessments";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { setHomeworkAcceptance } from "@/shared/api/contracts/staffHomeworkFiles";
import { extractApiError } from "@/shared/utils/extractApiError";

type Props = {
  homeworkId: number;
  sessionId: number;
  studentId: number | null | undefined;
  enrollmentId: number;
  accepted: boolean | null;
  updatedAt: string | null;
  fingerprint: string | null;
};

export default function HomeworkAcceptanceButton({ homeworkId, sessionId, studentId, enrollmentId, accepted, updatedAt, fingerprint }: Props) {
  const client = useQueryClient();
  const action = useMutation({
    mutationFn: async () => {
      if (!fingerprint || accepted === null) throw new Error("최신 제출 상태를 확인해 주세요.");
      await setHomeworkAcceptance(homeworkId, enrollmentId, !accepted, updatedAt, fingerprint);
    },
    onSettled: async () => {
      const keys: ReadonlyArray<readonly unknown[]> = [
        notificationQueryKeys.operationalCounts,
        scoresQueryKeys.sessionScores(sessionId),
        assessmentQueryKeys.adminHomeworkSubmissions(homeworkId),
        assessmentQueryKeys.teacherHomeworkSubmissions(homeworkId),
        ...(studentId ? [assessmentQueryKeys.studentHomeworkFiles(studentId), ["student", studentId, "grades"], ["student-exams", studentId]] : []),
      ];
      await Promise.all(keys.map(queryKey => client.invalidateQueries({ queryKey })));
    },
  });
  if (accepted == null || !fingerprint) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {accepted && <strong className="text-sm" role="status">통과 인정됨</strong>}
      <Button type="button" intent={accepted ? "secondary" : "primary"} size="sm"
        title={accepted ? "기존 점수를 유지하고 통과 인정을 취소합니다" : "기존 점수를 유지하고 이 과제를 통과로 인정합니다"}
        disabled={action.isPending} onClick={() => action.mutate()}>
        {action.isPending ? "저장 중…" : accepted ? "통과 인정 취소" : "통과"}
      </Button>
      {action.isError && <span role="alert">{extractApiError(action.error, "저장하지 못했습니다. 최신 제출 상태를 확인한 뒤 다시 시도해 주세요.")}</span>}
    </div>
  );
}
