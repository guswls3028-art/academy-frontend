// PATH: src/features/staff/pages/OperationsPage/ExpensesPanel.tsx
// 비용 · 경비 — 대형 섹션 카드 스타일 (staff-area), 전역 DS Button 사용

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useWorkMonth } from "../../operations/context/WorkMonthContext";
import { useExpenses } from "../../hooks/useExpenses";
import CreateExpenseModal from "./CreateExpenseModal";
import { Button } from "@/shared/ui/ds";
import { ExpenseStatusBadge, LockBadge } from "../../components/StatusBadge";
import { feedback } from "@/shared/ui/feedback/feedback";
import "../../styles/staff-area.css";

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
      <section className="staff-area staff-section-card">
        <div className="staff-section-card__body">
          <p className="staff-helper">불러오는 중...</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cx(
        "staff-area staff-section-card",
        "overflow-hidden",
        locked && "staff-section-card--locked"
      )}
    >
      <div
        className={cx(
          "staff-section-card__header flex flex-wrap items-center justify-between gap-4",
          locked && "bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))]"
        )}
      >
        <div>
          <h2 className="staff-section-card__title flex items-center gap-2">
            비용 · 경비
            {locked && <LockBadge state="LOCKED" />}
          </h2>
          <p className="staff-section-card__desc">
            {range.from} ~ {range.to}
          </p>
        </div>
        <div className="shrink-0">
          <Button
            intent="primary"
            size="sm"
            leftIcon={<Plus size={14} strokeWidth={2.5} />}
            disabled={locked}
            title={locked ? "마감된 월입니다." : undefined}
            onClick={() => setOpen(true)}
          >
            추가
          </Button>
        </div>
        {locked && (
          <p className="staff-helper text-[var(--color-danger)] w-full mt-1">
            마감된 월입니다. 추가·수정·승인할 수 없습니다.
          </p>
        )}
      </div>

      <div className={cx("staff-section-card__body", locked && "opacity-95")}>
        {rows.length === 0 ? (
          <div className="staff-section-card__empty">
            <div className="staff-section-title">비용 없음</div>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const isPending = r.status === "PENDING";
              const actionDisabled = locked || patchM.isPending;

              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <div className="staff-body font-semibold">
                        {r.date} · {r.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ExpenseStatusBadge status={r.status} />
                        {r.status !== "PENDING" && (
                          <span className="staff-helper">
                            승인: {r.approved_by_name ?? "-"} · {fmtDateTime(r.approved_at)}
                          </span>
                        )}
                      </div>
                      {!!r.memo && (
                        <div className="staff-helper">메모: {r.memo}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="staff-helper">금액</div>
                      <div className="staff-body font-semibold tabular-nums">
                        {r.amount.toLocaleString()}원
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-border-divider)] flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          intent="primary"
                          size="sm"
                          disabled={
                            actionDisabled ||
                            !isPending
                          }
                          title={
                            actionDisabled
                              ? locked
                                ? "마감된 월입니다."
                                : "처리 중입니다."
                              : !isPending
                              ? "대기 상태에서만 가능합니다."
                              : undefined
                          }
                          onClick={() => {
                            if (actionDisabled || !isPending) return;
                            if (!confirm("이 비용을 승인할까요?")) return;
                            patchM.mutate({ id: r.id, payload: { status: "APPROVED" } });
                          }}
                        >
                          승인
                        </Button>
                        <Button
                          intent="danger"
                          size="sm"
                          disabled={
                            actionDisabled ||
                            !isPending
                          }
                          title={
                            actionDisabled
                              ? locked
                                ? "마감된 월입니다."
                                : "처리 중입니다."
                              : !isPending
                              ? "대기 상태에서만 가능합니다."
                              : undefined
                          }
                          onClick={() => {
                            if (actionDisabled || !isPending) return;
                            if (!confirm("이 비용을 반려할까요?")) return;
                            patchM.mutate({ id: r.id, payload: { status: "REJECTED" } });
                          }}
                        >
                          반려
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="staff-helper shrink-0 w-[52px]">메모</span>
                        <input
                          className="h-9 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] px-3 staff-body w-full"
                          placeholder="메모"
                          defaultValue={r.memo}
                          disabled={actionDisabled}
                          onBlur={(e) => {
                            const next = e.target.value ?? "";
                            if (next === (r.memo ?? "")) return;
                            if (actionDisabled) return;
                            patchM.mutate(
                              { id: r.id, payload: { memo: next } },
                              {
                                onError: (err: unknown) => {
                                  const msg =
                                    (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data?.detail ||
                                    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                                    "메모 수정에 실패했습니다.";
                                  feedback.error(msg);
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
    </section>
  );
}
