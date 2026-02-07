// PATH: src/features/staff/tabs/AdminWorkMonthLockHistoryTab.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/shared/ui/ds";

import { fetchWorkMonthLocks, WorkMonthLock } from "../api/staffWorkMonthLock.api";

/* =========================
 * Utils
 * ========================= */

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function ymLabel(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

/* =========================
 * Component
 * ========================= */

export default function AdminWorkMonthLockHistoryTab() {
  const [ym, setYm] = useState(() => currentYearMonth());

  const listQ = useQuery({
    queryKey: ["work-month-locks-history", ym.year, ym.month],
    queryFn: () =>
      fetchWorkMonthLocks({
        year: ym.year,
        month: ym.month,
      } as any), // staff 없이 조회 (관리자 전용)
  });

  const rows = (listQ.data ?? []) as WorkMonthLock[];

  if (listQ.isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-end justify-between gap-3">
        <div className="text-sm font-semibold">
          월 마감 히스토리 ({ymLabel(ym.year, ym.month)})
        </div>

        <div className="flex items-center gap-2">
          <select
            value={ym.year}
            onChange={(e) =>
              setYm((p) => ({ ...p, year: Number(e.target.value) }))
            }
            className="h-[36px] rounded-lg border px-2 text-sm"
          >
            {[ym.year - 1, ym.year, ym.year + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={ym.month}
            onChange={(e) =>
              setYm((p) => ({ ...p, month: Number(e.target.value) }))
            }
            className="h-[36px] rounded-lg border px-2 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardBody className="p-0">
          <div className="grid grid-cols-[180px_120px_140px_200px] gap-4 px-4 py-3 text-xs font-semibold text-[var(--text-muted)] border-b">
            <div>직원</div>
            <div>마감월</div>
            <div>마감자</div>
            <div>마감일시</div>
          </div>

          {rows.length === 0 && (
            <div className="px-4 py-6 text-sm text-[var(--text-muted)]">
              해당 월에 마감된 기록이 없습니다.
            </div>
          )}

          {rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[180px_120px_140px_200px] gap-4 px-4 py-3 text-sm border-b last:border-b-0"
            >
              <div className="font-semibold">
                {r.staff_name ?? `Staff#${r.staff}`}
              </div>

              <div>{ymLabel(r.year, r.month)}</div>

              <div>{r.locked_by ?? "-"}</div>

              <div className="text-xs text-[var(--text-muted)]">
                {r.created_at
                  ? new Date(r.created_at).toLocaleString()
                  : "-"}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="text-xs text-[var(--text-muted)]">
        * 본 히스토리는 급여/회계 감사 로그이며 수정할 수 없습니다.
      </div>
    </div>
  );
}
