// PATH: src/features/staff/overlays/StaffDetailOverlay/StaffSummaryTab.tsx
import { useQuery } from "@tanstack/react-query";
import { fetchStaffSummaryByRange } from "../../api/staff.detail.api";
import { fetchWorkMonthLocks, isLockedFromLocks } from "../../api/workMonthLocks.api";
import { LockBadge } from "../../components/StatusBadge";

export default function StaffSummaryTab({ staffId }: { staffId: number }) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;

  const summaryQ = useQuery({
    queryKey: ["staff-summary", staffId, from, to],
    queryFn: () => fetchStaffSummaryByRange(staffId, from, to),
  });

  const locksQ = useQuery({
    queryKey: ["work-month-locks", staffId, y, m],
    queryFn: () => fetchWorkMonthLocks({ staff: staffId, year: y, month: m }),
  });

  if (!summaryQ.data) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  const locked = isLockedFromLocks(locksQ.data);
  const s = summaryQ.data;

  return (
    <div className="space-y-4">
      <div
        className={[
          "rounded-xl border px-4 py-3 flex justify-between items-center",
          locked
            ? "border-[color-mix(in_srgb,var(--color-danger)_55%,transparent)] bg-[var(--color-danger-soft)]"
            : "border-[var(--border-divider)] bg-[var(--bg-surface-soft)]",
        ].join(" ")}
      >
        <div>
          <div className="text-sm font-semibold">이번달 요약</div>
          <div className="text-xs text-[var(--text-muted)]">
            {from} ~ {to}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LockBadge state={locked ? "LOCKED" : "OPEN"} />
          <span
            className={`text-sm font-semibold ${
              locked
                ? "text-[var(--color-danger)]"
                : "text-[var(--color-success)]"
            }`}
          >
            {locked ? "급여 확정" : "진행중"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Item label="근무시간" value={`${s.work_hours} h`} />
        <Item label="급여" value={s.work_amount.toLocaleString()} />
        <Item label="비용" value={s.expense_amount.toLocaleString()} />
        <Item label="실지급액" value={s.total_amount.toLocaleString()} primary />
      </div>
    </div>
  );
}

function Item({
  label,
  value,
  primary,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div
        className={`mt-1 text-lg font-semibold ${
          primary ? "text-[var(--color-primary)]" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
