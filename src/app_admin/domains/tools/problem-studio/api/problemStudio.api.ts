import api from "@/shared/api/axios";

export type ProblemStudioSourceFile = {
  name: string;
  kind: string;
  sizeLabel: string;
  extractedChars: number;
  warning?: string | null;
};

export type ProblemStudioGeneratedQuestion = {
  prompt: string;
  choices: string[];
  answer: string;
  explanation: string;
  source_index?: number;
  variant_index?: number;
};

export type ProblemStudioGenerateResponse = {
  generation_engine: "ai" | "rule_fallback" | "source_transfer" | string;
  mode: ProblemStudioVariantMode | string;
  mode_label: string;
  variant_count: number;
  questions: ProblemStudioGeneratedQuestion[];
  source_files: ProblemStudioSourceFile[];
  warnings: string[];
  source_text_chars: number;
};

export type ProblemStudioJobCreateResponse = {
  job_id: string;
  status: string;
  source_files: ProblemStudioSourceFile[];
  warnings: string[];
  source_text_chars: number;
};

export type ProblemStudioTransferJobCreateResponse = ProblemStudioJobCreateResponse;

export type ProblemStudioJobStatusResponse = {
  job_id: string;
  status: string;
  error: string;
  result: ProblemStudioGenerateResponse | null;
};

export type ProblemStudioTransferJobResult = {
  download_url: string;
  filename: string;
  r2_key?: string;
  size_bytes: number;
  document_count: number;
  warning_count: number;
  review_file_count: number;
  structured_item_count: number;
  ocr_candidate_count: number;
  quality_level: string;
  structure_limit_reached?: boolean;
  sha256?: string;
  transcription_engine?: string;
  ai_transcribed_units?: number;
  fallback_ocr_units?: number;
};

export type ProblemStudioTransferJobStatusResponse = {
  job_id: string;
  job_type?: string;
  status: string;
  progress?: {
    percent?: number;
    step_index?: number;
    step_total?: number;
    step_name?: string;
    step_name_display?: string;
    step_percent?: number;
  } | null;
  result?: ProblemStudioTransferJobResult | null;
  error_message?: string | null;
  message?: string;
};

export type ProblemStudioHangulCompanionDownload = {
  download_url: string;
  filename: string;
  version: string;
  sha256: string;
  size_bytes: number;
};

export type ProblemStudioVariantMode = "copy" | "same-type" | "trap" | "concept";

export type ProblemStudioGeneratePayload = {
  title: string;
  class_name: string;
  subject: string;
  template_name: string;
  variant_mode: ProblemStudioVariantMode;
  variant_count: number;
  note_policy: string;
  use_ai: boolean;
  transfer_only?: boolean;
  ai_transcription?: boolean;
  questions: Array<{
    prompt: string;
    choices: string;
    answer: string;
    explanation: string;
  }>;
};

export async function createProblemStudioJob(
  payload: ProblemStudioGeneratePayload,
  sourceFiles: File[],
): Promise<ProblemStudioJobCreateResponse> {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  sourceFiles.forEach((file) => form.append("source_files", file));

  const { data } = await api.post<ProblemStudioJobCreateResponse>(
    "/tools/problem-studio/jobs/",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    },
  );
  return data;
}

export async function createProblemStudioTransferJob(
  payload: ProblemStudioGeneratePayload,
  sourceFiles: File[],
): Promise<ProblemStudioTransferJobCreateResponse> {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  sourceFiles.forEach((file) => form.append("source_files", file));

  const { data } = await api.post<ProblemStudioTransferJobCreateResponse>(
    "/tools/problem-studio/transfer-jobs/",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    },
  );
  return data;
}

function filenameFromDisposition(disposition: string | undefined): string | null {
  if (!disposition) return null;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return utf8Match[1].trim().replace(/^"|"$/g, "");
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(disposition);
  return plainMatch?.[1]?.trim() || null;
}

export async function downloadProblemStudioTransferPackage(
  payload: ProblemStudioGeneratePayload,
  sourceFiles: File[],
): Promise<{
  blob: Blob;
  filename: string;
  documentCount: number;
  warningCount: number;
  reviewFileCount: number;
  structuredItemCount: number;
  ocrCandidateCount: number;
  qualityLevel: string;
}> {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  sourceFiles.forEach((file) => form.append("source_files", file));

  const res = await api.post<Blob>(
    "/tools/problem-studio/transfer-document/",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      responseType: "blob",
      timeout: 900_000,
    },
  );
  const filename = filenameFromDisposition(res.headers["content-disposition"])
    || `${payload.title || "문제제작"}_원본이관.zip`;
  return {
    blob: res.data,
    filename,
    documentCount: Number(res.headers["x-problem-studio-document-count"] || 0),
    warningCount: Number(res.headers["x-problem-studio-warning-count"] || 0),
    reviewFileCount: Number(res.headers["x-problem-studio-review-file-count"] || 0),
    structuredItemCount: Number(res.headers["x-problem-studio-structured-item-count"] || 0),
    ocrCandidateCount: Number(res.headers["x-problem-studio-ocr-candidate-count"] || 0),
    qualityLevel: String(res.headers["x-problem-studio-quality-level"] || ""),
  };
}

export async function getProblemStudioJob(jobId: string): Promise<ProblemStudioJobStatusResponse> {
  const { data } = await api.get<ProblemStudioJobStatusResponse>(
    `/tools/problem-studio/jobs/${encodeURIComponent(jobId)}/`,
  );
  return data;
}

export async function getProblemStudioTransferJob(
  jobId: string,
): Promise<ProblemStudioTransferJobStatusResponse> {
  const { data } = await api.get<ProblemStudioTransferJobStatusResponse>(
    `/tools/problem-studio/transfer-jobs/${encodeURIComponent(jobId)}/`,
  );
  return data;
}

export async function createProblemStudioHangulHandoff(
  jobId: string,
): Promise<{ protocol_url: string; expires_in: number }> {
  const { data } = await api.post<{ protocol_url: string; expires_in: number }>(
    `/tools/problem-studio/transfer-jobs/${encodeURIComponent(jobId)}/hangul-handoff/`,
  );
  return data;
}

export async function getProblemStudioHangulCompanionDownload(): Promise<ProblemStudioHangulCompanionDownload> {
  const { data } = await api.get<ProblemStudioHangulCompanionDownload>(
    "/tools/problem-studio/hangul-companion/",
  );
  return data;
}
