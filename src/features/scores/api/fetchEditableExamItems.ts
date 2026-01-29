// PATH: src/features/scores/api/fetchEditableExamItems.ts
/**
 * results 도메인 문항별 점수 조회 (READ ONLY)
 * - scores 작업대에서 소비
 * - 단일진실: results
 */

import api from "@/shared/api/axios";
import type { EditableScoreCell } from "../types";

export async function fetchEditableExamItems(params: {
  examId: number;
  enrollmentId: number;
}) {
  const { examId, enrollmentId } = params;

  const res = await api.get(
    `/results/admin/exams/${examId}/enrollments/${enrollmentId}/`
  );

  return res.data.items as EditableScoreCell[];
}
