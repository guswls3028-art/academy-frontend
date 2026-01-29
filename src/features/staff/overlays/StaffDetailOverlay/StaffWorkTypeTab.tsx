// PATH: src/features/staff/overlays/StaffDetailOverlay/StaffWorkTypeTab.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchStaffWorkTypes,
  fetchWorkTypes,
  createStaffWorkType,
  patchStaffWorkType,
  deleteStaffWorkType,
} from "../../api/staffWorkType.api";

export default function StaffWorkTypeTab({ staffId }: { staffId: number }) {
  const qc = useQueryClient();

  const staffTypesQ = useQuery({
    queryKey: ["staff-work-types", staffId],
    queryFn: () => fetchStaffWorkTypes(staffId),
  });

  const workTypesQ = useQuery({
    queryKey: ["work-types"],
    queryFn: () => fetchWorkTypes({ is_active: true }),
  });

  const createM = useMutation({
    mutationFn: (payload: { work_type_id: number }) =>
      createStaffWorkType(staffId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-work-types", staffId] });
    },
  });

  const patchM = useMutation({
    mutationFn: ({ id, hourly_wage }: { id: number; hourly_wage: number | null }) =>
      patchStaffWorkType(id, { hourly_wage }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-work-types", staffId] });
    },
  });

  const deleteM = useMutation({
    mutationFn: deleteStaffWorkType,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-work-types", staffId] });
    },
  });

  const staffTypes = staffTypesQ.data ?? [];
  const workTypes = workTypesQ.data ?? [];

  return (
    <div className="space-y-4 max-w-[640px]">
      <div className="text-sm font-semibold">시급 · 근무유형</div>

      {staffTypes.length === 0 && (
        <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3 text-sm">
          <div className="font-semibold">근무유형이 없습니다.</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            * 근무기록을 입력하려면 최소 1개의 근무유형이 필요합니다.
          </div>
        </div>
      )}

      {staffTypes.map((st) => (
        <div
          key={st.id}
          className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
        >
          <div>
            <div className="font-medium">{st.work_type.name}</div>
            <div className="text-xs text-[var(--text-muted)]">
              {st.hourly_wage == null
                ? "기본 시급 사용"
                : `개별 시급: ${st.hourly_wage.toLocaleString()}원`}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              className="w-[120px] input"
              defaultValue={st.hourly_wage ?? ""}
              placeholder="시급"
              onBlur={(e) => {
                const v = e.target.value;
                patchM.mutate({
                  id: st.id,
                  hourly_wage: v === "" ? null : Number(v),
                });
              }}
            />

            <button
              onClick={() => {
                if (!confirm("이 근무유형을 제거할까요?")) return;
                deleteM.mutate(st.id);
              }}
              className="text-xs text-[var(--color-danger)]"
            >
              삭제
            </button>
          </div>
        </div>
      ))}

      <div className="pt-4 border-t">
        <div className="text-xs text-[var(--text-muted)] mb-1">
          근무유형 추가
        </div>
        <select
          className="input"
          onChange={(e) => {
            const id = Number(e.target.value);
            if (!id) return;
            createM.mutate({ work_type_id: id });
            e.target.value = "";
          }}
        >
          <option value="">선택</option>
          {workTypes
            .filter(
              (wt) => !staffTypes.some((st) => st.work_type.id === wt.id)
            )
            .map((wt) => (
              <option key={wt.id} value={wt.id}>
                {wt.name}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}
