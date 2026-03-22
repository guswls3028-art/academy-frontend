// PATH: src/features/exams/hooks/usePdfQuestionExtract.ts
// 통합 hook — 시험지 PDF 업로드 (POST /exams/{examId}/assets/ asset_type="problem_pdf")
// 진입점 2개(자산 탭, 답안 등록 모달)에서 동일하게 사용

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { feedback } from "@/shared/ui/feedback/feedback";

export type PdfExtractStatus = "idle" | "uploading" | "done" | "failed";

export function usePdfQuestionExtract(examId: number) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<PdfExtractStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File) => {
    setStatus("uploading");
    setError(null);

    try {
      const fd = new FormData();
      fd.append("asset_type", "problem_pdf");
      fd.append("file", file);

      await api.post(`/exams/${examId}/assets/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setStatus("done");
      feedback.success("시험지 PDF 업로드 완료");

      // 자산 목록 즉시 반영
      qc.invalidateQueries({ queryKey: ["exam-assets", examId] });
      qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
    } catch (e: any) {
      setStatus("failed");
      const detail = e?.response?.data?.detail;
      const msg = detail ?? "시험지 PDF 업로드 실패";
      setError(msg);
      feedback.error(msg);
    }
  }, [examId, qc]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { status, error, upload, reset };
}
