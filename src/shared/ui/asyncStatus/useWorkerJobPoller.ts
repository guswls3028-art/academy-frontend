// PATH: src/shared/ui/asyncStatus/useWorkerJobPoller.ts
// Workbox polling: tenant-scoped, tab-aware, backoff. No infinite loops.

import { useEffect, useRef } from "react";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { asyncStatusStore } from "./asyncStatusStore";
import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";

const POLL_INTERVAL_INITIAL_MS = 5000;   // 5s for first 1 min
const POLL_INTERVAL_MID_MS = 15000;      // 15s up to 10 min
const POLL_INTERVAL_SLOW_MS = 30000;     // 30s after 10 min
const BACKOFF_AFTER_MS = 60 * 1000;      // 1 min
const BACKOFF_MID_AFTER_MS = 10 * 60 * 1000; // 10 min

function pollExcelJob(
  taskId: string,
  onSuccess?: () => void,
  onProgress?: () => void
) {
  // ✅ Redis-only 엔드포인트 사용 (DB 부하 0)
  api
    .get<{
      job_id: string;
      job_type: string;
      status: string;
      progress?: {
        step?: string;
        percent?: number;
        step_index?: number | null;
        step_total?: number | null;
        step_name?: string | null;
        step_name_display?: string | null;
        step_percent?: number | null;
      } | null;
      result?: Record<string, unknown>;
      error_message?: string | null;
    }>(`/jobs/${encodeURIComponent(taskId)}/progress/`)
    .then((res) => {
      const status = res.data?.status;
      
      // ✅ UNKNOWN 상태 처리 (Redis TTL 만료 등)
      if (status === "UNKNOWN") {
        // 다음 폴링에서 재시도 (폴링 계속 진행)
        return;
      }
      
      const progress = res.data?.progress;
      const percent = progress?.percent;
      const stepIndex = progress?.step_index;
      const stepTotal = progress?.step_total;
      const stepName = progress?.step_name_display || progress?.step_name;
      const stepPercent = progress?.step_percent;
      
      // ✅ 단계 정보 구성 (단계 정보가 있으면 항상 전달)
      const encodingStep =
        typeof stepIndex === "number" &&
        typeof stepTotal === "number" &&
        typeof stepName === "string" &&
        typeof stepPercent === "number"
          ? { index: stepIndex, total: stepTotal, name: stepName, percent: stepPercent }
          : null;
      
      // ✅ RUNNING 상태에서 진행률 업데이트 (단계 정보가 있으면 항상 전달)
      if (status === "RUNNING") {
        onProgress?.();
        // percent가 없어도 단계 정보만 있으면 업데이트 (단계별 진행률 표시)
        const finalPercent = typeof percent === "number" ? percent : (encodingStep ? Math.round((encodingStep.index - 1) / encodingStep.total * 100 + (encodingStep.percent / encodingStep.total)) : undefined);
        if (finalPercent !== undefined || encodingStep) {
          asyncStatusStore.updateProgress(taskId, finalPercent ?? 0, undefined, encodingStep);
        } else {
          // ✅ RUNNING인데 아직 progress 미도착: 0%로 표시해 "대기 중" 대신 진행 중으로 표기 (video batch와 동일)
          asyncStatusStore.updateProgress(taskId, 0, undefined, null);
        }
      }
      
      // ✅ 완료/실패 상태 처리
      const errMsg = res.data?.error_message?.trim();
      const isFailed = status === "FAILED" || 
                       status === "REJECTED_BAD_INPUT" || 
                       status === "FALLBACK_TO_GPU" || 
                       status === "REVIEW_REQUIRED" ||
                       (status === "DONE" && errMsg);
      
      if (isFailed) {
        asyncStatusStore.completeTask(
          taskId,
          "error",
          errMsg || "처리 실패"
        );
      } else if (status === "DONE") {
        onSuccess?.();
        // 엑셀 등록 결과 상세 표시
        const result = res.data?.result as Record<string, unknown> | undefined;
        if (result) {
          const created = Number(result.created ?? 0);
          const dupCount = Array.isArray(result.duplicates) ? result.duplicates.length : 0;
          const restoredCount = Array.isArray(result.restored) ? result.restored.length : 0;
          const failedCount = Array.isArray(result.failed) ? result.failed.length : 0;
          const parts: string[] = [];
          if (created > 0) parts.push(`신규 등록 ${created}명`);
          if (dupCount > 0) parts.push(`이미 등록된 학생 ${dupCount}명`);
          if (restoredCount > 0) parts.push(`복원 ${restoredCount}명`);
          if (failedCount > 0) parts.push(`실패 ${failedCount}명`);
          const summary = parts.length > 0 ? parts.join(", ") : "완료";
          asyncStatusStore.setTaskLabel(taskId, `학생 일괄 등록 — ${summary}`);
          if (restoredCount > 0) {
            feedback.success(`삭제 대기중인 학생 ${restoredCount}명이 모두 복원되었습니다.`);
          }
          if (dupCount > 0 || failedCount > 0) {
            const msgs: string[] = [];
            if (dupCount > 0) msgs.push(`이미 등록된 학생 ${dupCount}명`);
            if (failedCount > 0) msgs.push(`실패 ${failedCount}명`);
            feedback.error(`학생 등록 결과: ${msgs.join(", ")}`);
          }
        }
        asyncStatusStore.completeTask(taskId, "success");
      }
    })
    .catch(() => {
      // 네트워크 오류 시 재시도는 다음 폴링에서
    });
}

