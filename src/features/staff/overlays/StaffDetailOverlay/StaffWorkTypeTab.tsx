// PATH: src/features/staff/overlays/StaffDetailOverlay/StaffWorkTypeTab.tsx
// 시급태그 — 학생 태그 디자인 카피 (뱃지 + 추가/제거)
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchStaffWorkTypes,
  fetchWorkTypes,
  createStaffWorkType,
  deleteStaffWorkType,
} from "../../api/staffWorkType.api";
import type { StaffWorkType } from "../../api/staffWorkType.api";

const LIGHT_COLORS = ["#eab308", "#06b6d4"];
const isLight = (c: string) =>
  LIGHT_COLORS.some((x) => String(c || "").toLowerCase() === x);

function WageBadge({
  st,
  onRemove,
  isRemoving,
}: {
  st: StaffWorkType;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const wt = st.work_type;
  const color = wt?.color || "#6b7280";
  const name = wt?.name || "—";
  const wage =
    st.effective_hourly_wage ?? wt?.base_hourly_wage ?? null;
  const label =
    wage != null ? `${name} ${(wage / 10000).toFixed(1)}만` : name;

  return (
    <span
      className="inline-flex items-center gap-1 group cursor-default"
      style={{
        padding: "6px 10px 6px 12px",
        borderRadius: "6px 6px 6px 2px",
        fontSize: 12,
        fontWeight: 700,
        background: color,
        color: isLight(color) ? "#1a1a1a" : "#fff",
        border: "none",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        textShadow: isLight(color) ? "none" : "0 0 1px rgba(0,0,0,0.2)",
      }}
      title={wage != null ? `${wage.toLocaleString()}원/시` : name}
    >
      {label}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        disabled={isRemoving}
        aria-label={`${name} 근무유형 제거`}
        style={{
          marginLeft: 4,
          padding: 0,
          width: 16,
          height: 16,
          borderRadius: 999,
          border: "none",
          background: "rgba(0,0,0,0.2)",
          color: "#fff",
          fontSize: 12,
          cursor: isRemoving ? "wait" : "pointer",
          display: "grid",
          placeItems: "center",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </span>
  );
}

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
      qc.invalidateQueries({ queryKey: ["staff", staffId] });
      qc.invalidateQueries({ queryKey: ["staffs"] });
    },
  });

  const deleteM = useMutation({
    mutationFn: deleteStaffWorkType,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-work-types", staffId] });
      qc.invalidateQueries({ queryKey: ["staff", staffId] });
      qc.invalidateQueries({ queryKey: ["staffs"] });
    },
  });

  const staffTypes = staffTypesQ.data ?? [];
  const workTypes = workTypesQ.data ?? [];
  const availableToAdd = workTypes.filter(
    (wt) => !staffTypes.some((st) => st.work_type.id === wt.id)
  );

  return (
    <div className="space-y-4 max-w-[640px]">
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          marginBottom: 8,
          color: "var(--color-text-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        시급 · 근무유형
      </div>

      {staffTypes.length === 0 && (
        <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3 text-sm">
          <div className="font-semibold">근무유형이 없습니다.</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            * 근무기록을 입력하려면 최소 1개의 근무유형이 필요합니다.
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {staffTypes.map((st) => (
          <WageBadge
            key={st.id}
            st={st}
            onRemove={() => {
              if (!confirm(`"${st.work_type.name}" 근무유형을 제거할까요?`))
                return;
              deleteM.mutate(st.id);
            }}
            isRemoving={deleteM.isPending}
          />
        ))}
      </div>

      <div className="pt-4 border-t border-[var(--border-divider)]">
        <div className="text-xs text-[var(--color-text-muted)] mb-2">
          근무유형 추가
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {availableToAdd.length > 0 ? (
            <select
              className="ds-input"
              style={{ fontSize: 13, minWidth: 160 }}
              value=""
              onChange={(e) => {
                const id = Number(e.target.value);
                if (!id) return;
                createM.mutate({ work_type_id: id });
                e.target.value = "";
              }}
              disabled={createM.isPending}
            >
              <option value="">기존 유형 선택…</option>
              {availableToAdd.map((wt) => (
                <option key={wt.id} value={wt.id}>
                  {wt.name} ({wt.base_hourly_wage?.toLocaleString()}원/시)
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-[var(--color-text-muted)]">
              추가할 근무유형이 없습니다.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
