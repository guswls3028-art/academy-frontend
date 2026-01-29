// PATH: src/features/staff/pages/OperationsPage/ExpensesPanel.tsx
import { useMemo, useState } from "react";
import { useWorkMonth } from "../../operations/context/WorkMonthContext";
import { useExpenses } from "../../hooks/useExpenses";
import CreateExpenseModal from "./CreateExpenseModal";
import ActionButton from "../../components/ActionButton";
import { ExpenseStatusBadge, LockBadge } from "../../components/StatusBadge";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtDateTime(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export default function ExpensesPanel() {
  const { staffId, range, locked, canManage } = useWorkMonth();

  const { listQ, patchM } = useExpenses({
    staff: staffId,
    date_from: range.from,
    date_to: range.to,
  });

  const [open, setOpen] = useState(false);

  const rows = useMemo(() => listQ.data ?? [], [listQ.data]);

  if (listQ.isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-5 py-4">
        <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)]",
        "overflow-hidden"
      )}
    >
      <div
        className={cx(
          "px-5 py-4 border-b border-[var(--border-divider)]",
          locked ? "bg-[var(--color-danger-soft)]" : "bg-[var(--bg-surface-soft)]"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">비용</div>
              {locked && <LockBadge state="LOCKED" />}
              <span className="text-xs text-[var(--text-muted)]">
                ({range.from} ~ {range.to})
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              * 상태/승인/반려는 서버 기준이며, 프론트는 표시/액션만 수행합니다.
            </div>
          </div>

          <div className="shrink-0">
            <ActionButton
              variant="primary"
              size="xs"
              disabledReason={locked ? "마감된 월입니다." : ""}
              onClick={() => setOpen(true)}
            >
              + 추가
            </ActionButton>
          </div>
        </div>

        {locked && (
          <div className="mt-2 text-xs text-[var(--color-danger)]">
            마감된 월입니다 · 생성/수정/승인/반려 불가
          </div>
        )}
      </div>

      <div className={cx("p-5", locked && "opacity-95")}>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-5 py-5">
            <div className="text-sm font-semibold">비용 없음</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              비용을 추가하면 이곳에 리스트가 표시됩니다.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const isPending = r.status === "PENDING";
              const actionDisabled = locked || patchM.isPending;

              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <div className="font-semibold">
                        {r.date} · {r.title}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <ExpenseStatusBadge status={r.status} />
                        {r.status !== "PENDING" && (
                          <div className="text-xs text-[var(--text-muted)]">
                            승인자: {r.approved_by_name ?? "-"} · {fmtDateTime(r.approved_at)}
                          </div>
                        )}
                      </div>

                      {!!r.memo && (
                        <div className="text-xs text-[var(--text-muted)]">
                          메모: {r.memo}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-xs text-[var(--text-muted)]">금액</div>
                      <div className="font-semibold">{r.amount.toLocaleString()}원</div>
                    </div>
                  </div>

                  {/* 관리자 액션: PENDING만 승인/반려, 메모 수정 */}
                  {canManage && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-divider)] flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
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
                              patchM.mutate({ id: r.id, payload: { status: "APPROVED" } });
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
                              patchM.mutate({ id: r.id, payload: { status: "REJECTED" } });
                            }}
                          >
                            반려
                          </ActionButton>
                        </div>

                        <div className="text-[11px] text-[var(--text-muted)]">
                          * 승인 후 수정 불가(서버 규칙)
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-xs text-[var(--text-muted)] shrink-0 w-[52px]">
                          메모
                        </div>
                        <input
                          className="h-[34px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm w-full"
                          placeholder="메모 수정 (승인 후에는 backend가 거절)"
                          defaultValue={r.memo}
                          disabled={actionDisabled}
                          onBlur={(e) => {
                            const next = e.target.value ?? "";
                            if (next === (r.memo ?? "")) return;
                            if (actionDisabled) return;

                            patchM.mutate(
                              { id: r.id, payload: { memo: next } },
                              {
                                onError: (err: any) => {
                                  const msg =
                                    err?.response?.data?.detail ||
                                    err?.response?.data?.message ||
                                    "메모 수정에 실패했습니다.";
                                  alert(msg);
                                },
                              }
                            );
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!locked && <CreateExpenseModal open={open} onClose={() => setOpen(false)} />}
      </div>

      <div className="px-5 pb-4">
        <div className="text-[11px] text-[var(--text-muted)]">
          * 승인/반려/잠금 규칙은 서버 단일진실입니다. 프론트는 UX로만 안내/차단합니다.
        </div>
      </div>
    </div>
  );
}
