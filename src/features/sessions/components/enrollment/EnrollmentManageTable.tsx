// PATH: src/features/sessions/components/enrollment/EnrollmentManageTable.tsx

import type { EnrollmentRow } from "./types";

export default function EnrollmentManageTable({
  rows,
  loading,
  error,
  selectedIds,
  onToggle,
  readOnly,
}: {
  rows: EnrollmentRow[];
  loading?: boolean;
  error?: string | null;
  selectedIds: Set<number>;
  onToggle?: (id: number) => void;
  readOnly: boolean;
}) {
  return (
    <div className="max-h-[340px] overflow-auto rounded border border-[var(--border-divider)]">
      {loading ? (
        <div className="p-6 text-sm text-[var(--text-muted)]">
          불러오는 중...
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm text-[var(--text-muted)]">
          표시할 학생이 없습니다.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)]">
            <tr>
              <th className="w-12 px-3 py-2 text-left">선택</th>
              <th className="px-3 py-2 text-left">학생</th>
              <th className="px-3 py-2 text-left">enrollment_id</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const checked = selectedIds.has(r.enrollment_id);
              return (
                <tr
                  key={r.enrollment_id}
                  className="border-t border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)]"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={readOnly}
                      onChange={() => onToggle?.(r.enrollment_id)}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                    {r.student_name || "(이름 없음)"}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">
                    {r.enrollment_id}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
