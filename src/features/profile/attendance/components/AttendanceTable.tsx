// PATH: src/features/profile/attendance/components/AttendanceTable.tsx
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { Attendance } from "../../api/profile.api";
import { Button } from "@/shared/ui/ds";
import { DomainTable } from "@/shared/ui/domain";

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
    <DomainTable tableClassName="ds-table--flat">
      <thead>
        <tr
          style={{
            background: "color-mix(in srgb, var(--color-primary) 4%, transparent)",
          }}
        >
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "left",
            }}
          >
            날짜
          </th>
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "left",
            }}
          >
            유형
          </th>
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "left",
            }}
          >
            근무시간
          </th>
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "right",
            }}
          >
            시급
          </th>
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "right",
            }}
          >
            금액
          </th>
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "center",
            }}
          >
            관리
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const hourly =
            r.duration_hours > 0
              ? Math.round(r.amount / r.duration_hours)
              : 0;

          return (
            <tr
              key={r.id}
              className="transition-colors"
              style={{
                borderTop: "1px solid color-mix(in srgb, var(--color-border-divider) 35%, transparent)",
              }}
            >
              {/* 날짜 */}
              <td
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                {r.date}
              </td>

              {/* 유형 */}
              <td
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {r.work_type}
              </td>

              {/* 근무시간 */}
              <td
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-primary)",
                }}
              >
                <div>{fmtTime(r.start_time)} ~ {fmtTime(r.end_time)}</div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-muted)",
                    marginTop: 2,
                  }}
                >
                  총 {r.duration_hours}시간
                </div>
              </td>

              {/* 시급 */}
              <td
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-secondary)",
                  textAlign: "right",
                }}
              >
                {hourly.toLocaleString()}원
              </td>

              {/* 금액 */}
              <td
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--font-title)",
                  color: "var(--color-text-primary)",
                  textAlign: "right",
                }}
              >
                {r.amount.toLocaleString()}원
              </td>

              {/* 관리 */}
              <td
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  textAlign: "center",
                }}
              >
                <div className="flex justify-center gap-1">
                  <Button
                    type="button"
                    intent="ghost"
                    size="sm"
                    onClick={() => onEdit(r)}
                    title="수정"
                    className="!min-w-0 !w-8 !h-8 !p-0"
                  >
                    <FiEdit2 size={14} />
                  </Button>
                  <Button
                    type="button"
                    intent="danger"
                    size="sm"
                    onClick={() => onDelete(r)}
                    title="삭제"
                    className="!min-w-0 !w-8 !h-8 !p-0"
                  >
                    <FiTrash2 size={14} />
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </DomainTable>
  );
}
