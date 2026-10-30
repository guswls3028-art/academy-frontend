// PATH: src/shared/ui/asyncStatus/useWorkerJobPoller.ts
// Workbox polling: tenant-scoped, tab-aware, backoff. No infinite loops.

import { useEffect, useRef } from "react";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { asyncStatusStore, type AsyncTask } from "./asyncStatusStore";
import { pollExcelJob } from "./excelJobPolling";
import { feedback } from "@/shared/ui/feedback/feedback";
import api, { createAuthSessionBoundConfig, type ApiRequestConfig } from "@/shared/api/axios";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import {
  claimOmrUploadBatchCompletionApi,
  fetchOmrUploadBatchApi,
} from "@/shared/api/contracts/submissions";
import { fetchVideoDetail, type VideoStatus } from "@/shared/api/contracts/videos";
import { completedPptResult } from "@/shared/api/contracts/pptJob";
import { isFailedAIJobStatus } from "@/shared/api/contracts/aiJob";

const POLL_INTERVAL_INITIAL_MS = 5000;   // 5s for first 1 min
const POLL_INTERVAL_MID_MS = 15000;      // 15s up to 10 min
const POLL_INTERVAL_SLOW_MS = 30000;     // 30s after 10 min
const BACKOFF_AFTER_MS = 60 * 1000;      // 1 min
const BACKOFF_MID_AFTER_MS = 10 * 60 * 1000; // 10 min
const VIDEO_DETAIL_FALLBACK_AFTER_FAILURES = 3;
const VIDEO_DETAIL_FALLBACK_COOLDOWN_MS = 30 * 1000;
const omrPollsInFlight = new Map<string, Promise<void>>();
const aiPollsInFlight = new Set<string>();

type VideoRecoveryState = {
  cohortGeneration: number;
  consecutiveFailures: number;
  detailRequestInFlight: boolean;
  detailRequestGeneration: number;
  detailRequestController?: AbortController;
  lastDetailCheckAt: number;
};

type VideoPollCohort = {
  generation: number;
  signal: AbortSignal;
  isCurrent: () => boolean;
};

type AiPollContext = {
  requestConfig: ApiRequestConfig;
  isCurrent: () => boolean;
};

const UNAVAILABLE_AI_TASK_MESSAGE = "작업을 찾을 수 없거나 조회 권한이 없습니다. 원본 화면에서 상태를 확인해 주세요.";

function handleAiPollFailure(taskId: string, context: AiPollContext, error: unknown) {
  if (!context.isCurrent()) return;
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 403 || status === 404) {
    asyncStatusStore.completeTask(taskId, "error", UNAVAILABLE_AI_TASK_MESSAGE);
  }
  // Temporary network/server failures retain the task for the next poll.
}

/** Share the workbox request boundary across PPT, Matchup and its pending-document watcher. */
function pollAiWorkerTask(
  task: AsyncTask,
  tenantScope: string,
  cohort: VideoPollCohort,
  poll: (context: AiPollContext) => Promise<void>,
) {
  const generation = readAuthTokenEnvelopeSafely()?.generation;
  const sessionGeneration = asyncStatusStore.getSessionGeneration();
  if (!tenantScope || !generation) return;
  const key = `${tenantScope}:${generation}:${task.id}`;
  const isCurrent = () => cohort.isCurrent()
    && getTenantCodeForApiRequest() === tenantScope
    && readAuthTokenEnvelopeSafely()?.generation === generation
    && asyncStatusStore.getSessionGeneration() === sessionGeneration
    && asyncStatusStore.getState().some((current) => current.id === task.id
      && current.status === "pending" && current.tenantScope === tenantScope
      && current.meta?.jobType === task.meta?.jobType);
  if (aiPollsInFlight.has(key) || !isCurrent()) return;
  aiPollsInFlight.add(key);
  void poll({
    requestConfig: createAuthSessionBoundConfig(generation, cohort.signal, tenantScope),
    isCurrent,
  }).finally(() => { aiPollsInFlight.delete(key); });
}

