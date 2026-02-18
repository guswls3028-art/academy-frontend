// PATH: src/shared/api/jobStatus.ts
// AI 워커 job 상태 조회 (엑셀 파싱 등) — 단일 진실. GET /api/v1/jobs/<job_id>/

import api from "@/shared/api/axios";

export type JobStatusResponse = {
  job_id: string;
  job_type: string;
  status: string;
  result?: Record<string, unknown>;
  error_message?: string | null;
  progress?: {
    step?: string;
    percent?: number;
    step_index?: number | null;
    step_total?: number | null;
    step_name?: string | null;
    step_name_display?: string | null;
    step_percent?: number | null;
  } | null;
};

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const res = await api.get(
    `/jobs/${encodeURIComponent(jobId)}/`
  );
  return res.data as JobStatusResponse;
}
