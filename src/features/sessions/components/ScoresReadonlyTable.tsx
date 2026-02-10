// PATH: src/features/sessions/components/ScoresReadonlyTable.tsx
import type { SessionScoreRow } from "../api/sessionScores";

type Props = {
  rows: SessionScoreRow[];
  selectedEnrollmentId: number | null;
  onSelectRow: (row: SessionScoreRow) => void;
};

export default function ScoresReadonlyTable({
  rows,
  selectedEnrollmentId,
  onSelectRow,
}: Props) {
  return (
    <div
      style={{
        overflow: "hidden",
        borderRadius: 14,
        border: "1px solid var(--color-border-divider)",
      }}
    >
      <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            {["학생", "점수", "비고"].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-xs font-extrabold"
                style={{
                  textAlign: "left",
                  background: "var(--color-bg-surface-hover)",
                  color: "var(--color-text-secondary)",
                  borderBottom: "1px solid var(--color-border-divider)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-[var(--color-border-divider)]">
          {rows.map((row) => {
            const selected =
              selectedEnrollmentId === row.enrollment_id;

            return (
              <tr
                key={row.enrollment_id}
                onClick={() => onSelectRow(row)}
                className="cursor-pointer"
                style={{
                  background: selected
                    ? "var(--state-selected-bg)"
                    : undefined,
                }}
              >
                <td className="px-4 py-3 font-medium">
                  {row.student_name}
                </td>
                <td className="px-4 py-3">
                  {row.final_score ?? "-"}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                  결과 상세에서 확인
                </td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td
                colSpan={3}
                className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]"
              >
                성적 데이터가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