function pollPptJob(
  taskId: string,
  onSuccess?: (taskId: string, downloadUrl: string, filename: string) => void,
) {
  api
    .get<{
      job_id: string;
      job_type: string;
      status: string;
      progress?: {
        step?: string;
        percent?: number;
        step_index?: number | null;
        step_total?: number | null;
        step_name?: string | null;
        step_name_display?: string | null;
        step_percent?: number | null;
      } | null;
      result?: {
        download_url?: string;
        filename?: string;
        slide_count?: number;
        size_bytes?: number;
      };
      error_message?: string | null;
    }>(`/jobs/${encodeURIComponent(taskId)}/progress/`)
    .then((res) => {
      const status = res.data?.status;

      if (status === "UNKNOWN") return;

      const progress = res.data?.progress;
      const percent = progress?.percent;
      const stepIndex = progress?.step_index;
      const stepTotal = progress?.step_total;
      const stepName = progress?.step_name_display || progress?.step_name;
      const stepPercent = progress?.step_percent;

      const encodingStep =
        typeof stepIndex === "number" &&
        typeof stepTotal === "number" &&
        typeof stepName === "string" &&
        typeof stepPercent === "number"
          ? { index: stepIndex, total: stepTotal, name: stepName, percent: stepPercent }
          : null;

      if (status === "RUNNING") {
        const finalPercent = typeof percent === "number"
          ? percent
          : encodingStep
            ? Math.round((encodingStep.index - 1) / encodingStep.total * 100 + (encodingStep.percent / encodingStep.total))
            : undefined;
        if (finalPercent !== undefined || encodingStep) {
          asyncStatusStore.updateProgress(taskId, finalPercent ?? 0, undefined, encodingStep);
        } else {
          asyncStatusStore.updateProgress(taskId, 0, undefined, null);
        }
      }

      const errMsg = res.data?.error_message?.trim();
      const isFailed = status === "FAILED" || (status === "DONE" && errMsg);

      if (isFailed) {
        asyncStatusStore.completeTask(taskId, "error", errMsg || "PPT 생성 실패");
      } else if (status === "DONE") {
        const result = res.data?.result;
        if (result?.slide_count) {
          const sizeLabel = result.size_bytes
            ? result.size_bytes < 1024 * 1024
              ? `${(result.size_bytes / 1024).toFixed(1)} KB`
              : `${(result.size_bytes / (1024 * 1024)).toFixed(1)} MB`
            : "";
          const label = `PPT 생성 완료 (${result.slide_count}장${sizeLabel ? ", " + sizeLabel : ""})`;
          asyncStatusStore.setTaskLabel(taskId, label);
        }
        asyncStatusStore.completeTask(taskId, "success");
        if (result?.download_url && result?.filename) {
          onSuccess?.(taskId, result.download_url, result.filename);
        }
      }
    })
    .catch(() => {
      // Network error — retry on next poll
    });
}