function isCurrentTenantOmrTask(
  taskId: string,
  tenantScope: string,
  sessionGeneration: number,
): boolean {
  if ((getTenantCodeForApiRequest() ?? "") !== tenantScope) return false;
  if (asyncStatusStore.getSessionGeneration() !== sessionGeneration) return false;
  return asyncStatusStore.getState().some(
    (task) =>
      task.id === taskId
      && task.status === "pending"
      && task.meta?.jobType === "omr_batch"
      && (task.tenantScope ?? "") === tenantScope,
  );
}

function pollOmrBatch(taskId: string, batchId: string, tenantScope: string): void {
  const sessionGeneration = asyncStatusStore.getSessionGeneration();
  const key = `${tenantScope}:${batchId}`;
  if (
    omrPollsInFlight.has(key)
    || !isCurrentTenantOmrTask(taskId, tenantScope, sessionGeneration)
  ) return;

  const request = (async () => {
    try {
      const summary = await fetchOmrUploadBatchApi(batchId);
      if (!isCurrentTenantOmrTask(taskId, tenantScope, sessionGeneration)) return;

      if (!summary.terminal) {
        asyncStatusStore.upsertOmrBatch(summary);
        return;
      }

      if (summary.completion_notice_claimed) {
        asyncStatusStore.upsertOmrBatch(summary);
        return;
      }

      try {
        const claim = await claimOmrUploadBatchCompletionApi(batchId);
        if (!isCurrentTenantOmrTask(taskId, tenantScope, sessionGeneration)) return;
        asyncStatusStore.upsertOmrBatch(claim.batch);
        if (claim.notify) {
          if (claim.batch.counts.failed > 0) {
            feedback.warning("OMR 처리가 끝났습니다. 실패 항목을 확인해 주세요.");
          } else if (claim.batch.counts.needs_identification > 0) {
            feedback.warning("OMR 처리가 끝났습니다. 식별이 필요한 답안지가 있습니다.");
          } else if (claim.batch.grading_status === "subjective_pending") {
            feedback.info("OMR 객관식 처리가 끝났습니다. 차시 성적에서 서술형 점수를 입력해 주세요.");
          } else {
            feedback.success("OMR 처리가 모두 끝났습니다.");
          }
        }
      } catch {
        if (!isCurrentTenantOmrTask(taskId, tenantScope, sessionGeneration)) return;
        asyncStatusStore.upsertOmrBatch(summary, { awaitCompletionClaim: true });
        asyncStatusStore.setTaskStatusMessage(
          taskId,
          "처리는 끝났으며 완료 알림 상태를 다시 확인하고 있습니다.",
        );
      }
    } catch {
      if (!isCurrentTenantOmrTask(taskId, tenantScope, sessionGeneration)) return;
      asyncStatusStore.setTaskStatusMessage(
        taskId,
        "OMR 진행 상태를 다시 확인하고 있습니다.",
      );
    }
  })().finally(() => {
    if (omrPollsInFlight.get(key) === request) omrPollsInFlight.delete(key);
  });
  omrPollsInFlight.set(key, request);
}

function isCurrentTenantVideoTask(taskId: string, tenantScope: string): boolean {
  if ((getTenantCodeForApiRequest() ?? "") !== tenantScope) return false;
  return asyncStatusStore.getState().some(
    (task) =>
      task.id === taskId
      && task.status === "pending"
      && task.meta?.jobType === "video_processing"
      && (task.tenantScope ?? "") === tenantScope,
  );
}

function nonTerminalVideoStatusMessage(status: VideoStatus): string {
  if (status === "PENDING") return "영상 상세 상태를 확인했습니다. 업로드 대기 중입니다.";
  if (status === "UPLOADED") return "영상 상세 상태를 확인했습니다. 인코딩 대기 중입니다.";
  return "영상 상세 상태를 확인했습니다. 인코딩 처리 중입니다.";
}

