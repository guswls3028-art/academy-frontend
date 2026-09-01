// PATH: src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffSummaryTab.tsx
import { useQuery } from "@tanstack/react-query";
import { fetchStaffSummaryByRange } from "../../api/staff.detail.api";
import { fetchWorkMonthLocks, isLockedFromLocks } from "../../api/workMonthLocks.api";
import { LockBadge } from "../../components/StatusBadge";
import { staffQueryKeys } from "../../queryKeys";
import { Button, EmptyState } from "@/shared/ui/ds";

export default function StaffSummaryTab({
  staffId,
  year,
  month,
}: {
  staffId: number;
  year: number;
  month: number;
}) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;

  const summaryQ = useQuery({
    queryKey: staffQueryKeys.summaryRange(staffId, from, to),
    queryFn: () => fetchStaffSummaryByRange(staffId, from, to),
  });

  const locksQ = useQuery({
    queryKey: staffQueryKeys.workMonthLocksForMonth(staffId, year, month),
    queryFn: () => fetchWorkMonthLocks({ staff: staffId, year, month }),
  });

  if (summaryQ.isError || locksQ.isError) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="이번 달 직원 요약을 불러올 수 없습니다"
        actions={
          <Button
            intent="secondary"
            size="sm"
            onClick={() => {
              summaryQ.refetch();
              locksQ.refetch();
            }}
          >
            다시 시도
          </Button>
        }
      />
    );
  }
  if (!summaryQ.data || locksQ.isLoading) {
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
          <div className="text-sm font-semibold">선택 월 요약</div>
          <div className="text-xs text-[var(--text-muted)]">
            {from} ~ {to}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LockBadge state={locked ? "LOCKED" : "OPEN"} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Item label="근무시간" value={`${s.work_hours} h`} />
        <Item label="근무기록 금액" value={s.work_amount.toLocaleString()} />
        <Item label="승인 선결제 환급" value={s.expense_amount.toLocaleString()} />
        <Item label="공제 전 합계" value={s.total_amount.toLocaleString()} primary />
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
