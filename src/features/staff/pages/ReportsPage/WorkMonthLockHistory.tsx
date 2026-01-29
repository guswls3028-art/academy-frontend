// PATH: src/features/staff/pages/ReportsPage/WorkMonthLockHistory.tsx
import { useQuery } from "@tanstack/react-query";
import { fetchWorkMonthLocks } from "../../api/workMonthLocks.api";
import { LockBadge } from "../../components/StatusBadge";

function ymLabel(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export default function WorkMonthLockHistory({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const listQ = useQuery({
    queryKey: ["work-month-lock-history", year, month],
    queryFn: () => fetchWorkMonthLocks({ year, month }),
  });

  const rows = listQ.data ?? [];

  if (listQ.isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-5 py-6">
        <div className="text-sm font-semibold">마감 내역 없음</div>
        <div className="text-xs text-[var(--text-muted)] mt-1">
          해당 월에는 아직 마감된 직원이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-5 py-4 flex justify-between items-center gap-4"
        >
          <div>
            <div className="font-semibold">
              {r.staff_name ?? `Staff#${r.staff}`}
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {ymLabel(r.year, r.month)} · 마감자{" "}
              {r.locked_by_name ?? "-"}
            </div>
          </div>

          <LockBadge state={r.is_locked ? "LOCKED" : "OPEN"} />
        </div>
      ))}
    </div>
  );
}
