// PATH: src/app_admin/domains/exams/hooks/usePdfQuestionExtract.ts
// 통합 hook — 시험 자료 원본 업로드 + 지원 형식 AI 문항 분할 + 결과 폴링
//
// 플로우:
//   1. POST /exams/pdf-extract/ (원본 저장 + 자료 유형 판별 + job 제출)
//   2. GET /jobs/{jobId}/ (폴링 → 완료 대기)
//   3. 완료 시 캐시 무효화 → 문항 목록 자동 반영
//
// 진입점 2개(자산 탭, 답안 등록 모달)에서 동일하게 사용

import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { feedback } from "@/shared/ui/feedback/feedback";
import { adminExamsQueryKeys } from "../queryKeys";
import { extractApiError } from "@/shared/utils/extractApiError";

export type PdfExtractStatus =
  | "idle"
  | "uploading"       // 파일 업로드 중
  | "processing"      // AI 문항 분할 처리 중
  | "done"            // 완료
  | "conversion_required" // 원본은 보관되었고 직접 등록·검수가 필요함
  | "failed";         // 실패

export type PdfExtractProgress = {
  percent: number;
  stepName?: string;
  stepIndex?: number;
  stepTotal?: number;
};

export type PdfExtractResult = {
  totalQuestions: number;
  answerCount: number;
  explanationCount: number;
  pageCount: number;
  conversionRequired: boolean;
  sourceMode?: string;
  message?: string;
  pairedSourceStatus?: "complete" | "partial";
  missingAnswerNumbers: number[];
  missingExplanationNumbers: number[];
  sourceIssues: string[];
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

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === "number" ? item : Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
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
  const answers = Array.isArray(record.answers) ? record.answers : [];
  const matchedExplanations = explanations.filter((item) => {
    const explanation = asRecord(item);
    return explanation.question_number != null;
  });

  return {
    totalQuestions: asNumber(record.total_questions) ?? boxes.length,
    answerCount: asNumber(record.answer_count) ?? answers.length,
    explanationCount: matchedExplanations.length,
    pageCount: asNumber(record.page_count) ?? 1,
    conversionRequired: record.conversion_required === true,
    sourceMode: asString(record.source_mode),
    message: asString(record.message),
    pairedSourceStatus: record.paired_source_status === "partial" ? "partial" : "complete",
    missingAnswerNumbers: asNumberArray(record.missing_answer_numbers),
    missingExplanationNumbers: asNumberArray(record.missing_explanation_numbers),
    sourceIssues: asStringArray(record.source_issues),
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
  const pollInFlightRef = useRef(false);

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
        if (pollInFlightRef.current) return;
        pollInFlightRef.current = true;
        // 최대 폴링 시간 초과 시 타임아웃
        if (Date.now() - pollStartTime > MAX_POLL_DURATION) {
          stopPolling();
          setStatus("failed");
          setError("문항 분할 처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
          feedback.error("문항 분할 처리 시간이 초과되었습니다.");
          pollInFlightRef.current = false;
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
              answerCount: 0,
              explanationCount: 0,
              pageCount: 1,
              conversionRequired: false,
              missingAnswerNumbers: [],
              missingExplanationNumbers: [],
              sourceIssues: [],
            };
            setResult(resultPayload);

            if (resultPayload.conversionRequired) {
              setStatus("conversion_required");
              feedback.warning(
                resultPayload.message
                || "원본은 보관했습니다. 자동 분리가 완전하지 않으면 직접 등록해 검수해 주세요.",
              );
              qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examAssets(examId) });
              qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExam(examId) });
              return;
            }

            if (resultPayload.pairedSourceStatus === "partial") {
              feedback.warning(
                `문항 ${resultPayload.totalQuestions}개를 찾았습니다. 인식되지 않은 정답·해설을 검수해 주세요.`,
              );
            } else {
              feedback.success(
                `문항 분할 완료: ${resultPayload.totalQuestions}개 후보를 검수해 주세요.`,
              );
            }

            // 캐시 무효화 → 문항 목록·자산 자동 갱신
            qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examAssets(examId) });
            qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examQuestions(examId) });
            qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExam(examId) });
            qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examExplanations(examId) });
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
        } finally {
          pollInFlightRef.current = false;
        }
      }, POLL_INTERVAL);
    },
    [examId, qc, stopPolling],
  );

  const upload = useCallback(
    async (
      file: File,
      answerFile?: File | null,
      explanationFile?: File | null,
    ) => {
      stopPolling();
      setStatus("uploading");
      setError(null);
      setResult(null);
      setProgress({ percent: 0 });

      try {
        // 원본 저장과 job 제출을 한 요청으로 처리해 큰 파일을 두 번 보내지 않는다.
        const extractFd = new FormData();
        extractFd.append("file", file);
        extractFd.append("exam_id", String(examId));
        if (explanationFile) {
          extractFd.append("explanation_file", explanationFile);
        }
        if (answerFile) {
          extractFd.append("answer_file", answerFile);
        }

        const extractResp = await api.post("/exams/pdf-extract/", extractFd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        setProgress({ percent: 10, stepName: "원본 업로드 완료" });

        const responseRecord = asRecord(extractResp.data);
        if (["conversion_required", "source_saved"].includes(asString(responseRecord.status) ?? "")) {
          setStatus("conversion_required");
          setResult({
            totalQuestions: 0,
            answerCount: 0,
            explanationCount: 0,
            pageCount: 1,
            conversionRequired: true,
            message: asString(responseRecord.message),
            missingAnswerNumbers: [],
            missingExplanationNumbers: [],
            sourceIssues: [],
          });
          feedback.warning(
            asString(responseRecord.message)
            || "원본을 저장했습니다. 시험 상세에서 문항과 해설을 직접 등록해 검수해 주세요.",
          );
          qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examAssets(examId) });
          qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExam(examId) });
          return;
        }

        const jobId = asString(responseRecord.job_id);
        if (!jobId) {
          throw new Error("AI job 제출 실패: job_id를 받지 못했습니다.");
        }

        // 처리 상태 폴링 시작
        setStatus("processing");
        setProgress({ percent: 15, stepName: "AI 문항 분할 시작" });
        feedback.info("문항 번호에 정답과 선생님 원본 해설을 맞추고 있습니다...");
        pollJobStatus(jobId);
      } catch (e: unknown) {
        stopPolling();
        setStatus("failed");
        const msg = extractApiError(e, "시험 자료 처리 실패");
        setError(msg);
        feedback.error(msg);
      }
    },
    [examId, pollJobStatus, qc, stopPolling],
  );

  const reset = useCallback(() => {
    stopPolling();
    setStatus("idle");
    setError(null);
    setResult(null);
    setProgress({ percent: 0 });
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { status, error, progress, result, upload, reset };
}
