// PATH: src/shared/ui/asyncStatus/asyncStatusStore.ts
// Workbox: tenant-scoped async tasks. Backend is source of truth for progress.
// All tasks MUST have tenantScope. Display MUST filter by current tenant only.

import { getTenantCodeForApiRequest } from "@/shared/tenant";
import type { OmrUploadBatchSummary } from "@/shared/api/contracts/submissions";
import { getLocalItem, removeLocalItem, setLocalItem } from "@/shared/utils/safeLocalStorage";

export type AsyncTaskStatus = "pending" | "success" | "error";

export interface AsyncTaskMeta {
  jobId: string;
  jobType: string;
  suppressAutoDownload?: boolean;
  /** 랜덤 초기 비밀번호 결과를 새로고침 뒤에도 1시간 안에 복구할 작업 */
  expectsCredentialDownload?: boolean;
  /** 이미 한 번 자동 다운로드한 복구 작업은 새로고침 뒤 자동 재다운로드하지 않음 */
  suppressCredentialAutoDownload?: boolean;
  /** 랜덤 비밀번호 서버 복구 가능 시각과 맞춘 완료 후 복구 만료 시각 */
  credentialRecoveryExpiresAt?: number;
  /** 작업박스 클릭 → 페이지 진입 시 자동 선택 대상 ID (예: matchup doc id).
   *  없으면 페이지만 이동, 있으면 페이지 + 해당 항목 자동 선택. */
  sourceId?: string | number;
}

/** 영상 인코딩 구간별 진행 (n/7) 단계명 + 구간 내 0~100% */
export interface EncodingStep {
  index: number;
  total: number;
  name: string;
  percent: number;
}

export interface StudentImportResultRow {
  row: number | null;
  name: string;
}

export interface StudentImportFailedRow extends StudentImportResultRow {
  reason: string;
}

export interface StudentImportResult {
  total: number;
  createdCount: number;
  duplicateCount: number;
  restoredCount: number;
  failedCount: number;
  createdRows: StudentImportResultRow[];
  duplicateRows: StudentImportResultRow[];
  restoredRows: StudentImportResultRow[];
  failedRows: StudentImportFailedRow[];
  acknowledged: boolean;
}

export interface AsyncTask {
  id: string;
  label: string;
  status: AsyncTaskStatus;
  /** 0..100, 진행 중일 때만 사용 (워커 Redis progress) */
  progress?: number;
  /** 예상 남은 시간(초). API에서 오면 이걸 우선 표시 */
  remainingSeconds?: number | null;
  /** 영상 인코딩 시 구간별 표시 (2/7 인코딩 45% 등) */
  encodingStep?: EncodingStep | null;
  /** 진행률 저장소 장애 시 durable 상태 확인이 계속되고 있음을 표시한다. */
  statusMessage?: string;
  error?: string;
  download?: {
    kind: "student_initial_passwords";
    credentials: Array<{ name: string; login_id: string; password: string }>;
  };
  /** 신규 학생 Excel 행별 처리 결과. 학생 ID·전화번호·비밀번호는 저장하지 않는다. */
  studentImportResult?: StudentImportResult;
  /** 서버 정본 OMR batch 진행률. 파일명·학생정보·R2 key는 포함하지 않는다. */
  omrBatch?: OmrUploadBatchSummary;
  createdAt: number;
  /** 있으면 워커 작업 — 우하단 작업 알람창에만 표시, 폴링 대상 */
  meta?: AsyncTaskMeta;
  /** 태넌트(도메인)별 격리 — 이 키와 일치하는 테넌트에서만 작업 표시 */
  tenantScope?: string;
}

type Listener = (tasks: AsyncTask[]) => void;

const EXCEL_RECOVERY_STORAGE_KEY = "hakwonplus:excel-job-recovery:v1";
const EXCEL_RECOVERY_TTL_MS = 60 * 60 * 1000;
export const MAX_STORED_RESULT_ROWS = 500;

function boundedInteger(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function parseStoredRows(value: unknown): StudentImportResultRow[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_STORED_RESULT_ROWS).flatMap((item) => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string") return [];
    return [{
      row: typeof record.row === "number" && Number.isFinite(record.row) ? record.row : null,
      name: record.name.slice(0, 200),
    }];
  });
}

function parseStoredFailedRows(value: unknown): StudentImportFailedRow[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_STORED_RESULT_ROWS).flatMap((item) => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string" || typeof record.reason !== "string") return [];
    return [{
      row: typeof record.row === "number" && Number.isFinite(record.row) ? record.row : null,
      name: record.name.slice(0, 200),
      reason: record.reason.slice(0, 300),
    }];
  });
}