async function recoverVideoStatusFromDetail(
  taskId: string,
  videoId: string,
  tenantScope: string,
  recoveryStates: Map<string, VideoRecoveryState>,
  cohort: VideoPollCohort,
  onSuccess?: () => void,
): Promise<void> {
  if (!cohort.isCurrent() || !isCurrentTenantVideoTask(taskId, tenantScope)) return;

  const recoveryKey = `${tenantScope}:${taskId}`;
  const previousRecovery = recoveryStates.get(recoveryKey);
  if (previousRecovery && previousRecovery.cohortGeneration !== cohort.generation) {
    previousRecovery.detailRequestController?.abort();
    recoveryStates.delete(recoveryKey);
  }
  const recovery = recoveryStates.get(recoveryKey) ?? {
    cohortGeneration: cohort.generation,
    consecutiveFailures: 0,
    detailRequestInFlight: false,
    detailRequestGeneration: 0,
    lastDetailCheckAt: 0,
  };
  recovery.consecutiveFailures += 1;
  recoveryStates.set(recoveryKey, recovery);

  const now = Date.now();
  if (
    recovery.consecutiveFailures < VIDEO_DETAIL_FALLBACK_AFTER_FAILURES
    || recovery.detailRequestInFlight
    || now - recovery.lastDetailCheckAt < VIDEO_DETAIL_FALLBACK_COOLDOWN_MS
    || !cohort.isCurrent()
    || !isCurrentTenantVideoTask(taskId, tenantScope)
  ) {
    return;
  }

  recovery.detailRequestInFlight = true;
  recovery.detailRequestGeneration += 1;
  recovery.lastDetailCheckAt = now;
  const detailRequestGeneration = recovery.detailRequestGeneration;
  const detailRequestController = new AbortController();
  recovery.detailRequestController = detailRequestController;
  const abortDetailRequest = () => detailRequestController.abort();
  cohort.signal.addEventListener("abort", abortDetailRequest, { once: true });

  const isCurrentDetailRequest = () =>
    cohort.isCurrent()
    && !detailRequestController.signal.aborted
    && isCurrentTenantVideoTask(taskId, tenantScope)
    && recoveryStates.get(recoveryKey) === recovery
    && recovery.cohortGeneration === cohort.generation
    && recovery.detailRequestGeneration === detailRequestGeneration
    && recovery.detailRequestController === detailRequestController;

  asyncStatusStore.setTaskStatusMessage(
    taskId,
    "실시간 진행률 연결이 불안정해 영상 상세 상태를 다시 확인하고 있습니다.",
  );

  try {
    const video = await fetchVideoDetail(Number(videoId), detailRequestController.signal);
    if (!isCurrentDetailRequest()) return;

    if (video.status === "READY") {
      onSuccess?.();
      asyncStatusStore.completeTask(taskId, "success");
      recoveryStates.delete(recoveryKey);
      return;
    }
    if (video.status === "FAILED") {
      asyncStatusStore.completeTask(
        taskId,
        "error",
        video.error_reason?.trim() || "영상 처리 실패",
      );
      recoveryStates.delete(recoveryKey);
      return;
    }

    asyncStatusStore.setTaskStatusMessage(taskId, nonTerminalVideoStatusMessage(video.status));
  } catch {
    if (isCurrentDetailRequest()) {
      asyncStatusStore.setTaskStatusMessage(
        taskId,
        "영상 처리 상태를 다시 확인 중입니다. 연결이 복구되면 자동으로 반영됩니다.",
      );
    }
  } finally {
    cohort.signal.removeEventListener("abort", abortDetailRequest);
    if (isCurrentDetailRequest()) {
      recovery.consecutiveFailures = 0;
      recovery.detailRequestInFlight = false;
      recovery.detailRequestController = undefined;
    }
  }
}

