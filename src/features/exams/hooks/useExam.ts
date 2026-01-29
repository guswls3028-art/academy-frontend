// PATH: src/features/exams/hooks/useExam.ts

import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

export type ExamDetail = {
  id: number;
  title: string;
  description: string;
  subject: string;
  exam_type: "template" | "regular";
  open_at: string | null;
  close_at: string | null;
  allow_retake: boolean;
  max_attempts: number;
};

async function fetchExam(examId: number): Promise<ExamDetail> {
  const res = await api.get(`/exams/${examId}/`);
  return res.data;
}

export function useExam(examId: number | null | undefined) {
  return useQuery({
    queryKey: ["exam-detail", examId],
    queryFn: () => fetchExam(Number(examId)),

    // ✅🔥 Production Fix (NaN 방지 핵심)
    enabled: Number.isFinite(examId),

    staleTime: 1000 * 60 * 5,
  });
}
