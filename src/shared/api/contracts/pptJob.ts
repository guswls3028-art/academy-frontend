import { isFailedAIJobStatus } from "./aiJob";

export interface PptGenerateResponse {
  download_url: string;
  filename: string;
  slide_count: number;
  size_bytes: number;
  mode?: "question" | "page";
  readability_warning?: {
    narrow_slide_count: number;
    slide_numbers: number[];
  };
}

/** A terminal job without a downloadable result must never appear successful. */
export function completedPptResult(job: {
  status: string;
  error_message?: string | null;
  result?: Partial<PptGenerateResponse> | null;
}): PptGenerateResponse | null {
  const error = typeof job.error_message === "string" ? job.error_message.trim() : "";
  if (job.status === "UNKNOWN") {
    throw new Error("PPT 작업을 찾을 수 없습니다. 원본 파일로 다시 시도해 주세요.");
  }
  if (isFailedAIJobStatus(job.status) || job.status === "CANCELLED") {
    throw new Error(error || "PPT 생성에 실패했습니다.");
  }
  if (job.status !== "DONE") return null;
  if (error) throw new Error(error);
  const result = job.result;
  if (!result || typeof result.download_url !== "string" || !result.download_url.trim()
    || typeof result.filename !== "string" || !result.filename.trim()) {
    throw new Error("완료된 PPT 파일을 확인할 수 없습니다. 원본 파일로 다시 시도해 주세요.");
  }
  return result as PptGenerateResponse;
}
