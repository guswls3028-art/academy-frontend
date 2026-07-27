// PATH: src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffExpensesTab.tsx
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useExpenses } from "../../hooks/useExpenses";
import { fetchWorkMonthLocks, isLockedFromLocks } from "../../api/workMonthLocks.api";
import { fetchStaffMe } from "../../api/staffMe.api";
import { staffQueryKeys } from "../../queryKeys";

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
    queryKey: staffQueryKeys.workMonthLocksForMonth(staffId, y, m),
    queryFn: () => fetchWorkMonthLocks({ staff: staffId, year: y, month: m }),
  });

  const meQ = useQuery({
    queryKey: staffQueryKeys.me,
    queryFn: fetchStaffMe,
  });

  const canManage = !!meQ.data?.is_payroll_manager;
  const locked = isLockedFromLocks(locksQ.data);
  const writeBlocked = locked || locksQ.isLoading || locksQ.isError;
  const rows = expenses.listQ.data ?? [];

  return (
    <div className="space-y-3 max-w-[740px]">
      <div className="flex justify-between items-center">
        <div className="text-sm font-semibold">직원 선결제 환급</div>
        {locked && <LockBadge state="LOCKED" />}
      </div>

      {locked && (
        <div className="text-xs text-[var(--color-danger)]">
          * 마감된 월은 선결제 환급 변경(승인/반려 포함)이 불가능합니다.
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

      {expenses.listQ.isError && (
        <div className="text-xs text-[var(--color-danger)]">
          선결제 환급 내역을 불러오지 못했습니다.{" "}
          <button type="button" onClick={() => void expenses.listQ.refetch()} className="underline">
            다시 시도
          </button>
        </div>
      )}

      {expenses.listQ.isLoading && (
        <div className="text-sm text-[var(--text-muted)]">선결제 환급 확인 중…</div>
      )}

      {!expenses.listQ.isLoading && !expenses.listQ.isError && rows.length === 0 && (
        <div className="text-sm text-[var(--text-muted)]">선결제 환급 없음</div>
      )}

      <div className={writeBlocked ? "opacity-95" : ""}>
        {rows.map((e) => {
          const isPending = e.status === "PENDING";
          const actionDisabled = writeBlocked || expenses.patchM.isPending;

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
                        ? locksQ.isLoading
                          ? "마감 상태 확인 중입니다."
                          : locksQ.isError
                            ? "마감 상태를 확인할 수 없습니다."
                            : locked
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
                        ? locksQ.isLoading
                          ? "마감 상태 확인 중입니다."
                          : locksQ.isError
                            ? "마감 상태를 확인할 수 없습니다."
                            : locked
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
        * 직원이 개인 비용으로 먼저 결제한 환급 대상만 등록하세요.
      </div>
    </div>
  );
}
