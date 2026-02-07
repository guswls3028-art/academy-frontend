// PATH: src/features/staff/tabs/StaffExpensesTab.tsx
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";

import {
  fetchExpenses,
  createExpense,
  patchExpense,
  deleteExpense,
  ExpenseRecord,
  ExpenseStatus,
} from "../api/staffExpense.api";

import { fetchStaffDetail } from "../api/staff.detail.api";
import { fetchStaffMe } from "../api/staffMe.api";

import {
  fetchWorkMonthLocks,
  isLockedFromLocks,
} from "../api/staffWorkMonthLock.api";

import ExpenseEditModal from "../components/ExpenseEditModal";

/* =========================
 * Utils
 * ========================= */

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthBoundsFrom(dateISO: string) {
  const y = Number(dateISO.slice(0, 4));
  const m = Number(dateISO.slice(5, 7));
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to, year: y, month: m };
}

const STATUS_LABEL: Record<ExpenseStatus, string> = {
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "반려",
};

function statusTone(status: ExpenseStatus) {
  if (status === "APPROVED") return "bg-green-100 text-green-700 border-green-200";
  if (status === "REJECTED") return "bg-red-100 text-red-700 border-red-200";
  return "bg-gray-200 text-gray-700 border-gray-200";
}

function StatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <span
      className={[
        "px-2 py-0.5 rounded-full text-xs font-semibold border",
        statusTone(status),
      ].join(" ")}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function actionDisabledClass(disabled: boolean) {
  return disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-[var(--bg-surface-soft)]";
}

/* =========================
 * Component
 * ========================= */

