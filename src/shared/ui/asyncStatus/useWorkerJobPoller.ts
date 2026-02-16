// PATH: src/shared/ui/asyncStatus/useWorkerJobPoller.ts
// 워커 작업(엑셀 등) 상태/진행률 폴링 — 우하단 프로그래스바 갱신 및 완료 처리

import { useEffect, useRef } from "react";
import { asyncStatusStore } from "./asyncStatusStore";
import { getExcelEnrollJobStatus } from "@/features/lectures/api/enrollments";

const POLL_INTERVAL_MS = 2000;

function pollExcelJob(
  taskId: string,
  onSuccess?: () => void
) {
  getExcelEnrollJobStatus(taskId)
    .then((res) => {
      const percent = res.progress?.percent;
      if (typeof percent === "number") {
        asyncStatusStore.updateProgress(taskId, percent);
      }
      if (res.status === "DONE") {
        onSuccess?.();
        asyncStatusStore.completeTask(taskId, "success");
      } else if (res.status === "FAILED") {
        asyncStatusStore.completeTask(
          taskId,
          "error",
          res.error_message || "처리 실패"
        );
      }
    })
    .catch(() => {
      // 네트워크 오류 시 재시도는 다음 폴링에서
    });
}

export function useWorkerJobPoller(
  tasks: { id: string; status: string; meta?: { jobId: string; jobType: string } }[],
  options?: { onExcelSuccess?: () => void }
) {
  const pending = tasks.filter(
    (t) => t.status === "pending" && t.meta?.jobId
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExcelSuccess = options?.onExcelSuccess;

  useEffect(() => {
    if (pending.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    const tick = () => {
      const current = asyncStatusStore.getState();
      current
        .filter((t) => t.status === "pending" && t.meta?.jobId)
        .forEach((t) => {
          if (t.meta!.jobType === "excel_parsing") {
            pollExcelJob(t.meta!.jobId, onExcelSuccess);
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
  }, [pending.length, pending.map((p) => p.id).join(","), onExcelSuccess]);
}
