// PATH: src/app_admin/domains/exams/hooks/usePdfQuestionExtract.ts
// 통합 hook — 시험지 PDF 업로드 + AI 문항 분할 + 결과 폴링
//
// 플로우:
//   1. POST /exams/{examId}/assets/ (자산 저장)
//   2. POST /exams/pdf-extract/ (AI 문항 분할 job 제출)
//   3. GET /jobs/{jobId}/ (폴링 → 완료 대기)
//   4. 완료 시 캐시 무효화 → 문항 목록 자동 반영
//
// 진입점 2개(자산 탭, 답안 등록 모달)에서 동일하게 사용

import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

export type PdfExtractStatus =
  | "idle"
  | "uploading"       // 파일 업로드 중
  | "processing"      // AI 문항 분할 처리 중
  | "done"            // 완료
  | "failed";         // 실패

export type PdfExtractProgress = {
  percent: number;
  stepName?: string;
  stepIndex?: number;
  stepTotal?: number;
};

export type PdfExtractResult = {
  totalQuestions: number;
  explanationCount: number;
  pageCount: number;
} | null;

type JobStatusPayload = {
  status?: string;
  progress?: PdfExtractProgress | null;
  result?: Exclude<PdfExtractResult, null>;
  errorMessage?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeProgress(value: unknown): PdfExtractProgress | null {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return null;
  return {
    percent: asNumber(record.percent) ?? 0,
    stepName: asString(record.step_name_display),
    stepIndex: asNumber(record.step_index),
    stepTotal: asNumber(record.step_total),
  };
}

function normalizeResult(value: unknown): Exclude<PdfExtractResult, null> {
  const record = asRecord(value);
  const boxes = Array.isArray(record.boxes) ? record.boxes : [];
  const explanations = Array.isArray(record.explanations) ? record.explanations : [];
  const matchedExplanations = explanations.filter((item) => {
    const explanation = asRecord(item);
    return explanation.question_number != null;
  });

  return {
    totalQuestions: asNumber(record.total_questions) ?? boxes.length,
    explanationCount: matchedExplanations.length,
    pageCount: asNumber(record.page_count) ?? 1,
  };
}

function normalizeJobStatus(value: unknown): JobStatusPayload {
  const record = asRecord(value);
  return {
    status: asString(record.status),
    progress: normalizeProgress(record.progress),
    result: normalizeResult(record.result),
    errorMessage: asString(record.error_message),
  };
}

export function usePdfQuestionExtract(examId: number) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<PdfExtractStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PdfExtractProgress>({ percent: 0 });
  const [result, setResult] = useState<PdfExtractResult>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollJobStatus = useCallback(
    (jobId: string) => {
      let failCount = 0;
      const MAX_FAILS = 3;
      const POLL_INTERVAL = 2000; // 2초
      const MAX_POLL_DURATION = 5 * 60 * 1000; // 5분
      const pollStartTime = Date.now();

      pollingRef.current = setInterval(async () => {
        // 최대 폴링 시간 초과 시 타임아웃
        if (Date.now() - pollStartTime > MAX_POLL_DURATION) {
          stopPolling();
          setStatus("failed");
          setError("문항 분할 처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
          feedback.error("문항 분할 처리 시간이 초과되었습니다.");
          return;
        }

        try {
          const resp = await api.get(`/jobs/${jobId}/`);
          const data = normalizeJobStatus(resp.data);

          // 진행률 업데이트
          if (data.progress) {
            setProgress(data.progress);
          }

          if (data.status === "DONE") {
            stopPolling();
            setStatus("done");

            const resultPayload = data.result ?? {
              totalQuestions: 0,
              explanationCount: 0,
              pageCount: 1,
            };
            setResult(resultPayload);

            feedback.success(
              `문항 분할 완료: ${resultPayload.totalQuestions}개 문항 인식`
            );

            // 캐시 무효화 → 문항 목록·자산 자동 갱신
            qc.invalidateQueries({ queryKey: ["exam-assets", examId] });
            qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
            qc.invalidateQueries({ queryKey: ["admin-exam", examId] });
            qc.invalidateQueries({ queryKey: ["exam-explanations", examId] });
          } else if (
            data.status === "FAILED" ||
            data.status === "REJECTED_BAD_INPUT"
          ) {
            stopPolling();
            setStatus("failed");
            const msg = data.errorMessage || "문항 분할 처리 실패";
            setError(msg);
            feedback.error(msg);
          }
          // PENDING, RUNNING 등은 계속 폴링

          failCount = 0;
        } catch {
          failCount++;
          if (failCount >= MAX_FAILS) {
            stopPolling();
            setStatus("failed");
            setError("문항 분할 상태 조회 실패 (네트워크 오류)");
            feedback.error("문항 분할 상태를 확인할 수 없습니다.");
          }
        }
      }, POLL_INTERVAL);
    },
    [examId, qc, stopPolling],
  );

  const upload = useCallback(
    async (file: File) => {
      stopPolling();
      setStatus("uploading");
      setError(null);
      setResult(null);
      setProgress({ percent: 0 });

      try {
        // Step 1: 자산으로 저장 (기존 동작 유지)
        const assetFd = new FormData();
        assetFd.append("asset_type", "problem_pdf");
        assetFd.append("file", file);

        await api.post(`/exams/${examId}/assets/`, assetFd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        setProgress({ percent: 10, stepName: "파일 업로드 완료" });

        // Step 2: AI 문항 분할 job 제출
        const extractFd = new FormData();
        extractFd.append("file", file);
        extractFd.append("exam_id", String(examId));

        const extractResp = await api.post("/exams/pdf-extract/", extractFd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const jobId = asString(asRecord(extractResp.data).job_id);
        if (!jobId) {
          throw new Error("AI job 제출 실패: job_id를 받지 못했습니다.");
        }

        // Step 3: 폴링 시작
        setStatus("processing");
        setProgress({ percent: 15, stepName: "AI 문항 분할 시작" });
        feedback.info("AI가 문항을 분석 중입니다...");
        pollJobStatus(jobId);
      } catch (e: unknown) {
        stopPolling();
        setStatus("failed");
        const msg = extractApiError(e, "시험지 처리 실패");
        setError(msg);
        feedback.error(msg);
      }
    },
    [examId, pollJobStatus, stopPolling],
  );

  const reset = useCallback(() => {
    stopPolling();
    setStatus("idle");
    setError(null);
    setResult(null);
    setProgress({ percent: 0 });
  }, [stopPolling]);

  return { status, error, progress, result, upload, reset };
}