function pollPptJob(
  taskId: string,
  context: AiPollContext,
  onSuccess?: (taskId: string, downloadUrl: string, filename: string) => void,
) {
  return api
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
    }>(`/jobs/${encodeURIComponent(taskId)}/progress/`, context.requestConfig)
    .then((res) => {
      if (!context.isCurrent()) return;
      const status = res.data?.status;

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

      let result;
      try {
        result = completedPptResult(res.data);
      } catch (error) {
        asyncStatusStore.completeTask(taskId, "error", error instanceof Error ? error.message : "PPT 생성 실패");
        return;
      }
      if (result) {
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
    .catch((error: unknown) => handleAiPollFailure(taskId, context, error));
}

/** 매치업 분석 작업 폴링 — /jobs/<id>/progress/ 일반 엔드포인트 + 성공 시 문제 개수 라벨링 */
function pollMatchupJob(taskId: string, context: AiPollContext, onSuccess?: () => void) {
  return api
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
        processed?: number;
        review_required?: number;
        failed?: Array<unknown>;
      };
      error_message?: string | null;
    }>(`/jobs/${encodeURIComponent(taskId)}/progress/`, context.requestConfig)
    .then((res) => {
      if (!context.isCurrent()) return;
      const status = res.data?.status;
      if (status === "UNKNOWN") {
        // The API falls back to durable DB state before returning UNKNOWN.
        asyncStatusStore.completeTask(taskId, "error", UNAVAILABLE_AI_TASK_MESSAGE);
        return;
      }

      const progress = res.data?.progress;
      const percent = progress?.percent;

      if (status === "RUNNING") {
        const finalPercent = typeof percent === "number" ? percent : 0;
        asyncStatusStore.updateProgress(taskId, finalPercent, undefined, null);
      }

      const errMsg = res.data?.error_message?.trim();
      const isFailed = isFailedAIJobStatus(status) || status === "CANCELLED" || (status === "DONE" && errMsg);

      if (isFailed) {
        asyncStatusStore.completeTask(taskId, "error", errMsg || "매치업 분석 실패");
      } else if (status === "DONE") {
        const result = res.data?.result;
        if (res.data?.job_type === "matchup_public_cleanup") {
          const processed = Number(result?.processed ?? 0);
          const reviewRequired = Number(result?.review_required ?? 0);
          const failed = Array.isArray(result?.failed) ? result.failed.length : 0;
          const reviewText = reviewRequired > 0 ? ` · 검수 ${reviewRequired}개` : "";
          const failedText = failed > 0 ? ` · 실패 ${failed}개` : "";
          asyncStatusStore.setTaskLabel(taskId, `공개용 정리 완료 — ${processed}개${reviewText}${failedText}`);
        } else {
          const cnt = Number(result?.problem_count ?? 0);
          if (cnt > 0) {
            asyncStatusStore.setTaskLabel(taskId, `매치업 분석 완료 — ${cnt}문제 추출`);
          } else {
            asyncStatusStore.setTaskLabel(taskId, "매치업 분석 완료");
          }
        }
        asyncStatusStore.completeTask(taskId, "success");
        onSuccess?.();
      }
    })
    .catch((error: unknown) => handleAiPollFailure(taskId, context, error));
}

/** 매치업 문서 watch 폴링 — ai_job_id 생성 지연 시 Workbox fallback */
function pollMatchupDocumentWatch(taskId: string, documentId: string, context: AiPollContext, onSuccess?: () => void) {
  const normalizedDocumentId = documentId.replace(/^matchup-doc-/, "");
  return api
    .get<{
      document_id: number;
      status: "pending" | "processing" | "done" | "failed";
      ai_job_id: string;
      problem_count: number;
      title: string;
    }>(`/matchup/documents/${encodeURIComponent(normalizedDocumentId)}/job/`, context.requestConfig)
    .then((res) => {
      if (!context.isCurrent()) return;
      const status = res.data?.status;
      const aiJobId = (res.data?.ai_job_id || "").trim();
      const title = res.data?.title || `문서 ${normalizedDocumentId}`;

      // ai_job_id가 생기면 즉시 진짜 job 폴링으로 전환
      if (aiJobId) {
        asyncStatusStore.attachWorkerMeta(taskId, aiJobId, "matchup_analysis");
        asyncStatusStore.setTaskLabel(aiJobId, `매치업 분석: ${title}`);
        return;
      }

      if (status === "failed") {
        asyncStatusStore.completeTask(taskId, "error", "매치업 분석 시작 실패");
      } else if (status === "done") {
        asyncStatusStore.setTaskLabel(taskId, `매치업 분석 완료 — ${res.data?.problem_count ?? 0}문제`);
        asyncStatusStore.completeTask(taskId, "success");
        onSuccess?.();
      } else {
        // pending/processing 동안 최소 진행 상태 유지
        asyncStatusStore.updateProgress(taskId, status === "processing" ? 10 : 5);
      }
    })
    .catch((error: unknown) => handleAiPollFailure(taskId, context, error));
}

