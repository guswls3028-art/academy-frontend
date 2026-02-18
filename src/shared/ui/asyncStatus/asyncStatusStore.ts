// PATH: src/shared/ui/asyncStatus/asyncStatusStore.ts
// 전역 비동기 상태 SSOT — 워커 작업 프로그래스바만 우하단에 표시
//
// 워커 작업(엑셀 수강등록, 비디오 인코딩 등): 업로드 후 모달 닫고 우하단에서 진행률 표시
//   const taskId = asyncStatusStore.addWorkerJob('엑셀 수강등록', jobId, 'excel_parsing');
//   // 전역 폴링이 progress/status 갱신 후 completeTask 호출
// 작업 목록은 태넌트(도메인)별로 격리 — 현재 테넌트 작업만 표시

import { getTenantCodeForApiRequest } from "@/shared/tenant";

export type AsyncTaskStatus = "pending" | "success" | "error";

export interface AsyncTaskMeta {
  jobId: string;
  jobType: string;
}

export interface AsyncTask {
  id: string;
  label: string;
  status: AsyncTaskStatus;
  /** 0..100, 진행 중일 때만 사용 (워커 Redis progress) */
  progress?: number;
  /** 예상 남은 시간(초). API에서 오면 이걸 우선 표시 */
  remainingSeconds?: number | null;
  error?: string;
  createdAt: number;
  /** 있으면 워커 작업 — 우하단 작업 알람창에만 표시, 폴링 대상 */
  meta?: AsyncTaskMeta;
  /** 태넌트(도메인)별 격리 — 이 키와 일치하는 테넌트에서만 작업 표시 */
  tenantScope?: string;
}

type Listener = (tasks: AsyncTask[]) => void;

let tasks: AsyncTask[] = [];
const listeners = new Set<Listener>();

function emit() {
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
    tasks = [
      ...tasks.filter((t) => t.id !== taskId),
      {
        id: taskId,
        label,
        status: "pending" as const,
        createdAt: Date.now(),
        tenantScope: this._getTenantScope(),
      },
    ];
    emit();
    return taskId;
  },

  /**
   * 워커 작업 추가 — 우하단 작업 알람창에 실시간 프로그래스바로 표시됨.
   * jobId를 id로 사용하여 폴링 시 status/progress 갱신.
   */
  addWorkerJob(label: string, jobId: string, jobType: string): string {
    tasks = [
      ...tasks.filter((t) => t.id !== jobId),
      {
        id: jobId,
        label,
        status: "pending" as const,
        createdAt: Date.now(),
        meta: { jobId, jobType },
        tenantScope: this._getTenantScope(),
      },
    ];
    emit();
    return jobId;
  },

  /** 완료 처리 (성공/실패) */
  completeTask(id: string, status: "success" | "error", error?: string): void {
    tasks = tasks.map((t) =>
      t.id === id ? { ...t, status, progress: 100, error } : t
    );
    emit();
  },

  /** 진행률 갱신 (SSE/WebSocket 등에서 호출) */
  updateProgress(id: string, progress: number): void {
    tasks = tasks.map((t) =>
      t.id === id ? { ...t, progress: Math.min(100, Math.max(0, progress)) } : t
    );
    emit();
  },

  /** 라벨만 변경 */
  setTaskLabel(id: string, label: string): void {
    tasks = tasks.map((t) => (t.id === id ? { ...t, label } : t));
    emit();
  },

  /** 항목 제거 (사용자가 휴지통으로 삭제) */
  removeTask(id: string): void {
    tasks = tasks.filter((t) => t.id !== id);
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
      progress: t.progress ?? 0,
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
      t.id === id ? { ...t, status: "pending" as const, progress: 0, error: undefined } : t
    );
    emit();
  },

  /** 완료된 항목 일괄 제거 (휴지통) */
  clearCompleted(): void {
    tasks = tasks.filter((t) => t.status === "pending");
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
