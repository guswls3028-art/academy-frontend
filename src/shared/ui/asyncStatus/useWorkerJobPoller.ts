// PATH: src/shared/ui/asyncStatus/useWorkerJobPoller.ts
// Workbox polling: tenant-scoped, tab-aware, backoff. No infinite loops.

import { useEffect, useRef } from "react";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { asyncStatusStore } from "./asyncStatusStore";
import api from "@/shared/api/axios";

const POLL_INTERVAL_INITIAL_MS = 5000;   // 5s for first 1 min
const POLL_INTERVAL_MID_MS = 15000;      // 15s up to 10 min
const POLL_INTERVAL_SLOW_MS = 30000;     // 30s after 10 min
const BACKOFF_AFTER_MS = 60 * 1000;      // 1 min
const BACKOFF_MID_AFTER_MS = 10 * 60 * 1000; // 10 min

function pollExcelJob(
  taskId: string,
  onSuccess?: () => void
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
        asyncStatusStore.completeTask(taskId, "success");
      }
    })
    .catch(() => {
      // 네트워크 오류 시 재시도는 다음 폴링에서
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
  options?: { onExcelSuccess?: () => void; onVideoSuccess?: () => void }
) {
  const pending = tasks.filter(
    (t) => t.status === "pending" && t.meta?.jobId
  );
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onExcelSuccessRef = useRef(options?.onExcelSuccess);
  const onVideoSuccessRef = useRef(options?.onVideoSuccess);
  onExcelSuccessRef.current = options?.onExcelSuccess;
  onVideoSuccessRef.current = options?.onVideoSuccess;

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
      const videoCb = onVideoSuccessRef.current;
      forCurrentTenant.forEach((t) => {
        if (t.meta!.jobType === "excel_parsing") {
          pollExcelJob(t.id, excelCb);
        } else if (t.meta!.jobType === "video_processing") {
          pollVideoJob(t.id, t.meta!.jobId, videoCb);
        } else {
          pollExcelJob(t.id);
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
