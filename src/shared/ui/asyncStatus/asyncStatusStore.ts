// PATH: src/shared/ui/asyncStatus/asyncStatusStore.ts
// 전역 비동기 상태 SSOT — API/SSE/WS 진행률 추적, 구독 기반 갱신
//
// 장시간 작업(알림톡 발송, OMR 대량 생성 등)에서 진행률 반영 예시:
//   const taskId = asyncStatusStore.addTask('알림톡 발송 중');
//   // SSE/WebSocket 수신 시:
//   asyncStatusStore.updateProgress(taskId, percent);
//   // 완료 시:
//   asyncStatusStore.completeTask(taskId, 'success');

export type AsyncTaskStatus = "pending" | "success" | "error";

export interface AsyncTask {
  id: string;
  label: string;
  status: AsyncTaskStatus;
  /** 0..100, 진행 중일 때만 사용 (SSE/WS 연동) */
  progress?: number;
  error?: string;
  createdAt: number;
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

  /**
   * 새 작업 추가 (API 요청 시작 시 또는 장시간 작업 시작 시)
   * @param label 표시 라벨
   * @param id 지정 시 해당 id 사용 (SSE/WS 진행률 연동 시 동일 id로 updateProgress 호출)
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
      },
    ];
    emit();
    return taskId;
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

  /** 항목 제거 (사용자가 닫기) */
  removeTask(id: string): void {
    tasks = tasks.filter((t) => t.id !== id);
    emit();
  },

  /** 완료된 항목 일괄 제거 */
  clearCompleted(): void {
    tasks = tasks.filter((t) => t.status === "pending");
    emit();
  },

  /** API 요청용: config에서 id/라벨 읽어서 등록, config에 _asyncId 붙여서 반환 */
  trackRequest(method: string, url?: string, config?: { meta?: { asyncLabel?: string }; _asyncId?: string }): string | null {
    const id = config?._asyncId ?? generateId();
    const label = config?.meta?.asyncLabel ?? defaultLabel(method, url);
    this.addTask(label, id);
    return id;
  },
};
