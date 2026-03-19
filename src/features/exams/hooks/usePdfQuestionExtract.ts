// PATH: src/features/exams/hooks/usePdfQuestionExtract.ts
// 공통 hook — PDF 업로드 → AI 문항 분할 job 제출 → 상태 폴링

import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { feedback } from "@/shared/ui/feedback/feedback";

export type PdfExtractStatus = "idle" | "uploading" | "processing" | "done" | "failed";

export function usePdfQuestionExtract(examId: number) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<PdfExtractStatus>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const upload = useCallback(async (file: File) => {
    cleanup();
    setStatus("uploading");
    setError(null);
    setJobId(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("exam_id", String(examId));

      const res = await api.post("/exams/pdf-extract/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const id = res.data?.job_id;
      if (!id) throw new Error("job_id not returned");

      setJobId(id);
      setStatus("processing");
      feedback.info("PDF 문항 분할이 시작되었습니다.");

      // Poll for completion
      pollRef.current = setInterval(async () => {
        try {
          const sr = await api.get(`/jobs/${id}/`);
          const s = (sr.data?.status ?? "").toUpperCase();

          if (s === "DONE") {
            cleanup();
            setStatus("done");
            feedback.success("문항 분할이 완료되었습니다.");
            // Invalidate related queries
            qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
          } else if (s === "FAILED") {
            cleanup();
            setStatus("failed");
            setError(sr.data?.error_message ?? "문항 분할에 실패했습니다.");
            feedback.error("문항 분할에 실패했습니다.");
          }
        } catch {
          cleanup();
          setStatus("failed");
          setError("상태 조회 중 오류 발생");
        }
      }, 3000);

      // Safety timeout: 2 minutes
      setTimeout(() => {
        if (pollRef.current) {
          cleanup();
          setStatus("failed");
          setError("시간 초과 — 관리자에게 문의하세요.");
        }
      }, 120000);

    } catch (e: any) {
      setStatus("failed");
      setError(e?.response?.data?.detail ?? e?.message ?? "PDF 업로드 실패");
      feedback.error(e?.response?.data?.detail ?? "PDF 업로드 실패");
    }
  }, [examId, cleanup, qc]);

  const reset = useCallback(() => {
    cleanup();
    setStatus("idle");
    setJobId(null);
    setError(null);
  }, [cleanup]);

  return { status, jobId, error, upload, reset };
}