/** 매치업 분석 작업 폴링 — /jobs/<id>/progress/ 일반 엔드포인트 + 성공 시 문제 개수 라벨링 */
function pollMatchupJob(taskId: string, onSuccess?: () => void) {
  api
    .get<{
      job_id: string;
      job_type: string;
      status: string;
      progress?: {
        step?: string;
        percent?: number;
        step_name?: string | null;
        step_name_display?: string | null;
      } | null;
      result?: {
        problem_count?: number;
        document_id?: number;
      };
      error_message?: string | null;
    }>(`/jobs/${encodeURIComponent(taskId)}/progress/`)
    .then((res) => {
      const status = res.data?.status;
      if (status === "UNKNOWN") return;

      const progress = res.data?.progress;
      const percent = progress?.percent;

      if (status === "RUNNING") {
        const finalPercent = typeof percent === "number" ? percent : 0;
        asyncStatusStore.updateProgress(taskId, finalPercent, undefined, null);
      }

      const errMsg = res.data?.error_message?.trim();
      const isFailed = status === "FAILED" || (status === "DONE" && errMsg);

      if (isFailed) {
        asyncStatusStore.completeTask(taskId, "error", errMsg || "매치업 분석 실패");
      } else if (status === "DONE") {
        const result = res.data?.result;
        const cnt = Number(result?.problem_count ?? 0);
        if (cnt > 0) {
          asyncStatusStore.setTaskLabel(taskId, `매치업 분석 완료 — ${cnt}문제 추출`);
        } else {
          asyncStatusStore.setTaskLabel(taskId, "매치업 분석 완료");
        }
        asyncStatusStore.completeTask(taskId, "success");
        onSuccess?.();
      }
    })
    .catch(() => {
      // network — retry on next poll
    });
}

function pollVideoJob(taskId: string, videoId: string, onSuccess?: () => void) {
  // ✅ Redis-only 엔드포인트 사용 (DB 부하 0)
  api
    .get<{
      id: number;
      status: string;
      encoding_progress?: number | null;
      encoding_remaining_seconds?: number | null;
      encoding_step_index?: number | null;
      encoding_step_total?: number | null;
      encoding_step_name?: string | null;
      encoding_step_percent?: number | null;
      hls_path?: string | null;
      duration?: number | null;
      error_reason?: string | null;
      message?: string; // UNKNOWN 상태 시
    }>(`/media/videos/${videoId}/progress/`)
    .then((res) => {
      const status = res.data?.status;
      
      // ✅ UNKNOWN 상태 처리 (Redis TTL 만료 등)
      if (status === "UNKNOWN") {
        // 다음 폴링에서 재시도 (폴링 계속 진행)
        return;
      }
      
      const encodingProgress = res.data?.encoding_progress;
      const remainingSeconds = res.data?.encoding_remaining_seconds ?? null;
      const stepIndex = res.data?.encoding_step_index;
      const stepTotal = res.data?.encoding_step_total;
      const stepName = res.data?.encoding_step_name;
      const stepPercent = res.data?.encoding_step_percent;
      
      // ✅ 단계 정보 구성 (단계 정보가 있으면 항상 전달)
      const encodingStep =
        typeof stepIndex === "number" &&
        typeof stepTotal === "number" &&
        typeof stepName === "string" &&
        typeof stepPercent === "number"
          ? { index: stepIndex, total: stepTotal, name: stepName, percent: stepPercent }
          : null;
      
      // ✅ PROCESSING 상태에서 진행률 업데이트 (단계 정보가 있으면 항상 전달)
      if (status === "PROCESSING") {
        // encodingProgress가 없어도 단계 정보만 있으면 업데이트
        const finalProgress = typeof encodingProgress === "number" 
          ? Math.min(99, Math.max(1, encodingProgress))
          : (encodingStep ? Math.round((encodingStep.index - 1) / encodingStep.total * 100 + (encodingStep.percent / encodingStep.total)) : undefined);
        if (finalProgress !== undefined || encodingStep) {
          asyncStatusStore.updateProgress(
            taskId,
            finalProgress ?? 0,
            remainingSeconds ?? undefined,
            encodingStep
          );
        }
      } else if (status === "UPLOADED") {
        // UPLOADED 상태는 progress 엔드포인트에서 반환되지 않지만, 하위 호환성 유지
        asyncStatusStore.updateProgress(taskId, 10);
      }
      
      // ✅ 완료/실패 상태 처리
      if (status === "READY") {
        onSuccess?.();
        asyncStatusStore.completeTask(taskId, "success");
      } else if (status === "FAILED") {
        const errorReason = res.data?.error_reason?.trim();
        asyncStatusStore.completeTask(
          taskId, 
          "error", 
          errorReason || "영상 처리 실패"
        );
      }
    })
    .catch(() => {
      // 네트워크 오류 시 재시도는 다음 폴링에서
    });
}

