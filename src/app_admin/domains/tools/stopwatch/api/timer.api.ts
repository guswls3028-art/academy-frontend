// PATH: src/app_admin/domains/tools/stopwatch/api/timer.api.ts
// 타이머 exe 다운로드 API

import api from "@/shared/api/axios";

interface TimerDownloadResponse {
  download_url: string;
  filename: string;
}

/**
 * 현재 테넌트의 타이머 exe presigned download URL 요청.
 * 404 → 해당 테넌트 exe 미준비.
 */
export async function fetchTimerDownloadUrl(): Promise<TimerDownloadResponse> {
  const { data } = await api.get<TimerDownloadResponse>("/tools/timer/download/");
  return data;
}
