// PATH: src/shared/ui/asyncStatus/useWorkerJobPoller.ts
// 워커 작업(엑셀·영상 등) 상태/진행률 폴링 — 우하단 프로그래스바 갱신 및 완료 처리
// 엑셀: GET /jobs/<id>/. 영상: GET /media/videos/<id>/.

import { useEffect, useRef } from "react";
import { asyncStatusStore } from "./asyncStatusStore";
import { getJobStatus } from "@/shared/api/jobStatus";
import api from "@/shared/api/axios";

const POLL_INTERVAL_MS = 1000;

function pollExcelJob(
  taskId: string,
  onSuccess?: () => void
) {
  getJobStatus(taskId)
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

function pollVideoJob(taskId: string, videoId: string, onSuccess?: () => void) {
  api
    .get<{ status: string }>(`/media/videos/${videoId}/`)
    .then((res) => {
      const status = res.data?.status;
      if (status === "PROCESSING" || status === "UPLOADED") {
        asyncStatusStore.updateProgress(taskId, status === "PROCESSING" ? 50 : 10);
      }
      if (status === "READY") {
        onSuccess?.();
        asyncStatusStore.completeTask(taskId, "success");
      } else if (status === "FAILED") {
        asyncStatusStore.completeTask(taskId, "error", "영상 처리 실패");
      }
    })
    .catch(() => {});
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
      const excelCb = onExcelSuccessRef.current;
      const videoCb = onVideoSuccessRef.current;
      current
        .filter((t) => t.status === "pending" && t.meta?.jobId)
        .forEach((t) => {
          if (t.meta!.jobType === "excel_parsing") {
            pollExcelJob(t.meta!.jobId, excelCb);
          } else if (t.meta!.jobType === "video_processing") {
            pollVideoJob(t.meta!.jobId, t.meta!.jobId, videoCb);
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
  }, [pending.length, pending.map((p) => p.id).join(",")]);
}
