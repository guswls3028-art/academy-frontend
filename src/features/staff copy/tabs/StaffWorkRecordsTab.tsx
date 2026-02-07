// PATH: src/features/staff/tabs/StaffWorkRecordsTab.tsx
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";

import { fetchStaffMe } from "../api/staffMe.api";

import { fetchWorkTypes, WorkType } from "../api/staffWorkType.api";
import {
  fetchWorkRecords,
  createWorkRecord,
  patchWorkRecord,
  deleteWorkRecord,
  WorkRecord,
} from "../api/staffWorkRecord.api";

import {
  fetchWorkMonthLocks,
  lockWorkMonth,
  isLockedFromLocks,
} from "../api/staffWorkMonthLock.api";

import WorkRecordModal from "../components/WorkRecordModal";
import WorkMonthLockBar from "../components/WorkMonthLockBar";

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

function btnDisabledClass(disabled: boolean) {
  return disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-[var(--bg-surface-soft)]";
}

/* =========================
 * Component
 * ========================= */

export default function StaffWorkRecordsTab() {
  const { staffId } = useParams();
  const sid = Number(staffId);
  const qc = useQueryClient();

  // ✅ 권한 단일진실
  const meQ = useQuery({ queryKey: ["staff-me"], queryFn: fetchStaffMe });
  const canManage =
    !!meQ.data && (meQ.data.is_superuser || meQ.data.is_payroll_manager || meQ.data.is_staff);

  // 기간(기본: 이번달)
  const [range, setRange] = useState(() => getMonthBoundsFrom(todayISO()));

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkRecord | undefined>(undefined);

  // Lock (Backend Truth)
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

  const locked = isLockedFromLocks(locksQ.data);

  const lockM = useMutation({
    mutationFn: () =>
      lockWorkMonth({
        staff: sid,
        year: range.year,
        month: range.month,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-month-locks", sid] });
      qc.invalidateQueries({ queryKey: ["work-records", sid] });
      qc.invalidateQueries({ queryKey: ["payroll-snapshots"] });
      alert("월 마감이 완료되었습니다.");
    },
  });

  const workTypesQ = useQuery({
    queryKey: ["work-types", "active"],
    queryFn: () => fetchWorkTypes({ is_active: true }),
  });

  const recordsQ = useQuery({
    queryKey: ["work-records", sid, range.from, range.to],
    queryFn: () =>
      fetchWorkRecords({
        staff: sid,
        date_from: range.from,
        date_to: range.to,
      }),
    enabled: !!sid,
  });

  const createM = useMutation({
    mutationFn: createWorkRecord,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-records", sid, range.from, range.to] });
      qc.invalidateQueries({ queryKey: ["staff-summary", sid] });
    },
  });

  const patchM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => patchWorkRecord(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-records", sid, range.from, range.to] });
      qc.invalidateQueries({ queryKey: ["staff-summary", sid] });
    },
  });

  const deleteM = useMutation({
    mutationFn: deleteWorkRecord,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-records", sid, range.from, range.to] });
      qc.invalidateQueries({ queryKey: ["staff-summary", sid] });
    },
  });

  const rows = recordsQ.data ?? [];
  const workTypes = (workTypesQ.data ?? []) as WorkType[];

  const totals = useMemo(() => {
    const totalHours = rows.reduce((s, r) => s + Number(r.work_hours || 0), 0);
    const totalAmount = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    return {
      totalHours: Math.round(totalHours * 100) / 100,
      totalAmount,
    };
  }, [rows]);

  const createDisabledReason = locked
    ? "마감된 월은 근무기록을 추가할 수 없습니다."
    : !canManage
    ? "근무기록 관리는 관리자만 가능합니다."
    : "";

  if (meQ.isLoading || locksQ.isLoading || recordsQ.isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      <WorkMonthLockBar
        locks={locksQ.data}
        isManager={canManage}
        onLock={() => lockM.mutate()}
      />

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
                // range.year/month는 from 기준으로 갱신
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

          <div className="pb-[2px] text-xs text-[var(--text-muted)]">
            표시 기간: {range.from} ~ {range.to}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => recordsQ.refetch()}
            className="h-[38px] px-4 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-sm font-semibold"
          >
            새로고침
          </button>

          <button
            disabled={!!createDisabledReason}
            title={createDisabledReason || "근무기록 추가"}
            onClick={() => {
              if (createDisabledReason) return;
              setEditing(undefined);
              setModalOpen(true);
            }}
            className={["btn-primary", btnDisabledClass(!!createDisabledReason)].join(" ")}
          >
            + 근무기록 추가
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
          <div className="text-xs text-[var(--text-muted)]">총 근무시간</div>
          <div className="mt-1 text-lg font-semibold">{totals.totalHours} h</div>
        </div>
        <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
          <div className="text-xs text-[var(--text-muted)]">총 금액</div>
          <div className="mt-1 text-lg font-semibold text-[var(--color-primary)]">
            {totals.totalAmount.toLocaleString()}원
          </div>
        </div>
      </div>

      {/* List */}
      {rows.length === 0 && (
        <EmptyState title="근무기록이 없습니다" message="기간을 변경하거나 근무기록을 추가해 보세요." />
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)]">
          <div className="grid grid-cols-[120px_200px_120px_120px_100px_120px_140px] gap-4 px-4 py-3 text-xs font-semibold text-[var(--text-muted)] border-b bg-[var(--bg-surface-soft)]">
            <div>날짜</div>
            <div>근무유형</div>
            <div>시작</div>
            <div>종료</div>
            <div>휴게(분)</div>
            <div>근무시간</div>
            <div className="text-right">금액 / 작업</div>
          </div>

          {rows.map((r) => {
            const rowLockedReason = locked ? "마감된 월은 수정/삭제가 불가능합니다." : "";
            const permReason = !canManage ? "근무기록 관리는 관리자만 가능합니다." : "";
            const editDisabledReason = rowLockedReason || permReason;
            const deleteDisabledReason = rowLockedReason || permReason;

            return (
              <div
                key={r.id}
                className="grid grid-cols-[120px_200px_120px_120px_100px_120px_140px] gap-4 px-4 py-3 text-sm border-b last:border-b-0 items-center"
              >
                <div className="font-semibold">{r.date}</div>

                <div className="text-sm">
                  {r.work_type_name ?? `#${r.work_type}`}
                </div>

                <div>{(r.start_time || "").slice(0, 5)}</div>
                <div>{(r.end_time || "").slice(0, 5)}</div>
                <div>{Number(r.break_minutes || 0)}</div>
                <div>{String(r.work_hours ?? "-")} h</div>

                <div className="flex items-center justify-end gap-2">
                  <span className="font-semibold">
                    {Number(r.amount || 0).toLocaleString()}원
                  </span>

                  <button
                    disabled={!!editDisabledReason}
                    title={editDisabledReason || "수정"}
                    onClick={() => {
                      if (editDisabledReason) return;
                      setEditing(r);
                      setModalOpen(true);
                    }}
                    className={[
                      "px-2 py-1 text-xs rounded-md border border-[var(--border-divider)]",
                      btnDisabledClass(!!editDisabledReason),
                    ].join(" ")}
                  >
                    수정
                  </button>

                  <button
                    disabled={!!deleteDisabledReason}
                    title={deleteDisabledReason || "삭제"}
                    onClick={() => {
                      if (deleteDisabledReason) return;
                      if (!confirm("삭제할까요?")) return;
                      deleteM.mutate(r.id);
                    }}
                    className={[
                      "px-2 py-1 text-xs rounded-md border border-[var(--color-danger)] text-[var(--color-danger)]",
                      btnDisabledClass(!!deleteDisabledReason),
                    ].join(" ")}
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <WorkRecordModal
        open={modalOpen}
        title={editing ? "근무기록 수정" : "근무기록 추가"}
        workTypes={workTypes}
        staffId={sid}
        initialValue={editing}
        onClose={() => setModalOpen(false)}
        onSubmit={async (payload) => {
          // 정책 보호
          if (locked) {
            alert("마감된 월은 변경할 수 없습니다.");
            return;
          }
          if (!canManage) {
            alert("근무기록 관리는 관리자만 가능합니다.");
            return;
          }

          if (!editing) {
            await createM.mutateAsync(payload);
          } else {
            await patchM.mutateAsync({
              id: editing.id,
              payload,
            });
          }
        }}
        onDelete={
          editing
            ? async () => {
                if (locked) {
                  alert("마감된 월은 삭제할 수 없습니다.");
                  return;
                }
                if (!canManage) {
                  alert("근무기록 관리는 관리자만 가능합니다.");
                  return;
                }
                await deleteM.mutateAsync(editing.id);
              }
            : undefined
        }
      />

      <div className="text-xs text-[var(--text-muted)]">
        * 월 마감 이후에는 근무기록이 변경 불가하며, 급여 스냅샷(확정 데이터)이 생성됩니다.
      </div>
    </div>
  );
}

