// PATH: src/features/staff/overlays/StaffDetailOverlay/StaffExpensesTab.tsx
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useExpenses } from "../../hooks/useExpenses";
import { fetchWorkMonthLocks, isLockedFromLocks } from "../../api/workMonthLocks.api";
import { fetchStaffMe } from "../../api/staffMe.api";

import ActionButton from "../../components/ActionButton";
import { ExpenseStatusBadge, LockBadge } from "../../components/StatusBadge";

function getThisMonthRange() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { y, m, from, to };
}

function fmtDateTime(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export default function StaffExpensesTab({ staffId }: { staffId: number }) {
  const { y, m, from, to } = useMemo(getThisMonthRange, []);
  const expenses = useExpenses({ staff: staffId, date_from: from, date_to: to });

  const locksQ = useQuery({
    queryKey: ["work-month-locks", staffId, y, m],
    queryFn: () => fetchWorkMonthLocks({ staff: staffId, year: y, month: m }),
  });

  const meQ = useQuery({
    queryKey: ["staff-me"],
    queryFn: fetchStaffMe,
  });

  const canManage = !!meQ.data?.is_payroll_manager;
  const locked = isLockedFromLocks(locksQ.data);
  const rows = expenses.listQ.data ?? [];

  return (
    <div className="space-y-3 max-w-[740px]">
      <div className="flex justify-between items-center">
        <div className="text-sm font-semibold">비용</div>
        {locked && <LockBadge state="LOCKED" />}
      </div>

      {locked && (
        <div className="text-xs text-[var(--color-danger)]">
          * 마감된 월은 비용 변경(승인/반려 포함)이 불가능합니다.
        </div>
      )}

      {rows.length === 0 && (
        <div className="text-sm text-[var(--text-muted)]">비용 없음</div>
      )}

      <div className={locked ? "opacity-95" : ""}>
        {rows.map((e) => {
          const isPending = e.status === "PENDING";
          const actionDisabled = locked || expenses.patchM.isPending;

          return (
            <div
              key={e.id}
              className="rounded-lg border border-[var(--border-divider)] px-4 py-3 text-sm bg-[var(--bg-surface)] space-y-2"
            >
              <div className="flex justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium">
                    {e.date} · {e.title}
                  </div>

                  <div className="flex items-center gap-2">
                    <ExpenseStatusBadge status={e.status} />
                    {e.status !== "PENDING" && (
                      <div className="text-xs text-[var(--text-muted)]">
                        승인자: {e.approved_by_name ?? "-"} · {fmtDateTime(e.approved_at)}
                      </div>
                    )}
                  </div>

                  {!!e.memo && (
                    <div className="text-xs text-[var(--text-muted)]">메모: {e.memo}</div>
                  )}
                </div>

                <div className="font-semibold">{e.amount.toLocaleString()}원</div>
              </div>

              {canManage && (
                <div className="flex items-center justify-end gap-2">
                  <ActionButton
                    variant="success"
                    size="xs"
                    disabledReason={
                      actionDisabled
                        ? locked
                          ? "마감된 월입니다."
                          : "처리 중입니다."
                        : !isPending
                        ? "대기 상태에서만 가능합니다."
                        : ""
                    }
                    onClick={() => {
                      if (actionDisabled || !isPending) return;
                      if (!confirm("이 비용을 승인할까요?")) return;
                      expenses.patchM.mutate({ id: e.id, payload: { status: "APPROVED" } });
                    }}
                  >
                    승인
                  </ActionButton>

                  <ActionButton
                    variant="danger-outline"
                    size="xs"
                    disabledReason={
                      actionDisabled
                        ? locked
                          ? "마감된 월입니다."
                          : "처리 중입니다."
                        : !isPending
                        ? "대기 상태에서만 가능합니다."
                        : ""
                    }
                    onClick={() => {
                      if (actionDisabled || !isPending) return;
                      if (!confirm("이 비용을 반려할까요?")) return;
                      expenses.patchM.mutate({ id: e.id, payload: { status: "REJECTED" } });
                    }}
                  >
                    반려
                  </ActionButton>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-[var(--text-muted)]">
        * 비용 상태/승인은 서버 기준이며, 프론트는 표시/액션만 수행합니다.
      </div>
    </div>
  );
}
