// src/features/profile/components/AttendanceTable.tsx
import { Attendance } from "../api/profile";

function fmtTime(t: string) {
  // "HH:MM:SS" -> "HH:MM"
  return t?.slice(0, 5) || "-";
}

export default function AttendanceTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows?: Attendance[];
  onEdit: (row: Attendance) => void;
  onDelete: (row: Attendance) => void;
}) {
  if (!rows?.length) {
    return (
      <div className="py-12 text-center text-sm text-[var(--text-muted)]">
        근태 기록이 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-[var(--border-divider)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-surface-soft)] text-[var(--text-secondary)]">
          <tr>
            <th className="px-3 py-2 text-left">날짜</th>
            <th className="px-3 py-2 text-left">근무</th>
            <th className="px-3 py-2 text-left">시간</th>
            <th className="px-3 py-2 text-right">금액</th>
            <th className="px-3 py-2 text-right">관리</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-t border-[var(--border-divider)] hover:bg-[var(--bg-surface)]"
            >
              <td className="px-3 py-2">{r.date}</td>
              <td className="px-3 py-2">{r.work_type}</td>
              <td className="px-3 py-2">
                {fmtTime(r.start_time)} ~ {fmtTime(r.end_time)}{" "}
                <span className="text-[var(--text-muted)]">({r.duration_hours}h)</span>
              </td>
              <td className="px-3 py-2 text-right">{r.amount.toLocaleString()}원</td>
              <td className="px-3 py-2 text-right">
                <div className="inline-flex gap-2">
                  <button
                    className="rounded border border-[var(--border-divider)] px-2 py-0.5 text-xs hover:bg-[var(--bg-surface)]"
                    onClick={() => onEdit(r)}
                  >
                    수정
                  </button>
                  <button
                    className="rounded border border-[var(--border-divider)] px-2 py-0.5 text-xs text-red-400 hover:bg-[var(--bg-surface)]"
                    onClick={() => onDelete(r)}
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