function parseStoredStudentImportResult(value: unknown): StudentImportResult | undefined {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const createdRows = parseStoredRows(record.createdRows);
  const duplicateRows = parseStoredRows(record.duplicateRows);
  const restoredRows = parseStoredRows(record.restoredRows);
  const failedRows = parseStoredFailedRows(record.failedRows);
  return {
    total: boundedInteger(record.total),
    createdCount: boundedInteger(record.createdCount),
    duplicateCount: Object.prototype.hasOwnProperty.call(record, "duplicateCount")
      ? boundedInteger(record.duplicateCount)
      : duplicateRows.length,
    restoredCount: Object.prototype.hasOwnProperty.call(record, "restoredCount")
      ? boundedInteger(record.restoredCount)
      : restoredRows.length,
    failedCount: Object.prototype.hasOwnProperty.call(record, "failedCount")
      ? boundedInteger(record.failedCount)
      : failedRows.length,
    createdRows,
    duplicateRows,
    restoredRows,
    failedRows,
    acknowledged: record.acknowledged === true,
  };
}

function loadRecoverableExcelTasks(): AsyncTask[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(getLocalItem(EXCEL_RECOVERY_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.flatMap((value): AsyncTask[] => {
      if (value == null || typeof value !== "object" || Array.isArray(value)) return [];
      const task = value as Partial<AsyncTask>;
      if (
        typeof task.id !== "string"
        || typeof task.label !== "string"
        || typeof task.createdAt !== "number"
        || typeof task.tenantScope !== "string"
        || task.meta?.jobType !== "excel_parsing"
        || typeof task.meta.jobId !== "string"
      ) {
        return [];
      }
      const wasCompletedCredentialTask =
        task.status === "success" && task.meta.expectsCredentialDownload === true;
      const studentImportResult = parseStoredStudentImportResult(task.studentImportResult);
      const wasCompletedResultTask =
        (task.status === "success" || task.status === "error") && studentImportResult != null;
      if (task.status !== "pending" && !wasCompletedCredentialTask && !wasCompletedResultTask) return [];
      const isExpired = wasCompletedCredentialTask
        ? (
            typeof task.meta.credentialRecoveryExpiresAt !== "number"
            || now >= task.meta.credentialRecoveryExpiresAt
          )
        : now - task.createdAt >= EXCEL_RECOVERY_TTL_MS;
      if (isExpired) return [];
      return [{
        id: task.id,
        label: task.label,
        status: wasCompletedCredentialTask ? "pending" : (task.status ?? "pending"),
        progress: task.progress,
        error: task.status === "error" && typeof task.error === "string"
          ? task.error.slice(0, 300)
          : undefined,
        studentImportResult,
        createdAt: task.createdAt,
        tenantScope: task.tenantScope,
        meta: {
          ...task.meta,
          suppressCredentialAutoDownload: wasCompletedCredentialTask,
        },
      }];
    });
  } catch {
    return [];
  }
}

let tasks: AsyncTask[] = loadRecoverableExcelTasks();
const listeners = new Set<Listener>();
let sessionGeneration = 0;

function persistRecoverableExcelTasks(): void {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const recoverable = tasks.flatMap((task) => {
      const isPendingExcel =
        task.status === "pending" && task.meta?.jobType === "excel_parsing";
      const isCompletedCredentialTask =
        task.status === "success"
        && task.meta?.jobType === "excel_parsing"
        && task.meta.expectsCredentialDownload === true;
      const isCompletedResultTask =
        (task.status === "success" || task.status === "error")
        && task.meta?.jobType === "excel_parsing"
        && task.studentImportResult != null;
      const isExpired = isCompletedCredentialTask
        ? (
            typeof task.meta?.credentialRecoveryExpiresAt !== "number"
            || now >= task.meta.credentialRecoveryExpiresAt
          )
        : now - task.createdAt >= EXCEL_RECOVERY_TTL_MS;
      if (
        (!isPendingExcel && !isCompletedCredentialTask && !isCompletedResultTask)
        || isExpired
      ) {
        return [];
      }
      const { download, ...withoutPlaintextCredentials } = task;
      void download;
      return [withoutPlaintextCredentials];
    });
    if (recoverable.length > 0) {
      setLocalItem(EXCEL_RECOVERY_STORAGE_KEY, JSON.stringify(recoverable));
    } else {
      removeLocalItem(EXCEL_RECOVERY_STORAGE_KEY);
    }
  } catch {
    // 저장소 차단 환경에서는 현재 탭의 메모리 작업만 유지한다.
  }
}

