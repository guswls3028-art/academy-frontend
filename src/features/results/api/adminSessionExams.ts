// PATH: src/features/results/api/adminSessionExams.ts

import api from "@/shared/api/axios";

export type SessionExamRow = {
  exam_id: number;
  title: string;
  open_at: string | null;
  close_at: string | null;
  allow_retake: boolean;
  max_attempts: number;
};

export async function fetchAdminSessionExams(sessionId: number) {
  const res = await api.get(
    `/results/admin/sessions/${sessionId}/exams/`
  );

  const d = res.data;

  // ✅ 방어 파싱만 추가 (이것만)
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.results)) return d.results;

  return [];
}
