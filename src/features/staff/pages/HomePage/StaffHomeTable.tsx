// PATH: src/features/staff/pages/HomePage/StaffHomeTable.tsx
// Design: docs/DESIGN_SSOT.md — staff 도메인: 대표(원장) / 강사 / 조교 통일

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { EmptyState } from "@/shared/ui/ds";
import { DomainTable, TABLE_COL, ResizableTh, useTableColumnPrefs } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";
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

const STAFF_HOME_COLUMN_DEFS: TableColumnDef[] = [
  { key: "role", label: "직위", defaultWidth: COL.role, minWidth: 50 },
  { key: "name", label: "이름", defaultWidth: COL.name, minWidth: 80 },
  { key: "phone", label: "전화번호", defaultWidth: COL.phone, minWidth: 90 },
  { key: "status", label: "상태", defaultWidth: COL.status, minWidth: 50 },
  { key: "manager", label: "관리자권한", defaultWidth: COL.manager, minWidth: 60 },
  { key: "payType", label: "급여유형", defaultWidth: COL.payType, minWidth: 80 },
  { key: "workTypeTags", label: "시급태그", defaultWidth: COL.workTypeTags, minWidth: 120 },
];

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
  const [sort, setSort] = useState("");
  const { columnWidths, setColumnWidth } = useTableColumnPrefs("staff-home", STAFF_HOME_COLUMN_DEFS);
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

  const sortedDataSource = useMemo(() => {
    if (!sort) return dataSource;
    const key = sort.startsWith("-") ? sort.slice(1) : sort;
    const asc = !sort.startsWith("-");
    return [...dataSource].sort((a, b) => {
      let aVal: string | number = (a as Record<string, unknown>)[key] ?? "";
      let bVal: string | number = (b as Record<string, unknown>)[key] ?? "";
      if (key === "name") {
        aVal = a.name ?? "";
        bVal = b.name ?? "";
      } else if (key === "phone") {
        aVal = a.phone ?? "";
        bVal = b.phone ?? "";
      } else if (key === "status") {
        aVal = a.is_active ? 1 : 0;
        bVal = b.is_active ? 1 : 0;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return asc ? aVal.localeCompare(String(bVal), "ko") : -aVal.localeCompare(String(bVal), "ko");
      }
      return asc ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });
  }, [dataSource, sort]);

  const handleSort = useCallback((colKey: string) => {
    setSort((prev) => (prev === colKey ? `-${colKey}` : prev === `-${colKey}` ? "" : colKey));
  }, []);

  const tableWidth =
    COL.checkbox +
    (columnWidths.role ?? COL.role) +
    (columnWidths.name ?? COL.name) +
    (columnWidths.phone ?? COL.phone) +
    (columnWidths.status ?? COL.status) +
    (columnWidths.manager ?? COL.manager) +
    (columnWidths.payType ?? COL.payType) +
    (columnWidths.workTypeTags ?? COL.workTypeTags);

  function SortableTh({ colKey, label, widthKey, width }: { colKey: string; label: string; widthKey: string; width: number }) {
    const isAsc = sort === colKey;
    const isDesc = sort === `-${colKey}`;
    return (
      <ResizableTh
        columnKey={widthKey}
        width={width}
        minWidth={40}
        maxWidth={600}
        onWidthChange={setColumnWidth}
        onClick={() => handleSort(colKey)}
        aria-sort={isAsc ? "ascending" : isDesc ? "descending" : "none"}
        className="cursor-pointer select-none"
      >
        <span className="inline-flex items-center justify-center gap-2">
          {label}
          <span aria-hidden style={{ fontSize: 11, opacity: isAsc || isDesc ? 1 : 0.35, color: "var(--color-primary)" }}>
            {isAsc ? "▲" : isDesc ? "▼" : "⇅"}
          </span>
        </span>
      </ResizableTh>
    );
  }

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
        tableStyle={{ tableLayout: "fixed", width: tableWidth }}
      >
        <colgroup>
          <col style={{ width: COL.checkbox }} />
          <col style={{ width: columnWidths.role ?? COL.role }} />
          <col style={{ width: columnWidths.name ?? COL.name }} />
          <col style={{ width: columnWidths.phone ?? COL.phone }} />
          <col style={{ width: columnWidths.status ?? COL.status }} />
          <col style={{ width: columnWidths.manager ?? COL.manager }} />
          <col style={{ width: columnWidths.payType ?? COL.payType }} />
          <col style={{ width: columnWidths.workTypeTags ?? COL.workTypeTags }} />
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
            <SortableTh colKey="role" label="직위" widthKey="role" width={columnWidths.role ?? COL.role} />
            <SortableTh colKey="name" label="이름" widthKey="name" width={columnWidths.name ?? COL.name} />
            <SortableTh colKey="phone" label="전화번호" widthKey="phone" width={columnWidths.phone ?? COL.phone} />
            <SortableTh colKey="status" label="상태" widthKey="status" width={columnWidths.status ?? COL.status} />
            <SortableTh colKey="manager" label="관리자권한" widthKey="manager" width={columnWidths.manager ?? COL.manager} />
            <SortableTh colKey="payType" label="급여유형" widthKey="payType" width={columnWidths.payType ?? COL.payType} />
            <SortableTh colKey="workTypeTags" label="시급태그" widthKey="workTypeTags" width={columnWidths.workTypeTags ?? COL.workTypeTags} />
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
          {sortedDataSource.map((r) => (
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
