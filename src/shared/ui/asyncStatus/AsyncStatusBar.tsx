// PATH: src/shared/ui/asyncStatus/AsyncStatusBar.tsx
// 우하단 Windows 스타일 비동기 상태 바 — 워커 작업 프로그래스바만 표시

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { feedback } from "@/shared/ui/feedback/feedback";
import { fetchInProgressVideos } from "@/features/videos/api/videos";
import { useAsyncStatus } from "./useAsyncStatus";
import { useWorkerJobPoller } from "./useWorkerJobPoller";
import { asyncStatusStore, type AsyncTask, type AsyncTaskStatus } from "./asyncStatusStore";
import "@/styles/design-system/components/AsyncStatusBar.css";
import "@/styles/design-system/ds/status.css";

/** 작업 유형 뱃지 3종: 메시지, 엑셀, 동영상 (전역 디자인) */
const JOB_TYPE_BADGE: Record<string, { label: string; tone: "primary" | "success" | "neutral" }> = {
  message: { label: "메시지", tone: "neutral" },
  messaging: { label: "메시지", tone: "neutral" },
  excel_parsing: { label: "엑셀", tone: "success" },
  video_processing: { label: "동영상", tone: "primary" },
};

function StatusIcon({ status }: { status: AsyncTaskStatus }) {
  if (status === "pending")
    return (
      <svg className="async-status-bar__item-icon async-status-bar__item-icon--pending" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
      </svg>
    );
  if (status === "success")
    return (
      <svg className="async-status-bar__item-icon async-status-bar__item-icon--success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 13l4 4L19 7" />
      </svg>
    );
  return (
    <svg className="async-status-bar__item-icon async-status-bar__item-icon--error" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function TrashIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18v2l-2 14H5L3 8V6zm4 2v12h10V8H7zm2 2h2v8H9v-8zm4 0h2v8h-2v-8zM8 4h8v2H8V4z" />
    </svg>
  );
}

function RetryIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

