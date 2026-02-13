// PATH: src/features/materials/sheets/components/submissions/SubmissionRow.tsx

import { Button } from "@/shared/ui/ds";
import { SUBMISSION_STATUS_LABEL, SUBMISSION_STATUS_COLOR } from "@/features/submissions/statusMaps";
import type { ExamSubmissionRow } from "./submissions.api";

const STATUS_COLOR_CLASS: Record<string, string> = {
  gray: "text-gray-600",
  blue: "text-blue-700",
  indigo: "text-indigo-700",
  yellow: "text-yellow-700",
  green: "text-green-700",
  red: "text-red-700",
};

export default function SubmissionRow({
  row,
  onManualEdit,
  onRetry,
  retryLoading,
}: {
  row: ExamSubmissionRow;
  onManualEdit: () => void;
  onRetry: () => void;
  retryLoading?: boolean;
}) {
  const statusLabel = SUBMISSION_STATUS_LABEL[row.status as keyof typeof SUBMISSION_STATUS_LABEL] ?? row.status;
  const colorKey = SUBMISSION_STATUS_COLOR[row.status as keyof typeof SUBMISSION_STATUS_COLOR] ?? "gray";
  const statusClass = STATUS_COLOR_CLASS[colorKey] ?? "text-gray-600";

  const student = row.student_name?.trim()
    ? row.student_name.trim()
    : row.enrollment_id
      ? `#${row.enrollment_id}`
      : "-";

  return (
    <tr>
      <td>#{row.id}</td>
      <td>{student}</td>
      <td className={statusClass}>{statusLabel}</td>
      <td>{row.score == null ? "-" : row.score}</td>
      <td className="text-xs text-gray-600">{row.created_at}</td>
      <td className="text-right">
        <div className="flex justify-end gap-2">
          <Button type="button" intent="secondary" size="sm" onClick={onManualEdit}>
            수동 수정
          </Button>

          {(row.status === "failed" || row.status === "needs_identification") && (
            <Button type="button" intent="secondary" size="sm" onClick={onRetry} disabled={!!retryLoading}>
              {retryLoading ? "재시도..." : "재시도"}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
