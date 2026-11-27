import type { QueryClient } from "@tanstack/react-query";
import { notificationQueryKeys } from "@/shared/api/queryKeys/notifications";
import { assessmentQueryKeys } from "@/shared/api/queryKeys/assessments";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";

export async function refreshHomeworkDecisions(client: QueryClient, homeworkId: number, sessionId: number, studentIds: number[]) {
  return refreshHomeworkBatch(client, [homeworkId], [sessionId], studentIds);
}

export async function refreshHomeworkBatch(client: QueryClient, homeworkIds: number[], sessionIds: number[], studentIds: number[]) {
  const keys: ReadonlyArray<readonly unknown[]> = [
    notificationQueryKeys.operationalCounts,
    assessmentQueryKeys.homeworkReviewQueue,
    ...Array.from(new Set(sessionIds), id => scoresQueryKeys.sessionScores(id)),
    ...Array.from(new Set(homeworkIds)).flatMap(id => [assessmentQueryKeys.adminHomeworkSubmissions(id), assessmentQueryKeys.teacherHomeworkSubmissions(id)]),
    ...Array.from(new Set(studentIds)).flatMap(studentId => [assessmentQueryKeys.studentHomeworkFiles(studentId), ["student", studentId, "grades"], ["student-exams", studentId]]),
  ];
  await Promise.all(keys.map(queryKey => client.invalidateQueries({ queryKey })));
}
