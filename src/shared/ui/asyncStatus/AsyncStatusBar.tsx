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

function IconVideo({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function IconExcel({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h2M8 17h2M16 13h2M16 17h2" />
    </svg>
  );
}

function IconOmr({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function IconMessage({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/** 작업 유형 → 아이콘 컴포넌트 (동영상, 엑셀, OMR, 메시지) */
const JOB_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  message: IconMessage,
  messaging: IconMessage,
  excel_parsing: IconExcel,
  video_processing: IconVideo,
  omr: IconOmr,
  omr_scan: IconOmr,
};

/** 상태 뱃지: 완료/실패만 표시 (진행 중은 뱃지 없음) */
const STATUS_BADGE: Record<AsyncTaskStatus, string> = {
  pending: "",
  success: "완료",
  error: "실패",
};

/** 남은 예상시간 계산 (진행률 기반 선형 추정). NaN 방지. */
function getRemainingLabel(task: AsyncTask, nowMs: number): string | null {
  if (task.status !== "pending" || task.progress == null || task.progress <= 0 || task.progress >= 100) return null;
  const created = Number(task.createdAt);
  if (!Number.isFinite(created) || !Number.isFinite(nowMs)) return null;
  const elapsedSec = (nowMs - created) / 1000;
  if (elapsedSec <= 0) return null;
  const p = Number(task.progress);
  if (!Number.isFinite(p)) return null;
  const remainingSec = elapsedSec * (100 - p) / p;
  if (!Number.isFinite(remainingSec) || remainingSec < 0) return null;
  if (remainingSec < 60) return `약 ${Math.max(1, Math.round(remainingSec))}초 남음`;
  return `약 ${Math.round(remainingSec / 60)}분 남음`;
}

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

function TaskItem({ task, now }: { task: AsyncTask; now: number }) {
  const TypeIcon = task.meta?.jobType ? JOB_TYPE_ICONS[task.meta.jobType] : null;
  const remainingLabel = getRemainingLabel(task, now);
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
          <div className="async-status-bar__item-top">
            {STATUS_BADGE[task.status] && (
              <span
                className="async-status-bar__status-badge ds-status-badge"
                data-tone={task.status === "success" ? "success" : "danger"}
                aria-hidden
              >
                {STATUS_BADGE[task.status]}
              </span>
            )}
            {TypeIcon && (
              <span className="async-status-bar__type-icon" aria-hidden>
                <TypeIcon className="async-status-bar__type-icon-svg" size={18} />
              </span>
            )}
            <span className="async-status-bar__item-label-text">{task.label}</span>
            {remainingLabel != null && (
              <span className="async-status-bar__item-remaining">{remainingLabel}</span>
            )}
            {task.status === "pending" && progressNum == null && (
              <span className="async-status-bar__item-waiting">대기 중</span>
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

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (pendingCount === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pendingCount]);

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
            displayTasks.map((task) => <TaskItem key={task.id} task={task} now={now} />)
          )}
        </div>
      </div>
    </div>
  );
}
