import type { QueryClient } from "@tanstack/react-query";
import { notificationQueryKeys } from "@/shared/api/queryKeys/notifications";
import { assessmentQueryKeys } from "@/shared/api/queryKeys/assessments";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";

export async function refreshHomeworkDecisions(client: QueryClient, homeworkId: number, sessionId: number, studentIds: number[]) {
  const keys: ReadonlyArray<readonly unknown[]> = [
    notificationQueryKeys.operationalCounts,
    scoresQueryKeys.sessionScores(sessionId),
    assessmentQueryKeys.adminHomeworkSubmissions(homeworkId),
    assessmentQueryKeys.teacherHomeworkSubmissions(homeworkId),
    ...studentIds.flatMap(studentId => [assessmentQueryKeys.studentHomeworkFiles(studentId), ["student", studentId, "grades"], ["student-exams", studentId]]),
  ];
  await Promise.all(keys.map(queryKey => client.invalidateQueries({ queryKey })));
}
