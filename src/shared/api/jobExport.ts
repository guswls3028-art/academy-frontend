// PATH: src/shared/api/jobExport.ts
// 엑셀 내보내기 등 비동기 job: 폴링 후 download_url 반환

import api from "@/shared/api/axios";

export type JobStatusResponse = {
  job_id: string;
  job_type?: string;
  status: string;
  result?: { download_url?: string; filename?: string };
  error_message?: string | null;
  progress?: unknown;
};

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 120; // 3분

/**
 * job_id 상태 폴링. DONE 시 result, FAILED 시 throw.
 */
export async function pollJobUntilDone(jobId: string): Promise<JobStatusResponse> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    const res = await api.get<JobStatusResponse>(`/jobs/${encodeURIComponent(jobId)}/`);
    const data = res.data;

    if (data.status === "DONE") {
      return data;
    }
    if (data.status === "FAILED") {
      const msg = data.error_message || "Export failed.";
      throw new Error(msg);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Export timed out. Try again later.");
}

/**
 * 완료 시 result.download_url 로 브라우저 다운로드 트리거
 */
export function downloadFromUrl(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
