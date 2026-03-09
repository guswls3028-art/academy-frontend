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
      <div className="staff-area rounded-xl border border-[var(--color-border-divider)] bg-[color-mix(in_srgb,var(--color-border-divider)_6%,var(--color-bg-surface))] px-5 py-8 text-center">
        <div className="staff-section-title">마감 내역 없음</div>
        <div className="staff-helper mt-2">해당 월에는 아직 마감된 직원이 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="staff-area space-y-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] px-5 py-4 flex justify-between items-center gap-4 shadow-sm"
        >
          <div>
            <div className="staff-section-title font-semibold">{r.staff_name ?? `Staff#${r.staff}`}</div>
            <div className="staff-helper mt-0.5">
              {ymLabel(r.year, r.month)} · 마감자 {r.locked_by_name ?? "-"}
            </div>
          </div>

          <LockBadge state={r.is_locked ? "LOCKED" : "OPEN"} />
        </div>
      ))}
    </div>
  );
}
