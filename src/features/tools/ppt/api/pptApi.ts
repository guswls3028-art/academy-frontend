// PATH: src/features/tools/ppt/api/pptApi.ts
// PPT 생성 API — async worker pattern (job dispatch + polling)

import api from "@/shared/api/axios";

export interface PptSettings {
  aspect_ratio: "16:9" | "4:3";
  background: string;
  fit_mode: "contain" | "cover" | "stretch";
  invert: boolean;
  grayscale: boolean;
  auto_enhance: boolean;
  brightness: number;
  contrast: number;
  per_slide?: Array<{
    invert?: boolean;
    grayscale?: boolean;
    auto_enhance?: boolean;
    brightness?: number;
    contrast?: number;
  }>;
}

export interface PptJobResponse {
  job_id: string;
  status: string;
  slide_count?: number;
}

export interface PptGenerateResponse {
  download_url: string;
  filename: string;
  slide_count: number;
  size_bytes: number;
}

export interface JobProgressResponse {
  job_id: string;
  job_type: string;
  status: string;
  progress?: {
    step?: string;
    percent?: number;
    step_index?: number | null;
    step_total?: number | null;
    step_name?: string | null;
    step_name_display?: string | null;
    step_percent?: number | null;
  } | null;
  result?: PptGenerateResponse;
  error_message?: string | null;
}

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 180; // 6 minutes max

/**
 * Submit PPT generation job (images mode).
 * Returns job_id for polling.
 */
export async function submitPptJob(
  images: File[],
  order: number[],
  settings: PptSettings,
  onUploadProgress?: (pct: number) => void,
): Promise<PptJobResponse> {
  const form = new FormData();

  for (const file of images) {
    form.append("images", file);
  }

  form.append("order", JSON.stringify(order));
  form.append("settings", JSON.stringify(settings));

  const resp = await api.post<PptJobResponse>("/tools/ppt/generate/", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120_000,
    onUploadProgress: onUploadProgress
      ? (e) => {
          if (e.total) onUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      : undefined,
  });

  return resp.data;
}

/**
 * Submit PPT generation job (PDF mode).
 */
export async function submitPdfPptJob(
  pdfFile: File,
  settings: PptSettings,
  onUploadProgress?: (pct: number) => void,
): Promise<PptJobResponse> {
  const form = new FormData();
  form.append("pdf", pdfFile);
  form.append("settings", JSON.stringify(settings));

  const resp = await api.post<PptJobResponse>("/tools/ppt/generate/", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120_000,
    onUploadProgress: onUploadProgress
      ? (e) => {
          if (e.total) onUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      : undefined,
  });

  return resp.data;
}

/**
 * Poll job progress until DONE or FAILED.
 */
export async function pollPptJob(
  jobId: string,
  onProgress?: (progress: JobProgressResponse["progress"]) => void,
): Promise<PptGenerateResponse> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    const res = await api.get<JobProgressResponse>(
      `/jobs/${encodeURIComponent(jobId)}/progress/`,
    );
    const data = res.data;

    if (data.status === "DONE" && data.result) {
      return data.result;
    }
    if (data.status === "FAILED") {
      throw new Error(data.error_message || "PPT 생성에 실패했습니다.");
    }
    if (data.status === "RUNNING" && data.progress && onProgress) {
      onProgress(data.progress);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error("PPT 생성 시간이 초과되었습니다. 다시 시도해주세요.");
}

/**
 * Full flow: submit job → poll until done → return result.
 * Compatible with the old generatePpt() signature for easy migration.
 */
export async function generatePpt(
  images: File[],
  order: number[],
  settings: PptSettings,
  onProgress?: (pct: number) => void,
): Promise<PptGenerateResponse> {
  // Phase 1: Upload files and submit job
  const jobResp = await submitPptJob(images, order, settings, (pct) => {
    // Upload progress: 0-50% of total
    onProgress?.(Math.round(pct * 0.5));
  });

  // Phase 2: Poll for completion
  const result = await pollPptJob(jobResp.job_id, (progress) => {
    if (progress?.percent != null) {
      // Worker progress: 50-100% of total
      onProgress?.(50 + Math.round((progress.percent / 100) * 50));
    }
  });

  return result;
}
