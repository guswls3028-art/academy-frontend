// PATH: src/shared/ui/asyncStatus/AsyncStatusBar.tsx
// 우하단 Windows 스타일 비동기 상태 바 — 워커 작업 프로그래스바만 표시

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAsyncStatus } from "./useAsyncStatus";
import { useWorkerJobPoller } from "./useWorkerJobPoller";
import { asyncStatusStore, type AsyncTask, type AsyncTaskStatus } from "./asyncStatusStore";
import "@/styles/design-system/components/AsyncStatusBar.css";

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

function TaskItem({ task }: { task: AsyncTask }) {
  return (
    <div className="async-status-bar__item">
      <div className="async-status-bar__item-row">
        <StatusIcon status={task.status} />
        <div className="async-status-bar__item-body">
          <div className="async-status-bar__item-label">{task.label}</div>
          {task.error && <div className="async-status-bar__item-error">{task.error}</div>}
        </div>
        <button
          type="button"
          className="async-status-bar__item-close"
          onClick={() => asyncStatusStore.removeTask(task.id)}
          aria-label="닫기"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {task.status === "pending" && (
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
      )}
    </div>
  );
}

export default function AsyncStatusBar() {
  const queryClient = useQueryClient();
  const tasks = useAsyncStatus();
  const [expanded, setExpanded] = useState(false);
  const workerTasks = tasks.filter((t) => t.meta?.jobId);
  useWorkerJobPoller(tasks, {
    onExcelSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lecture-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-matrix"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["lecture"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });

  if (workerTasks.length === 0) return null;

  const pendingCount = workerTasks.filter((t) => t.status === "pending").length;

  return (
    <div
      className={`async-status-bar ${expanded ? "async-status-bar--expanded" : "async-status-bar--collapsed"}`}
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
        <span className="async-status-bar__trigger-count">
          {pendingCount > 0 ? `진행 중 ${workerTasks.length}건` : `${workerTasks.length}건 완료`}
        </span>
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
            >
              지우기
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
          {workerTasks.length === 0 ? (
            <div className="async-status-bar__empty">진행 중인 작업이 없습니다.</div>
          ) : (
            workerTasks.map((task) => <TaskItem key={task.id} task={task} />)
          )}
        </div>
      </div>
    </div>
  );
}
