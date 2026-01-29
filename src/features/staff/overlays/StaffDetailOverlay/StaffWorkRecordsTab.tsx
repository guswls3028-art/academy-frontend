// PATH: src/features/staff/overlays/StaffDetailOverlay/StaffWorkRecordsTab.tsx
import { useMemo } from "react";
import { useWorkRecords } from "../../hooks/useWorkRecords";
import { fetchWorkMonthLocks, isLockedFromLocks } from "../../api/workMonthLocks.api";
import { useQuery } from "@tanstack/react-query";
import { LockBadge } from "../../components/StatusBadge";
import ActionButton from "../../components/ActionButton";

function getThisMonthRange() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { y, m, from, to };
}

export default function StaffWorkRecordsTab({ staffId }: { staffId: number }) {
  const { y, m, from, to } = useMemo(getThisMonthRange, []);
  const recordsQ = useWorkRecords({ staff: staffId, date_from: from, date_to: to });

  const locksQ = useQuery({
    queryKey: ["work-month-locks", staffId, y, m],
    queryFn: () => fetchWorkMonthLocks({ staff: staffId, year: y, month: m }),
  });

  const locked = isLockedFromLocks(locksQ.data);
  const rows = recordsQ.listQ.data ?? [];

  return (
    <div className="space-y-3 max-w-[720px]">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">근무기록</div>
          {locked && <LockBadge state="LOCKED" />}
        </div>
      </div>

      {locked && (
        <div className="text-xs text-[var(--color-danger)]">
          * 마감된 월은 근무기록 변경이 불가능합니다.
        </div>
      )}

      {rows.length === 0 && (
        <div className="text-sm text-[var(--text-muted)]">기록 없음</div>
      )}

      <div className={locked ? "opacity-95" : ""}>
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex justify-between rounded-lg border border-[var(--border-divider)] px-4 py-2 text-sm bg-[var(--bg-surface)]"
          >
            <div>
              <div className="font-medium">
                {r.date} · {r.work_type_name}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {r.start_time} ~ {r.end_time}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="font-semibold">
                {r.amount.toLocaleString()}원
              </div>

              <ActionButton
                variant="danger-outline"
                size="xs"
                disabledReason={locked ? "마감된 월입니다." : ""}
                onClick={() => {
                  if (locked) return;
                  if (!confirm("이 근무 기록을 삭제할까요?")) return;
                  recordsQ.deleteM.mutate(r.id);
                }}
              >
                삭제
              </ActionButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
