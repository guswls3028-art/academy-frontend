import type { MyHomeworkGradeSummary } from "../api/grades.api";

export function acceptsHomeworkFiles(homework: MyHomeworkGradeSummary): boolean {
  return homework.lecture_active !== false && homework.submission_state !== "reviewed"
    && (homework.submission_media_locked == null
      ? homework.teacher_resolved !== true && homework.passed !== true
      : homework.submission_media_locked !== true);
}

function validId(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function homeworkSubmissionHref(homework: MyHomeworkGradeSummary): string | null {
  if (!validId(homework.homework_id) || !validId(homework.session_id) || !validId(homework.enrollment_id)
    || !acceptsHomeworkFiles(homework)) return null;
  return `/student/submit/assignment?sessionId=${homework.session_id}&homeworkId=${homework.homework_id}`;
}
