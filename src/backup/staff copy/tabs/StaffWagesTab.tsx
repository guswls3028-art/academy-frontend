// PATH: src/features/staff/tabs/StaffWagesTab.tsx
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchWorkTypes,
  fetchStaffWorkTypes,
  createStaffWorkType,
  patchStaffWorkType,
  deleteStaffWorkType,
  StaffWorkType,
  WorkType,
} from "../api/staffWorkType.api";
import { EmptyState } from "@/shared/ui/feedback";

export default function StaffWagesTab() {
  const { staffId } = useParams();
  const sid = Number(staffId);
  const qc = useQueryClient();

  const staffWagesQ = useQuery({
    queryKey: ["staff-work-types", sid],
    queryFn: () => fetchStaffWorkTypes(sid),
    enabled: !!sid,
  });

  const workTypesQ = useQuery({
    queryKey: ["work-types", "active"],
    queryFn: () => fetchWorkTypes({ is_active: true }),
  });

  const rows = (staffWagesQ.data ?? []) as StaffWorkType[];
  const workTypes = (workTypesQ.data ?? []) as WorkType[];

  const usedWorkTypeIds = useMemo(() => new Set(rows.map((r) => r.work_type.id)), [rows]);
  const addable = useMemo(
    () => workTypes.filter((w) => !usedWorkTypeIds.has(w.id)),
    [workTypes, usedWorkTypeIds]
  );

  const addM = useMutation({
    mutationFn: (workTypeId: number) => createStaffWorkType(sid, { work_type_id: workTypeId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-work-types", sid] }),
  });

  const patchM = useMutation({
    mutationFn: ({ id, hourly_wage }: { id: number; hourly_wage: number | null }) =>
      patchStaffWorkType(id, { hourly_wage }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-work-types", sid] }),
  });

  const delM = useMutation({
    mutationFn: (id: number) => deleteStaffWorkType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-work-types", sid] }),
  });

  const [editing, setEditing] = useState<Record<number, string>>({});

  const GRID = "grid grid-cols-[220px_140px_160px_160px_80px] gap-4 items-center";

  if (staffWagesQ.isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)]">
        <div className="px-4 py-3 bg-[var(--bg-surface-soft)] text-xs font-medium text-[var(--text-muted)]">
          <div className={GRID}>
            <div>근무유형</div>
            <div>기본시급</div>
            <div>개별시급</div>
            <div>적용시급</div>
            <div className="text-right"> </div>
          </div>
        </div>

        {rows.length === 0 && (
          <div className="p-6">
            <EmptyState title="설정된 근무유형이 없습니다" message="아래에서 근무유형을 추가해 보세요." />
          </div>
        )}

        {rows.map((r) => {
          const value = editing[r.id] ?? (r.hourly_wage ?? "").toString();
          const usesBase = r.hourly_wage == null;

          return (
            <div key={r.id} className="px-4 py-3 border-t border-[var(--border-divider)]">
              <div className={GRID}>
                <div className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: r.work_type.color }}
                  />
                  {r.work_type.name}
                </div>

                <div className="text-sm">
                  {Number(r.work_type.base_hourly_wage || 0).toLocaleString()}원
                </div>

                <div className="text-sm">
                  <input
                    value={value}
                    onChange={(e) => setEditing((p) => ({ ...p, [r.id]: e.target.value }))}
                    onBlur={() => {
                      const raw = (editing[r.id] ?? "").trim();
                      const next = raw === "" ? null : Number(raw);
                      if (raw !== "" && Number.isNaN(next)) {
                        setEditing((p) => ({ ...p, [r.id]: (r.hourly_wage ?? "").toString() }));
                        return;
                      }
                      patchM.mutate({ id: r.id, hourly_wage: next });
                    }}
                    placeholder="비우면 기본시급"
                    className="h-[38px] w-[150px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm outline-none focus:border-[var(--color-primary)]"
                  />
                  {usesBase && (
                    <span className="ml-2 text-xs text-[var(--text-muted)]">기본시급 사용중</span>
                  )}
                </div>

                <div className="text-sm font-semibold">
                  {Number(r.effective_hourly_wage || 0).toLocaleString()}원
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      if (!confirm("이 근무유형을 삭제할까요?")) return;
                      delM.mutate(r.id);
                    }}
                    className="text-xs font-semibold text-[var(--color-danger)] hover:underline"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add WorkType */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs text-[var(--text-muted)] mr-1">추가:</div>
        {addable.length === 0 ? (
          <div className="text-xs text-[var(--text-muted)]">추가 가능한 근무유형이 없습니다.</div>
        ) : (
          addable.map((wt) => (
            <button
              key={wt.id}
              onClick={() => addM.mutate(wt.id)}
              className="h-[34px] px-3 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-xs font-semibold hover:bg-[var(--bg-surface-soft)]"
            >
              + {wt.name}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
