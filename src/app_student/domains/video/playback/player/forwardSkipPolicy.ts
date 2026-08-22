import type { VideoForwardSkipBudget } from "../../api/video.api";

export type ForwardSkipBudgetState = Omit<
  VideoForwardSkipBudget,
  "granted_seconds" | "ratio_percent" | "max_seconds"
>;

export function forwardSkipErrorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "건너뛰기를 승인하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
