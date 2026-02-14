import type { SubmissionStatus } from "@/features/submissions/types";
import { SUBMISSION_STATUS_LABEL, SUBMISSION_STATUS_TONE } from "@/features/submissions/statusMaps";

export default function SubmissionStatusBadge({
  status,
}: {
  status: SubmissionStatus | "graded" | null;
}) {
  if (!status) {
    return <span className="ds-status-badge" data-tone="neutral">-</span>;
  }
  const tone = (SUBMISSION_STATUS_TONE as any)[status] ?? "neutral";
  return (
    <span className="ds-status-badge" data-tone={tone}>
      {(SUBMISSION_STATUS_LABEL as any)[status] ?? status}
    </span>
  );
}
