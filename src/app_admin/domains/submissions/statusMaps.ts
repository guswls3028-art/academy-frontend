// PATH: src/app_admin/domains/submissions/statusMaps.ts
import type { SubmissionStatus } from "./types";

export { SUBMISSION_STATUS_LABEL, SUBMISSION_STATUS_TONE } from "@/shared/product/submissions/status";

export const SUBMISSION_STATUS_COLOR: Record<SubmissionStatus | "graded" | "pending" | "processing", string> = {
  submitted: "gray",
  dispatched: "blue",
  extracting: "indigo",
  needs_identification: "yellow",
  answers_ready: "yellow",
  grading: "yellow",
  done: "green",
  failed: "red",
  superseded: "gray",
  graded: "green",
  pending: "gray",
  processing: "blue",
};

export function formatSubmissionDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatSubmissionFileSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