export default function StaffExpensesTab() {
  const { staffId } = useParams();
  const sid = Number(staffId);
  const qc = useQueryClient();

  // ✅ 권한 단일진실: 현재 로그인 사용자 기준
  const meQ = useQuery({
    queryKey: ["staff-me"],
    queryFn: fetchStaffMe,
  });

  const canApprove =
    !!meQ.data &&
    (meQ.data.is_superuser || meQ.data.is_payroll_manager || meQ.data.is_staff);

  // staff 정보(표시/컨텍스트용) - 권한판정에 쓰지 말 것
  const staffQ = useQuery({
    queryKey: ["staff", sid],
    queryFn: () => fetchStaffDetail(sid),
    enabled: !!sid,
  });

  // ✅ 기간(기본: 이번달)
  const [range, setRange] = useState(() => getMonthBoundsFrom(todayISO()));
  const [statusFilter, setStatusFilter] = useState<"ALL" | ExpenseStatus>("ALL");

  // ✅ 월 마감 (Backend Truth)
  const locksQ = useQuery({
    queryKey: ["work-month-locks", sid, range.year, range.month],
    queryFn: () =>
      fetchWorkMonthLocks({
        staff: sid,
        year: range.year,
        month: range.month,
      }),
    enabled: !!sid,
  });

  const monthLocked = isLockedFromLocks(locksQ.data);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRecord | undefined>(undefined);

  const listQ = useQuery({
    queryKey: ["expenses", sid, range.from, range.to, statusFilter],
    queryFn: () =>
      fetchExpenses({
        staff: sid,
        date_from: range.from,
        date_to: range.to,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      }),
    enabled: !!sid,
  });

  const createM = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", sid, range.from, range.to] });
      qc.invalidateQueries({ queryKey: ["staff-summary", sid] });
      qc.invalidateQueries({ queryKey: ["payroll-snapshots"] });
    },
  });

  const patchM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => patchExpense(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", sid, range.from, range.to] });
      qc.invalidateQueries({ queryKey: ["staff-summary", sid] });
      qc.invalidateQueries({ queryKey: ["payroll-snapshots"] });
    },
  });

  const delM = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", sid, range.from, range.to] });
      qc.invalidateQueries({ queryKey: ["staff-summary", sid] });
      qc.invalidateQueries({ queryKey: ["payroll-snapshots"] });
    },
  });

  const rows = listQ.data ?? [];

  const totals = useMemo(() => {
    const sumAll = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const sumApproved = rows
      .filter((r) => r.status === "APPROVED")
      .reduce((s, r) => s + Number(r.amount || 0), 0);

    return { sumAll, sumApproved };
  }, [rows]);

  const onQuickSetStatus = async (r: ExpenseRecord, next: ExpenseStatus) => {
    if (!canApprove) return;
    if (monthLocked) return;

    const lockedRow = r.status === "APPROVED" || r.status === "REJECTED";
    if (lockedRow) return;

    await patchM.mutateAsync({
      id: r.id,
      payload: { status: next },
    });
  };

  const createDisabledReason = monthLocked
    ? "마감된 월은 비용을 추가할 수 없습니다."
    : "";

  if (listQ.isLoading || staffQ.isLoading || meQ.isLoading || locksQ.isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Month Lock Banner (readonly for Expenses) */}
      <div
        className={[
          "rounded-lg border px-4 py-3 text-sm flex items-center justify-between gap-3",
          monthLocked
            ? "border-red-300 bg-red-50 text-red-700"
            : "border-green-300 bg-green-50 text-green-700",
        ].join(" ")}
      >
        <div className="space-y-0.5">
          <div className="font-semibold">
            {monthLocked ? "🔒 마감된 월" : "🔓 진행중인 월"}
          </div>
          <div className="text-[11px] opacity-90">
            * 월 마감 = 급여 확정(스냅샷 생성) · 마감된 월은 비용 수정/삭제/승인 불가
          </div>
        </div>

        <div
          className={[
            "px-2 py-1 rounded-full text-xs font-semibold border shrink-0",
            canApprove
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-gray-50 text-gray-600 border-gray-200",
          ].join(" ")}
          title={canApprove ? "관리자 권한" : "일반 사용자 권한"}
        >
          {canApprove ? "관리자 모드" : "일반 사용자 모드"}
        </div>
      </div>

      {/* Context header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold">
            비용 관리{" "}
            {staffQ.data?.name ? (
              <span className="text-[var(--text-muted)] font-normal">
                · {staffQ.data.name}
              </span>
            ) : null}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            승인/반려는 관리자만 가능 · 승인/반려된 비용은 수정/삭제 불가 · 마감된 월은 전부 변경 불가
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs font-medium text-[var(--text-muted)]">기간 시작</div>
            <input
              type="date"
              value={range.from}
              onChange={(e) => {
                const next = e.target.value;
                setRange(getMonthBoundsFrom(next));
              }}
              className="h-[38px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm outline-none"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-[var(--text-muted)]">기간 종료</div>
            <input
              type="date"
              value={range.to}
              onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))}
              className="h-[38px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm outline-none"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-[var(--text-muted)]">상태</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-[38px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm outline-none"
            >
              <option value="ALL">전체</option>
              <option value="PENDING">대기</option>
              <option value="APPROVED">승인</option>
              <option value="REJECTED">반려</option>
            </select>
          </div>

          <div className="pb-[2px] text-xs text-[var(--text-muted)]">
            표시 기간: {range.from} ~ {range.to}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              listQ.refetch();
              locksQ.refetch();
            }}
            className="h-[38px] px-4 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-sm font-semibold"
          >
            새로고침
          </button>

          <button
            disabled={!!createDisabledReason}
            title={createDisabledReason || "비용 등록"}
            onClick={() => {
              if (createDisabledReason) return;
              setEditing(undefined);
              setModalOpen(true);
            }}
            className={["btn-primary", actionDisabledClass(!!createDisabledReason)].join(" ")}
          >
            + 비용 등록
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
          <div className="text-xs text-[var(--text-muted)]">합계(표시된 목록)</div>
          <div className="mt-1 text-lg font-semibold">{totals.sumAll.toLocaleString()}원</div>
        </div>
        <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
          <div className="text-xs text-[var(--text-muted)]">승인 합계</div>
          <div className="mt-1 text-lg font-semibold text-[var(--color-primary)]">
            {totals.sumApproved.toLocaleString()}원
          </div>
        </div>
      </div>

      {rows.length === 0 && (
        <EmptyState title="비용이 없습니다" message="비용을 등록하거나 기간/상태 필터를 변경해 보세요." />
      )}

      <div className="space-y-2">
        {rows.map((r) => {
          const lockedRow = r.status === "APPROVED" || r.status === "REJECTED";
          const hardLocked = monthLocked || lockedRow;

          const approveDisabledReason = monthLocked
            ? "마감된 월은 상태 변경이 불가능합니다."
            : lockedRow
            ? "승인/반려된 비용은 상태 변경이 불가능합니다."
            : !canApprove
            ? "승인/반려는 관리자만 가능합니다."
            : "";

          const rejectDisabledReason = approveDisabledReason;

          const editDisabledReason = monthLocked
            ? "마감된 월은 수정이 불가능합니다."
            : lockedRow
            ? "승인/반려된 비용은 수정이 불가능합니다."
            : "";

          const deleteDisabledReason = monthLocked
            ? "마감된 월은 삭제가 불가능합니다."
            : lockedRow
            ? "승인/반려된 비용은 삭제가 불가능합니다."
            : "";

          return (
            <div
              key={r.id}
              className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-sm">{r.title}</div>
                    <StatusBadge status={r.status} />
                    {monthLocked && (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-red-50 text-red-700 border-red-200"
                        title="마감된 월"
                      >
                        마감
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[var(--text-muted)]">
                    {r.date}
                    {r.memo ? ` · ${r.memo}` : ""}
                  </div>

                  {r.approved_at && (
                    <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                      승인자: <b>{r.approved_by_name || "-"}</b> · 승인시각:{" "}
                      <b>{new Date(r.approved_at).toLocaleString()}</b>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="font-semibold">{Number(r.amount || 0).toLocaleString()}원</div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={!!approveDisabledReason || r.status === "APPROVED"}
                      title={
                        approveDisabledReason ||
                        (r.status === "APPROVED" ? "이미 승인 상태입니다." : "승인 처리")
                      }
                      onClick={() => onQuickSetStatus(r, "APPROVED")}
                      className={[
                        "h-[32px] px-3 rounded-lg border text-xs font-semibold",
                        "border-green-300 bg-green-50 text-green-700",
                        actionDisabledClass(!!approveDisabledReason || r.status === "APPROVED"),
                      ].join(" ")}
                    >
                      승인
                    </button>

                    <button
                      disabled={!!rejectDisabledReason || r.status === "REJECTED"}
                      title={
                        rejectDisabledReason ||
                        (r.status === "REJECTED" ? "이미 반려 상태입니다." : "반려 처리")
                      }
                      onClick={() => onQuickSetStatus(r, "REJECTED")}
                      className={[
                        "h-[32px] px-3 rounded-lg border text-xs font-semibold",
                        "border-red-300 bg-red-50 text-red-700",
                        actionDisabledClass(!!rejectDisabledReason || r.status === "REJECTED"),
                      ].join(" ")}
                    >
                      반려
                    </button>

                    <button
                      disabled={!!editDisabledReason}
                      title={editDisabledReason || "수정"}
                      onClick={() => {
                        if (hardLocked) return;
                        setEditing(r);
                        setModalOpen(true);
                      }}
                      className={[
                        "h-[32px] px-3 rounded-lg border border-[var(--border-divider)] text-xs font-semibold",
                        actionDisabledClass(!!editDisabledReason),
                      ].join(" ")}
                    >
                      수정
                    </button>

                    <button
                      disabled={!!deleteDisabledReason}
                      title={deleteDisabledReason || "삭제"}
                      onClick={() => {
                        if (hardLocked) return;
                        if (!confirm("삭제할까요?")) return;
                        delM.mutate(r.id);
                      }}
                      className={[
                        "h-[32px] px-3 rounded-lg border border-[var(--color-danger)] text-[var(--color-danger)] text-xs font-semibold",
                        actionDisabledClass(!!deleteDisabledReason),
                      ].join(" ")}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      <ExpenseEditModal
        open={modalOpen}
        title={editing ? "비용 수정" : "비용 등록"}
        staffId={sid}
        isManager={canApprove}
        initialValue={editing}
        onClose={() => setModalOpen(false)}
        onSubmit={async (payload) => {
          if (monthLocked) {
            alert("마감된 월은 변경할 수 없습니다.");
            return;
          }

          if (!editing) {
            const safePayload = canApprove
              ? payload
              : { ...payload, status: "PENDING" as ExpenseStatus };
            await createM.mutateAsync(safePayload);
          } else {
            if (editing.status === "APPROVED" || editing.status === "REJECTED") return;
            await patchM.mutateAsync({
              id: editing.id,
              payload: canApprove
                ? payload
                : { ...payload, status: "PENDING" as ExpenseStatus },
            });
          }
        }}
        onDelete={
          editing
            ? async () => {
                if (monthLocked) {
                  alert("마감된 월은 삭제할 수 없습니다.");
                  return;
                }
                if (editing.status === "APPROVED" || editing.status === "REJECTED") return;
                await delM.mutateAsync(editing.id);
              }
            : undefined
        }
      />
    </div>
  );
}
