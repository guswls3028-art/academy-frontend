import type { ProblemReviewReport } from "../api/problemReview.api";

export function problemReviewFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function problemReviewReportLabel(report: ProblemReviewReport): string {
  return report.title || report.source_name || "제목 없는 문제 리뷰";
}