export function useWorkerJobPoller(
  tasks: { id: string; status: string; meta?: { jobId: string; jobType: string } }[],
  options?: {
    onExcelSuccess?: () => void;
    onVideoSuccess?: () => void;
    onExcelProgress?: () => void;
    onPptSuccess?: (taskId: string, downloadUrl: string, filename: string) => void;
  }
) {
  const pending = tasks.filter(
    (t) => t.status === "pending" && t.meta?.jobId
  );
  const intervalRef = useRef<number | null>(null);
  const onExcelSuccessRef = useRef(options?.onExcelSuccess);
  const onVideoSuccessRef = useRef(options?.onVideoSuccess);
  const onExcelProgressRef = useRef(options?.onExcelProgress);
  const onPptSuccessRef = useRef(options?.onPptSuccess);
  onExcelSuccessRef.current = options?.onExcelSuccess;
  onVideoSuccessRef.current = options?.onVideoSuccess;
  onExcelProgressRef.current = options?.onExcelProgress;
  onPptSuccessRef.current = options?.onPptSuccess;

  const currentTenant = getTenantCodeForApiRequest() ?? "";
  const pollStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (pending.length === 0) {
      pollStartedAtRef.current = null;
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const getIntervalMs = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return 0;
      const started = pollStartedAtRef.current ?? Date.now();
      pollStartedAtRef.current = started;
      const elapsed = Date.now() - started;
      if (elapsed < BACKOFF_AFTER_MS) return POLL_INTERVAL_INITIAL_MS;
      if (elapsed < BACKOFF_MID_AFTER_MS) return POLL_INTERVAL_MID_MS;
      return POLL_INTERVAL_SLOW_MS;
    };

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const all = asyncStatusStore.getState();
      const forCurrentTenant = all.filter(
        (t) =>
          t.status === "pending" &&
          t.meta?.jobId &&
          (t.tenantScope ?? "") === currentTenant
      );
      if (forCurrentTenant.length === 0) return;
      const excelCb = onExcelSuccessRef.current;
      const excelProgressCb = onExcelProgressRef.current;
      const videoCb = onVideoSuccessRef.current;
      const pptCb = onPptSuccessRef.current;
      forCurrentTenant.forEach((t) => {
        if (t.meta!.jobType === "excel_parsing") {
          pollExcelJob(t.id, excelCb, excelProgressCb);
        } else if (t.meta!.jobType === "video_processing") {
          pollVideoJob(t.id, t.meta!.jobId, videoCb);
        } else if (t.meta!.jobType === "ppt_generation") {
          pollPptJob(t.id, pptCb);
        } else if (t.meta!.jobType === "matchup_analysis") {
          pollMatchupJob(t.id);
        } else if (t.meta!.jobType === "messaging") {
          // 메시지 발송은 동기 API 완료로만 완료 처리, 폴링 없음
        } else {
          pollExcelJob(t.id, excelCb, excelProgressCb);
        }
      });
    };

    let intervalMs = getIntervalMs();
    if (intervalMs <= 0) return;

    const schedule = () => {
      intervalMs = getIntervalMs();
      if (intervalMs <= 0) return;
      intervalRef.current = window.setTimeout(() => {
        tick();
        schedule();
      }, intervalMs);
    };
    tick();
    schedule();

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "hidden" && intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      } else if (document.visibilityState === "visible" && pending.length > 0) {
        tick();
        schedule();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentTenant, pending.length, pending.map((p) => p.id).join(",")]);
}
