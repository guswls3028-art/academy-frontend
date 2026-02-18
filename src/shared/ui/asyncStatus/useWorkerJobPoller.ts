// PATH: src/shared/ui/asyncStatus/useWorkerJobPoller.ts
// 워커 작업(엑셀·영상 등) 상태/진행률 폴링 — 우하단 프로그래스바 갱신 및 완료 처리
// ✅ Redis-only 엔드포인트 사용 (DB 부하 0)
// 엑셀: GET /jobs/<id>/progress/. 영상: GET /media/videos/<id>/progress/.
// 현재 테넌트 작업만 폴링 (태넌트 격리).

import { useEffect, useRef } from "react";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { asyncStatusStore } from "./asyncStatusStore";
// ✅ getJobStatus는 더 이상 사용하지 않음 (progress 엔드포인트로 전환)
import api from "@/shared/api/axios";

const POLL_INTERVAL_MS = 1000;

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
      const encodingStep =
        typeof stepIndex === "number" &&
        typeof stepTotal === "number" &&
        typeof stepName === "string" &&
        typeof stepPercent === "number"
          ? { index: stepIndex, total: stepTotal, name: stepName, percent: stepPercent }
          : null;
      
      // ✅ PROCESSING 상태에서 진행률 업데이트
      if (status === "PROCESSING" && typeof encodingProgress === "number") {
        asyncStatusStore.updateProgress(
          taskId,
          Math.min(99, Math.max(1, encodingProgress)),
          remainingSeconds ?? undefined,
          encodingStep
        );
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExcelSuccessRef = useRef(options?.onExcelSuccess);
  const onVideoSuccessRef = useRef(options?.onVideoSuccess);
  onExcelSuccessRef.current = options?.onExcelSuccess;
  onVideoSuccessRef.current = options?.onVideoSuccess;

  const currentTenant = getTenantCodeForApiRequest() ?? "";

  useEffect(() => {
    if (pending.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    const tick = () => {
      const all = asyncStatusStore.getState();
      const forCurrentTenant = all.filter(
        (t) =>
          t.status === "pending" &&
          t.meta?.jobId &&
          (t.tenantScope ?? "") === currentTenant
      );
      const excelCb = onExcelSuccessRef.current;
      const videoCb = onVideoSuccessRef.current;
      forCurrentTenant.forEach((t) => {
        if (t.meta!.jobType === "excel_parsing") {
          // ✅ taskId는 async status store의 task ID (t.id), jobId는 API 호출용
          pollExcelJob(t.id, excelCb);
        } else if (t.meta!.jobType === "video_processing") {
          // ✅ taskId는 async status store의 task ID (t.id), videoId는 비디오 ID (t.meta!.jobId)
          pollVideoJob(t.id, t.meta!.jobId, videoCb);
        } else {
          // ✅ SSOT: 모든 워커 작업은 동일한 방식으로 처리
          // messaging, omr, omr_scan 등도 /jobs/{id}/progress/ 엔드포인트 사용
          pollExcelJob(t.id); // 동일한 엔드포인트 사용 (job_id 기반)
        }
      });
    };
    tick();
    intervalRef.current = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentTenant, pending.length, pending.map((p) => p.id).join(",")]);
}