function emit() {
  persistRecoverableExcelTasks();
  const snapshot = [...tasks];
  listeners.forEach((cb) => cb(snapshot));
}

function generateId(): string {
  return `async-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 라벨 추론: URL 경로 마지막 또는 메서드+경로 */
function defaultLabel(method: string, url?: string): string {
  if (!url) return "요청 중…";
  const path = url.replace(/^.*\/api\/v1/, "").split("?")[0].trim() || "/";
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && !/^\d+$/.test(last)) return `${method.toUpperCase()} ${last}`;
  const resource = parts[parts.length - 2] || "요청";
  return `${method.toUpperCase()} ${resource}`;
}

export const asyncStatusStore = {
  getSessionGeneration(): number {
    return sessionGeneration;
  },

  getState(): AsyncTask[] {
    return [...tasks];
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** 현재 테넌트 코드 (작업 추가 시점에 저장되어 표시 시 필터에 사용) */
  _getTenantScope(): string {
    return getTenantCodeForApiRequest() ?? "";
  },

  /**
   * 새 작업 추가 (일반)
   */
  addTask(label: string, id?: string): string {
    const taskId = id ?? generateId();
    const scope = this._getTenantScope() ?? "";
    tasks = [
      ...tasks.filter((t) => t.id !== taskId),
      {
        id: taskId,
        label,
        status: "pending" as const,
        createdAt: Date.now(),
        tenantScope: scope,
      },
    ];
    emit();
    return taskId;
  },

  /**
   * 워커 작업 추가 — 우하단 작업 알람창에 실시간 프로그래스바로 표시됨.
   * jobId를 id로 사용하여 폴링 시 status/progress 갱신.
   */
  addWorkerJob(
    label: string,
    jobId: string,
    jobType: string,
    sourceId?: string | number,
    options?: {
      suppressAutoDownload?: boolean;
      expectsCredentialDownload?: boolean;
    },
  ): string {
    const scope = this._getTenantScope() ?? "";
    tasks = [
      ...tasks.filter((t) => t.id !== jobId),
      {
        id: jobId,
        label,
        status: "pending" as const,
        createdAt: Date.now(),
        meta: {
          jobId,
          jobType,
          sourceId,
          suppressAutoDownload: options?.suppressAutoDownload,
          expectsCredentialDownload: options?.expectsCredentialDownload,
        },
        tenantScope: scope,
      },
    ];
    emit();
    return jobId;
  },

  /** 서버의 tenant-scoped OMR batch 정본을 작업박스에 반영한다. */
  upsertOmrBatch(
    batch: OmrUploadBatchSummary,
    options?: { awaitCompletionClaim?: boolean },
  ): string {
    const taskId = `omr-batch:${batch.id}`;
    const scope = this._getTenantScope() ?? "";
    const finishedCount =
      batch.counts.completed
      + batch.counts.needs_identification
      + batch.counts.failed
      + batch.counts.superseded;
    const progress = batch.total_count > 0
      ? Math.round((finishedCount / batch.total_count) * 100)
      : 0;
    const terminalStatus: AsyncTaskStatus = batch.counts.failed > 0 ? "error" : "success";
    const existing = tasks.find((task) => task.id === taskId);
    const status = batch.terminal && !options?.awaitCompletionClaim
      ? terminalStatus
      : "pending";
    tasks = [
      ...tasks.filter((task) => task.id !== taskId),
      {
        id: taskId,
        label: `OMR ${batch.total_count}장`,
        status,
        progress,
        error: status === "error" ? "일부 항목을 다시 확인해 주세요." : undefined,
        omrBatch: batch,
        createdAt: existing?.createdAt ?? (Date.parse(batch.created_at) || Date.now()),
        tenantScope: scope,
        meta: {
          jobId: batch.id,
          jobType: "omr_batch",
          sourceId: batch.exam_id,
        },
      },
    ];
    emit();
    return taskId;
  },

  /** 완료 처리 (성공/실패) */
  completeTask(id: string, status: "success" | "error", error?: string): void {
    tasks = tasks.map((t) =>
      t.id === id ? { ...t, status, progress: 100, statusMessage: undefined, error } : t
    );
    emit();
  },

  /** 진행률 갱신 (남은 시간·구간 정보 있으면 함께 저장) */
  updateProgress(
    id: string,
    progress: number,
    remainingSeconds?: number | null,
    encodingStep?: EncodingStep | null
  ): void {
    tasks = tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            progress: Math.min(100, Math.max(0, progress)),
            remainingSeconds: remainingSeconds ?? t.remainingSeconds,
            encodingStep: encodingStep ?? t.encodingStep,
          }
        : t
    );
    emit();
  },

  /** pending 작업의 제한적 복구 조회 상태를 표시한다. */
  setTaskStatusMessage(id: string, statusMessage?: string): void {
    tasks = tasks.map((t) => (t.id === id ? { ...t, statusMessage } : t));
    emit();
  },

  /** 라벨만 변경 */
  setTaskLabel(id: string, label: string): void {
    tasks = tasks.map((t) => (t.id === id ? { ...t, label } : t));
    emit();
  },

  setStudentImportResult(id: string, result: StudentImportResult): void {
    const bounded = parseStoredStudentImportResult(result);
    if (!bounded) return;
    tasks = tasks.map((task) =>
      task.id === id ? { ...task, studentImportResult: bounded } : task
    );
    emit();
  },

  acknowledgeStudentImportResult(id: string): void {
    tasks = tasks.map((task) =>
      task.id === id && task.studentImportResult
        ? {
            ...task,
            studentImportResult: { ...task.studentImportResult, acknowledged: true },
          }
        : task
    );
    emit();
  },

  reopenStudentImportResult(id: string): void {
    tasks = tasks.map((task) =>
      task.id === id && task.studentImportResult
        ? {
            ...task,
            studentImportResult: { ...task.studentImportResult, acknowledged: false },
          }
        : task
    );
    emit();
  },

  setStudentInitialPasswordDownload(
    id: string,
    credentials: Array<{ name: string; login_id: string; password: string }>,
  ): void {
    tasks = tasks.map((task) =>
      task.id === id
        ? {
            ...task,
            download: {
              kind: "student_initial_passwords" as const,
              credentials,
            },
            meta: task.meta
              ? {
                  ...task.meta,
                  credentialRecoveryExpiresAt: Date.now() + EXCEL_RECOVERY_TTL_MS,
                }
              : task.meta,
          }
        : task
    );
    emit();
  },

  /** 항목 제거 (사용자가 휴지통으로 삭제) */
  removeTask(id: string): void {
    tasks = tasks.filter((t) => t.id !== id);
    emit();
  },

  /** 로그아웃/계정 전환 시 평문 다운로드 데이터와 복구 메타데이터를 모두 제거 */
  clearAll(): void {
    sessionGeneration += 1;
    tasks = [];
    try {
      removeLocalItem(EXCEL_RECOVERY_STORAGE_KEY);
    } catch {
      // ignore
    }
    emit();
  },

  /** 업로드 태스크를 워커 작업으로 전환 (영상: 업로드 완료 후 폴링 대상으로 연결) */
  attachWorkerMeta(tempId: string, jobId: string, jobType: string): void {
    const idx = tasks.findIndex((t) => t.id === tempId);
    if (idx === -1) return;
    const t = tasks[idx];
    const next = {
      ...t,
      id: jobId,
      progress: undefined,
      remainingSeconds: undefined,
      encodingStep: undefined,
      statusMessage: undefined,
      meta: { jobId, jobType },
      tenantScope: t.tenantScope ?? this._getTenantScope(),
    };
    tasks = [...tasks.slice(0, idx), ...tasks.slice(idx + 1)].filter((x) => x.id !== jobId);
    tasks = [...tasks, next];
    emit();
  },

  /** 재처리: 해당 항목을 다시 pending으로 (API 재호출은 호출측에서 수행) */
  retryTask(id: string): void {
    tasks = tasks.map((t) =>
      t.id === id
        ? { ...t, status: "pending" as const, progress: 0, statusMessage: undefined, error: undefined }
        : t
    );
    emit();
  },

  /** 완료된 항목 일괄 제거 (휴지통) — 현재 테넌트 소속만 제거, 테넌트 격리 */
  clearCompleted(): void {
    const scope = this._getTenantScope();
    tasks = tasks.filter(
      (t) => t.status === "pending" || (t.tenantScope ?? "") !== scope
    );
    emit();
  },

  /** API 요청용: meta.asyncTrack === true 일 때만 등록 (기본은 미등록 — 워커 작업만 알람창에 표시) */
  trackRequest(method: string, url?: string, config?: { meta?: { asyncLabel?: string; asyncTrack?: boolean }; _asyncId?: string }): string | null {
    if (!config?.meta?.asyncTrack) return null;
    const id = config?._asyncId ?? generateId();
    const label = config?.meta?.asyncLabel ?? defaultLabel(method, url);
    this.addTask(label, id);
    return id;
  },
};
