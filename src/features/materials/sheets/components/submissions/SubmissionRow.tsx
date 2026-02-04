// PATH: src/features/materials/sheets/components/submissions/SubmissionRow.tsx

import type { ExamSubmissionRow } from "./submissions.api";

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
  const statusLabel =
    row.status === "pending"
      ? "대기"
      : row.status === "processing"
        ? "처리중"
        : row.status === "done"
          ? "완료"
          : "실패";

  const statusClass =
    row.status === "done"
      ? "text-green-700"
      : row.status === "failed"
        ? "text-red-700"
        : row.status === "pending"
          ? "text-gray-600"
          : "text-blue-700";

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
          <button type="button" className="btn" onClick={onManualEdit}>
            수동 수정
          </button>

          {row.status === "failed" && (
            <button type="button" className="btn" onClick={onRetry} disabled={!!retryLoading}>
              {retryLoading ? "재시도..." : "재시도"}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
