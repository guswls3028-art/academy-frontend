// PATH: src/features/results/api/myExamResult.ts
import api from "@/shared/api/axios";

export type MyExamResultItem = {
  question_id: number;
  answer: string;
  is_correct: boolean;
  score: number;
  max_score: number;
  source: string;
};

export type MyExamResult = {
  target_type: "exam";
  target_id: number; // exam_id
  enrollment_id: number;

  // ✅ 백엔드가 내려줌 (대표 attempt 스냅샷 기준)
  attempt_id: number | null;

  total_score: number;
  max_score: number;
  submitted_at: string | null;

  // ✅ 재시험 버튼 판단용: 백엔드 계산값
  allow_retake: boolean;
  max_attempts: number;
  can_retake: boolean;

  // ✅ progress pipeline 결과
  clinic_required: boolean;

  // ⚠️ 주의: passed는 현재 백엔드가 명시적으로 제공하지 않음
  // - pass 여부를 화면에 보여주려면 pass_score 정책과 계산 기준을 백엔드와 먼저 확정해야 안전함
  passed?: boolean;

  items: MyExamResultItem[];
};

export async function fetchMyExamResult(examId: number): Promise<MyExamResult> {
  const res = await api.get(`/results/me/exams/${examId}/`);
  return res.data;
}