function pollVideoJob(
  taskId: string,
  videoId: string,
  tenantScope: string,
  recoveryStates: Map<string, VideoRecoveryState>,
  cohort: VideoPollCohort,
  onSuccess?: () => void,
) {
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
    }>(`/media/videos/${videoId}/progress/`, { signal: cohort.signal })
    .then((res) => {
      if (!cohort.isCurrent() || !isCurrentTenantVideoTask(taskId, tenantScope)) return;
      const status = res.data?.status;
      
      // ✅ UNKNOWN 상태 처리 (Redis TTL 만료 등)
      if (status === "UNKNOWN") {
        void recoverVideoStatusFromDetail(
          taskId,
          videoId,
          tenantScope,
          recoveryStates,
          cohort,
          onSuccess,
        );
        return;
      }

      const recoveryKey = `${tenantScope}:${taskId}`;
      const recovery = recoveryStates.get(recoveryKey);
      if (recovery?.cohortGeneration === cohort.generation) {
        recovery.detailRequestController?.abort();
        if (recoveryStates.get(recoveryKey) === recovery) {
          recoveryStates.delete(recoveryKey);
        }
      }
      asyncStatusStore.setTaskStatusMessage(taskId, undefined);
      
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
      if (!cohort.isCurrent() || !isCurrentTenantVideoTask(taskId, tenantScope)) return;
      void recoverVideoStatusFromDetail(
        taskId,
        videoId,
        tenantScope,
        recoveryStates,
        cohort,
        onSuccess,
      );
    });
}

