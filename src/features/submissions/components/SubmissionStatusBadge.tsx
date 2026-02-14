// ====================================================================================================
// FILE: src/features/submissions/components/SubmissionStatusBadge.tsx
// ====================================================================================================
import type { SubmissionStatus } from "@/features/submissions/types";
import { SUBMISSION_STATUS_COLOR, SUBMISSION_STATUS_LABEL } from "@/features/submissions/statusMaps";

const COLOR_CLASS: Record<string, string> = {
  gray: "bg-neutral-800 text-neutral-200 border-neutral-700",
  blue: "bg-blue-950 text-blue-200 border-blue-800",
  indigo: "bg-indigo-950 text-indigo-200 border-indigo-800",
  yellow: "bg-yellow-950 text-yellow-200 border-yellow-800",
  green: "bg-emerald-950 text-emerald-200 border-emerald-800",
  red: "bg-red-950 text-red-200 border-red-800",
};

export default function SubmissionStatusBadge({
  status,
}: {
  status: SubmissionStatus | "graded" | null;
}) {
  if (!status) {
    return <span className="ds-status-badge" data-tone="neutral">-</span>;
  }
  const key = (SUBMISSION_STATUS_COLOR as any)[status] ?? "gray";
  const cls = COLOR_CLASS[key] ?? COLOR_CLASS.gray;
  return (
    <span className={`ds-status-badge ${cls}`}>
      {(SUBMISSION_STATUS_LABEL as any)[status] ?? status}
    </span>
  );
}
