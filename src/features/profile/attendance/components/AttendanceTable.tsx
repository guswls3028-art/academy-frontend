// PATH: src/features/profile/attendance/components/AttendanceTable.tsx
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { Attendance } from "../../api/profile.api";
import { Panel } from "@/shared/ui/ds";

interface Props {
  rows: Attendance[];
  onEdit: (row: Attendance) => void;
  onDelete: (row: Attendance) => void;
}

/**
 * 컬럼 설계 원칙
 * - 날짜 / 유형 / 시급 / 금액 / 관리: 고정폭
 * - 근무시간: minmax로 "필요한 만큼만"
 */
const GRID =
  "grid grid-cols-[110px_90px_minmax(160px,220px)_90px_110px_72px] gap-3 items-start";

function fmtTime(t?: string) {
  return t ? t.slice(0, 5) : "-";
}

export default function AttendanceTable({
  rows,
  onEdit,
  onDelete,
}: Props) {
  if (!rows.length) return null;

  return (
    <Panel>
      {/* ===== Header ===== */}
      <div className="px-4 py-2 bg-[var(--bg-surface-soft)] text-xs text-[var(--text-muted)]">
        <div className={GRID}>
          <div>날짜</div>
          <div>유형</div>
          <div>근무시간</div>
          <div>시급</div>
          <div>금액</div>
          <div className="text-center">관리</div>
        </div>
      </div>

      {/* ===== Rows ===== */}
      {rows.map((r) => {
        const hourly =
          r.duration_hours > 0
            ? Math.round(r.amount / r.duration_hours)
            : 0;

        return (
          <div
            key={r.id}
            className="px-4 py-2 border-t border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)]"
          >
            <div className={GRID}>
              {/* 날짜 */}
              <div className="font-medium">{r.date}</div>

              {/* 유형 */}
              <div className="text-[var(--text-muted)]">
                {r.work_type}
              </div>

              {/* 근무시간 */}
              <div className="leading-tight">
                <div>
                  {fmtTime(r.start_time)} ~ {fmtTime(r.end_time)}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  총 {r.duration_hours}시간
                </div>
              </div>

              {/* 시급 */}
              <div className="text-[var(--text-muted)]">
                {hourly.toLocaleString()}원
              </div>

              {/* 금액 */}
              <div className="font-semibold">
                {r.amount.toLocaleString()}원
              </div>

              {/* 관리 */}
              <div className="flex justify-end gap-1">
                <button
                  className="p-2 rounded-md hover:bg-[var(--bg-surface-muted)]"
                  onClick={() => onEdit(r)}
                  title="수정"
                >
                  <FiEdit2 size={14} />
                </button>
                <button
                  className="p-2 rounded-md text-red-400 hover:bg-[var(--bg-surface-muted)]"
                  onClick={() => onDelete(r)}
                  title="삭제"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </Panel>
  );
}
