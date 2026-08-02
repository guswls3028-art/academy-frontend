// PATH: src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffWorkRecordsTab.tsx
import { useMemo } from "react";
import { useWorkRecords } from "../../hooks/useWorkRecords";
import { fetchWorkMonthLocks, isLockedFromLocks } from "../../api/workMonthLocks.api";
import { useQuery } from "@tanstack/react-query";
import { LockBadge } from "../../components/StatusBadge";
import ActionButton from "../../components/ActionButton";
import { staffQueryKeys } from "../../queryKeys";
import { useConfirm } from "@/shared/ui/confirm";

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
  const confirm = useConfirm();
  const { y, m, from, to } = useMemo(getThisMonthRange, []);
  const recordsQ = useWorkRecords({ staff: staffId, date_from: from, date_to: to });

  const locksQ = useQuery({
    queryKey: staffQueryKeys.workMonthLocksForMonth(staffId, y, m),
    queryFn: () => fetchWorkMonthLocks({ staff: staffId, year: y, month: m }),
  });

  const locked = isLockedFromLocks(locksQ.data);
  const writeBlocked = locked || locksQ.isLoading || locksQ.isError;
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

      {locksQ.isError && (
        <div className="text-xs text-[var(--color-danger)]">
          마감 상태를 확인하지 못해 변경을 막았습니다.{" "}
          <button type="button" onClick={() => void locksQ.refetch()} className="underline">
            다시 확인
          </button>
        </div>
      )}

      {recordsQ.listQ.isError && (
        <div className="text-xs text-[var(--color-danger)]">
          근무기록을 불러오지 못했습니다.{" "}
          <button type="button" onClick={() => void recordsQ.listQ.refetch()} className="underline">
            다시 시도
          </button>
        </div>
      )}

      {recordsQ.listQ.isLoading && (
        <div className="text-sm text-[var(--text-muted)]">근무기록 확인 중…</div>
      )}

      {!recordsQ.listQ.isLoading && !recordsQ.listQ.isError && rows.length === 0 && (
        <div className="text-sm text-[var(--text-muted)]">기록 없음</div>
      )}

      <div className={`space-y-2 ${writeBlocked ? "opacity-95" : ""}`}>
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
                {(r.amount ?? 0).toLocaleString()}원
              </div>

              <ActionButton
                variant="danger-outline"
                size="xs"
                disabledReason={
                  locksQ.isLoading
                    ? "마감 상태 확인 중입니다."
                    : locksQ.isError
                      ? "마감 상태를 확인할 수 없습니다."
                      : locked
                        ? "마감된 월입니다."
                        : ""
                }
                onClick={() => {
                  if (writeBlocked) return;
                  void (async () => {
                    const ok = await confirm({
                      title: "근무 기록 삭제",
                      message: `${r.date} · ${r.work_type_name} 근무 기록을 삭제하시겠습니까?`,
                      confirmText: "삭제",
                      danger: true,
                    });
                    if (ok) recordsQ.deleteM.mutate(r.id);
                  })();
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
