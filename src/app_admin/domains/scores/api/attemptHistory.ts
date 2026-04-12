// PATH: src/app_admin/domains/scores/api/attemptHistory.ts
/**
 * 시험/과제 시도 히스토리 API
 * - 드로어에서 1차, 2차, 3차... 차수별 이력 + 재시도 입력 지원
 */
import api from "@/shared/api/axios";

export type AttemptEntry = {
  attempt_index: number;
  score: number | null;
  passed: boolean | null;
  at: string | null;
  source: "grade" | "clinic";
};

export type AttemptHistoryResponse = {
  source_type: "exam" | "homework";
  source_id: number;
  source_title: string;
  pass_score: number | null;
  max_score: number;
  attempts: AttemptEntry[];
  clinic_link_id: number | null;
  resolved: boolean | null;
};

export async function fetchAttemptHistory(params: {
  enrollment_id: number;
  exam_id?: number;
  homework_id?: number;
}): Promise<AttemptHistoryResponse> {
  const res = await api.get("/results/admin/attempt-history/", { params });
  return res.data;
}
