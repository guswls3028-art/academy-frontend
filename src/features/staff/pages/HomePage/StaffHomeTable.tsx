// PATH: src/features/staff/pages/HomePage/StaffHomeTable.tsx
// Design: docs/DESIGN_SSOT.md — staff 도메인: 대표(원장) / 강사 / 조교 통일

import { useMemo, useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { EmptyState } from "@/shared/ui/ds";
import { DomainTable, TABLE_COL } from "@/shared/ui/domain";
import { StaffRoleAvatar } from "@/shared/ui/avatars";
import { Staff, type StaffListOwner } from "../../api/staff.api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchStaffDetail } from "../../api/staff.detail.api";
import { fetchWorkTypes, createStaffWorkType, type WorkType } from "../../api/staffWorkType.api";

/** 직원 목록 선택 시 원장 행용 sentinel id (삭제 제외) */
export const OWNER_SELECTION_ID = -1;

const LIGHT_TAG_COLORS = ["#eab308", "#06b6d4"];
function isLightTagColor(c: string) {
  return LIGHT_TAG_COLORS.some((x) => String(c || "").toLowerCase() === x);
}

/** 시급태그 — 학생 태그 디자인 카피 (이름 + 색상 뱃지). 빈 목록이면 아무것도 표시하지 않음 */
function WorkTypeTags({ workTypes }: { workTypes: Staff["staff_work_types"] }) {
  const list = Array.isArray(workTypes) ? workTypes : [];

  if (list.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap gap-1 justify-center">
      {list.slice(0, 4).map((st) => {
        const wt = st.work_type;
        const color = wt?.color || "#6b7280";
        const name = wt?.name || "-";
        const wage = wt?.base_hourly_wage != null ? st.effective_hourly_wage ?? wt.base_hourly_wage : null;
        const label = wage != null ? `${name} ${(wage / 10000).toFixed(1)}만` : name;
        return (
          <span
            key={st.id}
            className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap"
            style={{
              backgroundColor: color,
              color: isLightTagColor(color) ? "#1a1a1a" : "#fff",
              border: "none",
              boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
            }}
            title={`${name} · ${wage != null ? `${wage.toLocaleString()}원/시` : ""}`}
          >
            {label}
          </span>
        );
      })}
      {list.length > 4 && <span className="text-[11px] text-[var(--color-text-muted)]">+{list.length - 4}</span>}
    </span>
  );
}

/** 드롭업 옵션 1개 — 실제 색상 뱃지로 표시 */
function WorkTypeOption({
  wt,
  onSelect,
  disabled,
}: {
  wt: WorkType;
  onSelect: () => void;
  disabled: boolean;
}) {
  const color = wt.color || "#6b7280";
  const name = wt.name || "";
  const wageText =
    wt.base_hourly_wage != null ? ` (${(wt.base_hourly_wage / 10000).toFixed(1)}만/시)` : "";
  const label = `${name}${wageText}`;
  return (
    <button
      type="button"
      className="w-full text-left px-2 py-1.5 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
      onClick={onSelect}
      disabled={disabled}
    >
      <span
        className="inline-flex items-center shrink-0 px-2 py-1 rounded text-[12px] font-semibold"
        style={{
          backgroundColor: color,
          color: isLightTagColor(color) ? "#1a1a1a" : "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
        }}
      >
        {label}
      </span>
    </button>
  );
}

interface Props {
  staffs: Staff[] | undefined;
  owner?: StaffListOwner | null;
  onOperate: (staffId: number) => void;
  onDetail: (staffId: number) => void;
  canManage: boolean;
  selectedIds?: number[];
  onSelectionChange?: (ids: number[]) => void;
}

const COL = {
  checkbox: TABLE_COL.checkbox,
  role: 72,
  name: TABLE_COL.nameCompact,
  phone: TABLE_COL.phone,
  status: TABLE_COL.statusBadge,
  manager: 88,
  payType: 124,
  workTypeTags: 380,
} as const;

const TABLE_WIDTH =
  COL.checkbox +
  COL.role +
  COL.name +
  COL.phone +
  COL.status +
  COL.manager +
  COL.payType +
  COL.workTypeTags;

export function StaffHomeTable({
  staffs,
  owner,
  onOperate,
  onDetail,
  canManage,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
}: Props) {
  const dataSource: Staff[] = Array.isArray(staffs) ? staffs : [];
  const hasOwner = !!owner?.name;
  const qc = useQueryClient();
  const [internalSelected, setInternalSelected] = useState<number[]>([]);
  const selectedIds = onSelectionChange && controlledSelectedIds !== undefined ? controlledSelectedIds : internalSelected;
  const setSelectedIds = onSelectionChange && controlledSelectedIds !== undefined
    ? onSelectionChange
    : setInternalSelected;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allIds = useMemo(
    () => (hasOwner ? [OWNER_SELECTION_ID] : []).concat(dataSource.map((r) => r.id)),
    [hasOwner, dataSource]
  );
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedSet.has(id));

  const toggleSelect = (id: number) => {
    if (selectedSet.has(id)) setSelectedIds(selectedIds.filter((x) => x !== id));
    else setSelectedIds([...selectedIds, id]);
  };
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(selectedIds.filter((id) => !allIds.includes(id)));
    else setSelectedIds([...new Set([...selectedIds, ...allIds])]);
  };

  const patchPayTypeM = useMutation({
    mutationFn: ({ staffId, pay_type }: { staffId: number; pay_type: "HOURLY" | "MONTHLY" }) =>
      patchStaffDetail(staffId, { pay_type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staffs"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string; message?: string } } })?.response?.data?.detail ||
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "급여 유형 변경에 실패했습니다.";
      alert(msg);
    },
  });

  const patchManagerM = useMutation({
    mutationFn: ({ staffId, is_manager }: { staffId: number; is_manager: boolean }) =>
      patchStaffDetail(staffId, { is_manager }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staffs"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string; message?: string } } })?.response?.data?.detail ||
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "관리자 권한 변경에 실패했습니다.";
      alert(msg);
    },
  });

  const workTypesQ = useQuery({
    queryKey: ["staffs", "work-types"],
    queryFn: () => fetchWorkTypes({ is_active: true }),
  });
  const allWorkTypes = workTypesQ.data ?? [];

  const addTagM = useMutation({
    mutationFn: ({ staffId, work_type_id }: { staffId: number; work_type_id: number }) =>
      createStaffWorkType(staffId, { work_type_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staffs"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
      setOpenAddForStaffId(null);
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "시급태그 추가에 실패했습니다.";
      alert(msg);
    },
  });

  const [openAddForStaffId, setOpenAddForStaffId] = useState<number | null>(null);
  const addDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openAddForStaffId === null) return;
    function handleClickOutside(ev: MouseEvent) {
      if (addDropdownRef.current?.contains(ev.target as Node)) return;
      setOpenAddForStaffId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openAddForStaffId]);

  if (dataSource.length === 0 && !hasOwner) {
    return (
      <EmptyState
        title="직원 정보가 없습니다."
        description="직원을 등록하거나 검색 조건을 확인해 주세요."
        scope="panel"
      />
    );
  }

  return (
    <div style={{ width: "fit-content" }}>
      <DomainTable
        tableClassName="ds-table--flat ds-table--center"
        tableStyle={{ tableLayout: "fixed", width: TABLE_WIDTH }}
      >
        <colgroup>
          <col style={{ width: COL.checkbox }} />
          <col style={{ width: COL.role }} />
          <col style={{ width: COL.name }} />
          <col style={{ width: COL.phone }} />
          <col style={{ width: COL.status }} />
          <col style={{ width: COL.manager }} />
          <col style={{ width: COL.payType }} />
          <col style={{ width: COL.workTypeTags }} />
        </colgroup>

        <thead>
          <tr>
            <th scope="col" style={{ width: COL.checkbox }} className="ds-checkbox-cell" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={Boolean(allSelected)}
                ref={(el) => {
                  if (el) el.indeterminate = !allSelected && selectedSet.size > 0;
                }}
                onChange={toggleSelectAll}
                aria-label="전체 선택"
                className="cursor-pointer"
              />
            </th>
            <th scope="col">직위</th>
            <th scope="col">이름</th>
            <th scope="col">전화번호</th>
            <th scope="col">상태</th>
            <th scope="col">관리자권한</th>
            <th scope="col">급여유형</th>
            <th scope="col">시급태그</th>
          </tr>
        </thead>

        <tbody>
          {hasOwner && (
            <tr className="bg-[var(--color-bg-surface-hover)]/60" aria-label="대표">
              <td onClick={(e) => e.stopPropagation()} style={{ width: COL.checkbox }} className="ds-checkbox-cell align-middle">
                <input
                  type="checkbox"
                  checked={!!selectedSet.has(OWNER_SELECTION_ID)}
                  onChange={() => toggleSelect(OWNER_SELECTION_ID)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="대표 선택"
                  className="cursor-pointer"
                />
              </td>
              <td className="align-middle">
                <span className="ds-status-badge ds-status-badge--action" data-tone="primary" aria-label="대표">
                  대표
                </span>
              </td>
              <td className="align-middle">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <StaffRoleAvatar role="owner" />
                  <span className="text-[15px] font-bold leading-6 text-[var(--color-text-primary)] truncate">
                    {owner!.name}
                  </span>
                </span>
              </td>
              <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate align-middle">
                {owner!.phone || "-"}
              </td>
              <td className="align-middle">
                <span className="ds-status-badge ds-status-badge--action" data-status="active">활성</span>
              </td>
              <td className="align-middle">
                <span className="ds-status-badge ds-status-badge--action" data-status="active">ON</span>
              </td>
              <td className="align-middle">
                <span className="ds-status-badge" data-tone="neutral">-</span>
              </td>
              <td className="align-middle">
                <span className="ds-status-badge" data-tone="neutral">-</span>
              </td>
            </tr>
          )}
          {dataSource.map((r) => (
            <tr
              key={r.id}
              onClick={() => onDetail(r.id)}
              tabIndex={0}
              role="button"
              className={`group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/40 ${selectedSet.has(r.id) ? "ds-row-selected" : ""}`}
            >
              <td onClick={(e) => e.stopPropagation()} style={{ width: COL.checkbox }} className="ds-checkbox-cell align-middle">
                <input
                  type="checkbox"
                  checked={!!selectedSet.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${r.name} 선택`}
                  className="cursor-pointer"
                />
              </td>
              <td className="align-middle">
                <span className="ds-status-badge ds-status-badge--action" data-tone={r.role === "TEACHER" ? "primary" : "neutral"} aria-label={r.role === "TEACHER" ? "강사" : "조교"}>
                  {r.role === "TEACHER" ? "강사" : "조교"}
                </span>
              </td>
              <td className="align-middle">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <StaffRoleAvatar role={r.role} />
                  <span className="text-[15px] font-bold leading-6 text-[var(--color-text-primary)] truncate">
                    {r.name}
                  </span>
                </span>
              </td>
              <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate align-middle">
                {r.phone || "-"}
              </td>
              <td className="align-middle">
                <span className="ds-status-badge ds-status-badge--action" data-status={r.is_active ? "active" : "inactive"}>
                  {r.is_active ? "활성" : "비활성"}
                </span>
              </td>
              <td className="align-middle" onClick={(e) => e.stopPropagation()}>
                {canManage ? (
                  <button
                    type="button"
                    className="ds-status-badge ds-status-badge--action"
                    data-status={r.is_manager ? "active" : "inactive"}
                    disabled={patchManagerM.isPending}
                    onClick={() => patchManagerM.mutate({ staffId: r.id, is_manager: !r.is_manager })}
                    aria-label={r.is_manager ? "관리자 해제" : "관리자 부여"}
                  >
                    {patchManagerM.isPending ? "…" : r.is_manager ? "ON" : "OFF"}
                  </button>
                ) : (
                  <span className="ds-status-badge ds-status-badge--action" data-status={r.is_manager ? "active" : "inactive"}>
                    {r.is_manager ? "ON" : "OFF"}
                  </span>
                )}
              </td>
              <td className="align-middle" onClick={(e) => e.stopPropagation()}>
                {!canManage ? (
                  <span className="ds-status-badge" data-tone="neutral">
                    {r.pay_type === "HOURLY" ? "시급" : "월급"}
                  </span>
                ) : (
                  <span className="inline-flex gap-1">
                    <button
                      type="button"
                      className="ds-status-badge ds-status-badge--action"
                      data-status={r.pay_type === "HOURLY" ? "active" : "inactive"}
                      disabled={patchPayTypeM.isPending}
                      onClick={() => {
                        if (r.pay_type === "HOURLY") return;
                        patchPayTypeM.mutate({ staffId: r.id, pay_type: "HOURLY" });
                      }}
                      aria-label={`${r.name} 시급`}
                    >
                      {patchPayTypeM.isPending ? "…" : "시급"}
                    </button>
                    <button
                      type="button"
                      className="ds-status-badge ds-status-badge--action"
                      data-status={r.pay_type === "MONTHLY" ? "active" : "inactive"}
                      disabled={patchPayTypeM.isPending}
                      onClick={() => {
                        if (r.pay_type === "MONTHLY") return;
                        patchPayTypeM.mutate({ staffId: r.id, pay_type: "MONTHLY" });
                      }}
                      aria-label={`${r.name} 월급`}
                    >
                      {patchPayTypeM.isPending ? "…" : "월급"}
                    </button>
                  </span>
                )}
              </td>
              <td className="align-middle relative" onClick={(e) => e.stopPropagation()}>
                <div
                  className="inline-flex items-center gap-1.5 flex-wrap min-w-0 relative"
                  ref={openAddForStaffId === r.id ? addDropdownRef : undefined}
                >
                  <WorkTypeTags workTypes={r.staff_work_types} />
                  {canManage && (
                    <>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center w-7 h-7 rounded border border-[var(--color-border-divider)] bg-[var(--bg-surface-soft)] text-[var(--color-text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--color-border-strong)] transition-colors"
                        onClick={() => setOpenAddForStaffId((prev) => (prev === r.id ? null : r.id))}
                        aria-label={`${r.name} 시급태그 추가`}
                        disabled={addTagM.isPending}
                      >
                        <Plus size={14} strokeWidth={2.5} />
                      </button>
                      {openAddForStaffId === r.id && (
                        <div className="absolute z-10 left-0 bottom-full mb-1 py-1 min-w-[180px] max-h-[280px] overflow-y-auto rounded-md border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] shadow-lg">
                          {allWorkTypes.filter(
                            (wt) => !(r.staff_work_types || []).some((swt) => swt.work_type?.id === wt.id)
                          ).length === 0 ? (
                            <div className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">
                              추가할 시급태그가 없습니다.
                            </div>
                          ) : (
                            allWorkTypes
                              .filter((wt) => !(r.staff_work_types || []).some((swt) => swt.work_type?.id === wt.id))
                              .map((wt) => (
                                <WorkTypeOption
                                  key={wt.id}
                                  wt={wt}
                                  onSelect={() => addTagM.mutate({ staffId: r.id, work_type_id: wt.id })}
                                  disabled={addTagM.isPending}
                                />
                              ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </DomainTable>
    </div>
  );
}