export function useWorkerJobPoller(
  tasks: { id: string; status: string; meta?: { jobId: string; jobType: string } }[],
  options?: {
    onExcelSuccess?: () => void;
    onVideoSuccess?: () => void;
    onMatchupSuccess?: () => void;
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
  const onMatchupSuccessRef = useRef(options?.onMatchupSuccess);
  const onExcelProgressRef = useRef(options?.onExcelProgress);
  const onPptSuccessRef = useRef(options?.onPptSuccess);
  onExcelSuccessRef.current = options?.onExcelSuccess;
  onVideoSuccessRef.current = options?.onVideoSuccess;
  onMatchupSuccessRef.current = options?.onMatchupSuccess;
  onExcelProgressRef.current = options?.onExcelProgress;
  onPptSuccessRef.current = options?.onPptSuccess;

  const currentTenant = getTenantCodeForApiRequest() ?? "";
  const pendingIdsKey = pending.map((p) => p.id).join(",");
  const pollStartedAtRef = useRef<number | null>(null);
  const pollCohortKeyRef = useRef("");
  const pollGenerationRef = useRef(0);
  const videoRecoveryStatesRef = useRef(new Map<string, VideoRecoveryState>());

  useEffect(() => {
    const generation = pollGenerationRef.current + 1;
    pollGenerationRef.current = generation;
    const cohortController = new AbortController();
    const cohort: VideoPollCohort = {
      generation,
      signal: cohortController.signal,
      isCurrent: () =>
        pollGenerationRef.current === generation && !cohortController.signal.aborted,
    };
    const videoRecoveryStates = videoRecoveryStatesRef.current;

    const activeVideoRecoveryKeys = new Set(
      asyncStatusStore
        .getState()
        .filter(
          (task) =>
            task.status === "pending"
            && task.meta?.jobType === "video_processing"
            && (task.tenantScope ?? "") === currentTenant,
        )
        .map((task) => `${currentTenant}:${task.id}`),
    );
    for (const [recoveryKey, recovery] of videoRecoveryStates) {
      if (!activeVideoRecoveryKeys.has(recoveryKey)) {
        recovery.detailRequestController?.abort();
        videoRecoveryStates.delete(recoveryKey);
      }
    }

    if (pending.length === 0) {
      pollStartedAtRef.current = null;
      pollCohortKeyRef.current = "";
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (pollCohortKeyRef.current !== pendingIdsKey) {
      pollCohortKeyRef.current = pendingIdsKey;
      pollStartedAtRef.current = Date.now();
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
      if (!cohort.isCurrent()) return;
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
      const matchupCb = onMatchupSuccessRef.current;
      const pptCb = onPptSuccessRef.current;
      forCurrentTenant.forEach((t) => {
        if (t.meta!.jobType === "excel_parsing") {
          pollAiWorkerTask(t, currentTenant, cohort, (context) => pollExcelJob(t.id, context, excelCb, excelProgressCb));
        } else if (t.meta!.jobType === "video_processing") {
          pollVideoJob(
            t.id,
            t.meta!.jobId,
            currentTenant,
            videoRecoveryStates,
            cohort,
            videoCb,
          );
        } else if (t.meta!.jobType === "ppt_generation") {
          pollAiWorkerTask(t, currentTenant, cohort, (context) => pollPptJob(t.id, context, pptCb));
        } else if (t.meta!.jobType === "matchup_analysis") {
          pollAiWorkerTask(t, currentTenant, cohort, (context) => pollMatchupJob(t.id, context, matchupCb));
        } else if (t.meta!.jobType === "matchup_public_cleanup") {
          pollAiWorkerTask(t, currentTenant, cohort, (context) => pollMatchupJob(t.id, context, matchupCb));
        } else if (t.meta!.jobType === "matchup_document_watch") {
          pollAiWorkerTask(t, currentTenant, cohort, (context) => pollMatchupDocumentWatch(t.id, t.meta!.jobId, context, matchupCb));
        } else if (t.meta!.jobType === "messaging") {
          // 메시지 발송은 동기 API 완료로만 완료 처리, 폴링 없음
        } else if (t.meta!.jobType === "omr_batch") {
          pollOmrBatch(t.id, t.meta!.jobId, currentTenant);
        } else {
          pollAiWorkerTask(t, currentTenant, cohort, (context) => pollExcelJob(t.id, context, excelCb, excelProgressCb));
        }
      });
    };

    const schedule = () => {
      if (!cohort.isCurrent()) return;
      if (intervalRef.current != null) return;
      const intervalMs = getIntervalMs();
      if (intervalMs <= 0) return;
      intervalRef.current = window.setTimeout(() => {
        intervalRef.current = null;
        if (!cohort.isCurrent()) return;
        tick();
        schedule();
      }, intervalMs);
    };

    const onVisibility = () => {
      if (!cohort.isCurrent()) return;
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

    if (typeof document === "undefined" || document.visibilityState !== "hidden") {
      tick();
      schedule();
    }

    return () => {
      cohortController.abort();
      if (pollGenerationRef.current === generation) {
        pollGenerationRef.current += 1;
      }
      for (const [recoveryKey, recovery] of videoRecoveryStates) {
        if (recovery.cohortGeneration !== generation) continue;
        recovery.detailRequestController?.abort();
        videoRecoveryStates.delete(recoveryKey);
        const taskId = recoveryKey.slice(currentTenant.length + 1);
        if (isCurrentTenantVideoTask(taskId, currentTenant)) {
          asyncStatusStore.setTaskStatusMessage(taskId, undefined);
        }
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentTenant, pending.length, pendingIdsKey]);
}
