// src/student/domains/exams/api/assets.ts
/**
 * ✅ Student Exam Assets API (LOCK v1)
 * - 학생은 download만 (업로드는 관리자/교사)
 * - asset_type 의미 해석 ❌
 */

import api from "@/student/shared/api/studentApi";

export type ExamAsset = {
  id: number;
  asset_type: string;
  download_url: string;
};

export async function fetchExamAssets(examId: number): Promise<ExamAsset[]> {
  const res = await api.get(`/exams/${examId}/assets/`);
  const data = res.data;
  if (Array.isArray(data?.items)) return data.items as ExamAsset[];
  if (Array.isArray(data)) return data as ExamAsset[];
  return [];
}
