// PATH: src/app_admin/domains/staff/pages/OperationsPage/ExpensesPanel.tsx
// 비용 · 경비 — 대형 섹션 카드 스타일 (staff-area), 전역 DS Button 사용

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useWorkMonth } from "../../operations/context/workMonthHooks";
import { useExpenses } from "../../hooks/useExpenses";
import CreateExpenseModal from "./CreateExpenseModal";
import { Button, EmptyState } from "@/shared/ui/ds";
import { ExpenseStatusBadge, LockBadge } from "../../components/StatusBadge";
import { cx } from "@/shared/utils/cx";
import { useConfirm } from "@/shared/ui/confirm";
import type { ExpenseRecord, ExpenseStatus } from "../../api/expenses.api";
import "../../styles/staff-area.css";

type StatusFilter = "ALL" | ExpenseStatus;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "전체" },
  { value: "PENDING", label: "대기" },
  { value: "APPROVED", label: "승인" },
  { value: "REJECTED", label: "반려" },
];

function amountLabel(amount: number) {
  return `${amount.toLocaleString()}원`;
}

function fmtDateTime(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export default function ExpensesPanel() {
  const confirm = useConfirm();
  const {
    staffId,
    range,
    locked,
    lockCheckPending,
    lockCheckFailed,
    writeBlocked,
    canManage,
  } = useWorkMonth();

  const { listQ, patchM, deleteM } = useExpenses({
    staff: staffId,
    date_from: range.from,
    date_to: range.to,
  });

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExpenseRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const rows = useMemo(() => listQ.data ?? [], [listQ.data]);
  const statusSummary = useMemo(() => {
    const summary: Record<StatusFilter, { count: number; amount: number }> = {
      ALL: { count: 0, amount: 0 },
      PENDING: { count: 0, amount: 0 },
      APPROVED: { count: 0, amount: 0 },
      REJECTED: { count: 0, amount: 0 },
    };
    for (const row of rows) {
      summary.ALL.count += 1;
      summary.ALL.amount += row.amount;
      summary[row.status].count += 1;
      summary[row.status].amount += row.amount;
    }
    return summary;
  }, [rows]);
  const visibleRows = useMemo(
    () => statusFilter === "ALL" ? rows : rows.filter((row) => row.status === statusFilter),
    [rows, statusFilter],
  );

  if (listQ.isLoading) {
    return (
      <section className="staff-area staff-section-card">
        <div className="staff-section-card__body">
          <p className="staff-helper">불러오는 중...</p>
        </div>
      </section>
    );
  }
  if (listQ.isError) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="선결제 환급 내역을 불러오지 못했습니다"
        description="연결 상태를 확인한 뒤 다시 시도해 주세요."
        actions={
          <Button intent="secondary" size="sm" onClick={() => void listQ.refetch()}>
            다시 시도
          </Button>
        }
      />
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
            직원 선결제 환급
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
            disabled={writeBlocked}
            title={
              locked
                ? "마감된 월입니다."
                : lockCheckPending
                  ? "마감 상태를 확인하는 중입니다."
                  : lockCheckFailed
                    ? "마감 상태를 확인하지 못해 추가할 수 없습니다."
                    : undefined
            }
            onClick={() => {
              setEditTarget(null);
              setOpen(true);
            }}
          >
            추가
          </Button>
        </div>
        {locked && (
          <p className="staff-helper text-[var(--color-danger)] w-full mt-1">
            마감된 월입니다. 추가·수정·승인할 수 없습니다.
          </p>
        )}
        {lockCheckFailed && (
          <p className="staff-helper text-[var(--color-danger)] w-full mt-1">
            마감 상태를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.
          </p>
        )}
      </div>

      <div className={cx("staff-section-card__body", locked && "opacity-95")}>
        {rows.length > 0 && (
          <div
            className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4"
            role="group"
            aria-label="선결제 환급 상태 필터"
          >
            {STATUS_FILTERS.map((filter) => {
              const selected = statusFilter === filter.value;
              const summary = statusSummary[filter.value];
              return (
                <button
                  key={filter.value}
                  type="button"
                  className="ds-button h-auto min-h-12 justify-between gap-2 px-3 py-2 text-left"
                  data-intent={selected ? "primary" : "secondary"}
                  data-size="sm"
                  aria-pressed={selected}
                  onClick={() => setStatusFilter(filter.value)}
                >
                  <span>{filter.label}</span>
                  <span className="text-[11px] tabular-nums opacity-80">
                    {summary.count}건 · {amountLabel(summary.amount)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="staff-section-card__empty">
            <div className="staff-section-title">선결제 환급 없음</div>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="staff-section-card__empty" role="status">
            <div className="staff-section-title">선택한 상태의 환급 없음</div>
            <p className="staff-helper mt-1">다른 상태를 선택해 확인해 주세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleRows.map((r) => {
              const isPending = r.status === "PENDING";
              const actionDisabled = writeBlocked || patchM.isPending || deleteM.isPending;
              const editDisabled = actionDisabled || !isPending;

              return (
                <div
                  key={r.id}
                  data-testid={`staff-expense-${r.id}`}
                  data-expense-status={r.status}
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
                            {r.status === "APPROVED" ? "승인" : "반려"}:{" "}
                            {r.approved_by_name ?? "-"} · {fmtDateTime(r.approved_at)}
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

                  {canManage && isPending && (
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
                            void (async () => {
                              const ok = await confirm({
                                title: "선결제 환급 승인",
                                message: `${r.date} · ${r.title} · ${amountLabel(r.amount)}을 승인하시겠습니까?`,
                                confirmText: "승인",
                              });
                              if (ok) patchM.mutate({ id: r.id, payload: { status: "APPROVED" } });
                            })();
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
                            void (async () => {
                              const ok = await confirm({
                                title: "선결제 환급 반려",
                                message: `${r.date} · ${r.title} · ${amountLabel(r.amount)}을 반려하시겠습니까?`,
                                confirmText: "반려",
                                danger: true,
                              });
                              if (ok) patchM.mutate({ id: r.id, payload: { status: "REJECTED" } });
                            })();
                          }}
                        >
                          반려
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Button
                            intent="secondary"
                            size="sm"
                            disabled={editDisabled}
                            title={!isPending ? "대기 상태에서만 수정할 수 있습니다." : undefined}
                            onClick={() => {
                              if (editDisabled) return;
                              setEditTarget(r);
                              setOpen(true);
                            }}
                          >
                            수정
                          </Button>
                          <Button
                            intent="danger"
                            size="sm"
                            disabled={editDisabled}
                            title={!isPending ? "대기 상태에서만 삭제할 수 있습니다." : undefined}
                            onClick={() => {
                              if (editDisabled) return;
                              void (async () => {
                                const ok = await confirm({
                                  title: "선결제 환급 삭제",
                                  message: `${r.date} · ${r.title} · ${amountLabel(r.amount)}을 삭제하시겠습니까?`,
                                  confirmText: "삭제",
                                  danger: true,
                                });
                                if (ok) deleteM.mutate(r.id);
                              })();
                            }}
                          >
                            삭제
                          </Button>
                        </div>
                      </div>
                      <label className="flex min-w-0 items-center gap-2">
                        <span className="staff-helper shrink-0 w-[52px]">메모</span>
                        <input
                          key={`${r.id}:${r.updated_at}`}
                          className="h-9 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] px-3 staff-body w-full"
                          placeholder="메모"
                          defaultValue={r.memo}
                          disabled={editDisabled}
                          title={!isPending ? "승인·반려된 환급은 수정할 수 없습니다." : undefined}
                          onBlur={(e) => {
                            const next = e.target.value ?? "";
                            if (next === (r.memo ?? "")) return;
                            if (editDisabled) return;
                            const input = e.currentTarget;
                            patchM.mutate(
                              { id: r.id, payload: { memo: next } },
                              {
                                onError: () => {
                                  input.value = r.memo ?? "";
                                },
                              }
                            );
                          }}
                        />
                      </label>
                    </div>
                  )}
                  {canManage && !isPending && (
                    <div className="mt-3 border-t border-[var(--color-border-divider)] pt-3 staff-helper">
                      처리 완료된 환급은 이력 보존을 위해 수정·삭제할 수 없습니다.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!writeBlocked && (
          <CreateExpenseModal
            open={open}
            initial={editTarget}
            onClose={() => {
              setOpen(false);
              setEditTarget(null);
            }}
          />
        )}
      </div>
    </section>
  );
}