function TaskItem({ task }: { task: AsyncTask }) {
  const typeBadge = task.meta?.jobType ? JOB_TYPE_BADGE[task.meta.jobType] : null;
  const canRetry =
    task.meta?.jobType === "video_processing" &&
    task.meta?.jobId &&
    (task.status === "error" || task.status === "success");
  const [retrying, setRetrying] = useState(false);
  const progressNum = task.progress != null ? Math.round(task.progress) : null;

  const handleRetry = async () => {
    if (task.meta?.jobType !== "video_processing" || !task.meta?.jobId || retrying) return;
    setRetrying(true);
    try {
      await api.post(`/media/videos/${task.meta.jobId}/retry/`);
      asyncStatusStore.retryTask(task.id);
      feedback.success("재처리 요청을 보냈습니다.");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error)?.message ||
        "재처리에 실패했습니다.";
      feedback.error(msg);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="async-status-bar__item">
      <div className="async-status-bar__item-row">
        <StatusIcon status={task.status} />
        <div className="async-status-bar__item-body">
          <div className="async-status-bar__item-label">
            {task.label}
            {task.status === "pending" && task.progress == null && (
              <span className="async-status-bar__item-waiting"> · 대기 중</span>
            )}
          </div>
          {task.error && <div className="async-status-bar__item-error">{task.error}</div>}
        </div>
        <div className="async-status-bar__item-actions">
          {canRetry && (
            <button
              type="button"
              className="async-status-bar__item-btn async-status-bar__item-btn--retry"
              onClick={handleRetry}
              disabled={retrying}
              title="재처리"
              aria-label="재처리"
            >
              <RetryIcon size={14} />
            </button>
          )}
          <button
            type="button"
            className="async-status-bar__item-btn async-status-bar__item-btn--delete"
            onClick={() => asyncStatusStore.removeTask(task.id)}
            title="삭제"
            aria-label="삭제"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>
      {task.status === "pending" && (
        <div className="async-status-bar__progress-wrap">
          <div className="async-status-bar__progress">
            <div
              className={
                task.progress != null
                  ? "async-status-bar__progress-fill"
                  : "async-status-bar__progress-fill async-status-bar__progress-fill--indeterminate"
              }
              style={
                task.progress != null
                  ? { width: `${task.progress}%` }
                  : undefined
              }
            />
          </div>
          {task.progress != null && (
            <span className="async-status-bar__progress-pct" aria-hidden>
              {Math.round(task.progress)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function AsyncStatusBar() {
  const queryClient = useQueryClient();
  const tasks = useAsyncStatus();
  const [expanded, setExpanded] = useState(false);
  const prevPendingCountRef = useRef(0);
  const hydratedRef = useRef(false);

  const displayTasks = tasks;
  const pendingCount = displayTasks.filter((t) => t.status === "pending").length;

  // 새로고침 후에도 진행 중인 영상 인코딩을 작업 박스에 복원
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    fetchInProgressVideos()
      .then((videos) => {
        const existing = new Set(
          asyncStatusStore.getState().filter((t) => t.meta?.jobType === "video_processing").map((t) => t.id)
        );
        videos.forEach((v) => {
          const id = String(v.id);
          if (existing.has(id)) return;
          asyncStatusStore.addWorkerJob(v.title || `영상 ${id}`, id, "video_processing");
        });
      })
      .catch(() => {});
  }, []);

  // 새 작업이 추가되면 작업 박스 자동 펼치기 — 사용자가 백그라운드 진행을 바로 확인할 수 있게
  useEffect(() => {
    if (pendingCount > prevPendingCountRef.current && pendingCount > 0) {
      setExpanded(true);
    }
    prevPendingCountRef.current = pendingCount;
  }, [pendingCount]);

  const workerTasks = tasks.filter((t) => t.meta?.jobId);
  useWorkerJobPoller(tasks, {
    onExcelSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lecture-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-matrix"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["lecture"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onVideoSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-videos"] });
    },
  });

  const errorCount = displayTasks.filter((t) => t.status === "error").length;

  const triggerLabel =
    displayTasks.length === 0
      ? "작업"
      : pendingCount > 0
        ? `진행 중 ${displayTasks.length}건`
        : errorCount > 0
          ? `실패 ${errorCount}건`
          : `${displayTasks.length}건 완료`;

  // 항상 우하단에 작업 박스 표시 (작업 없을 때도 접힌 상태로 유지)
  return (
    <div
      className={`async-status-bar ${expanded ? "async-status-bar--expanded" : "async-status-bar--collapsed"} ${errorCount > 0 ? "async-status-bar--has-error" : ""}`}
      role="region"
      aria-label="비동기 작업 상태"
    >
      {/* 접었을 때: Windows 알림처럼 작은 창 */}
      <button
        type="button"
        className="async-status-bar__trigger"
        onClick={() => setExpanded(true)}
        aria-expanded={expanded}
      >
        <svg className="async-status-bar__trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
        </svg>
        <span className="async-status-bar__trigger-count">{triggerLabel}</span>
      </button>

      {/* 펼쳤을 때: 목록 패널 */}
      <div className="async-status-bar__panel">
        <div className="async-status-bar__header">
          <span>작업</span>
          <div className="async-status-bar__header-actions">
            <button
              type="button"
              className="async-status-bar__header-btn"
              onClick={() => asyncStatusStore.clearCompleted()}
              title="완료된 항목 지우기"
              aria-label="완료된 항목 지우기"
            >
              <TrashIcon size={18} />
            </button>
            <button
              type="button"
              className="async-status-bar__header-btn"
              onClick={() => setExpanded(false)}
              title="접기"
              aria-label="접기"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>
          </div>
        </div>
        <div className="async-status-bar__list">
          {displayTasks.length === 0 ? (
            <div className="async-status-bar__empty">진행 중인 작업이 없습니다.</div>
          ) : (
            displayTasks.map((task) => <TaskItem key={task.id} task={task} />)
          )}
        </div>
      </div>
    </div>
  );
}
