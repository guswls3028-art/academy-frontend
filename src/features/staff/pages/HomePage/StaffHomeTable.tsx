// PATH: src/features/staff/pages/HomePage/StaffHomeTable.tsx
// Design: docs/DESIGN_SSOT.md — staff 도메인: 대표(원장) / 강사 / 조교 통일

import { useMemo, useState } from "react";
import { Crown, GraduationCap, UserCog } from "lucide-react";
import { EmptyState } from "@/shared/ui/ds";
import { DomainTable, TABLE_COL } from "@/shared/ui/domain";
import { Staff, type StaffListOwner } from "../../api/staff.api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patchStaffDetail } from "../../api/staff.detail.api";

/** 직원 목록 선택 시 원장 행용 sentinel id (삭제 제외) */
export const OWNER_SELECTION_ID = -1;

/** 대표/강사/조교 아바타 — 아이콘만 (이름 컬럼 내 아이콘+이름) */
function StaffRoleAvatar({ role }: { role: "owner" | "TEACHER" | "ASSISTANT" }) {
  const size = 24;
  const className = "shrink-0 text-[var(--color-text-secondary)]";
  if (role === "owner") return <Crown size={size} className={className} aria-label="대표" />;
  if (role === "TEACHER") return <GraduationCap size={size} className={className} aria-label="강사" />;
  return <UserCog size={size} className={className} aria-label="조교" />;
}

/** 시급태그 — 학생 태그 디자인 카피 (이름 + 색상 뱃지) */
function WorkTypeTags({ workTypes }: { workTypes: Staff["staff_work_types"] }) {
  const list = Array.isArray(workTypes) ? workTypes : [];
  const LIGHT_COLORS = ["#eab308", "#06b6d4"];
  const isLight = (c: string) => LIGHT_COLORS.some((x) => String(c || "").toLowerCase() === x);

  if (list.length === 0) return <span className="text-[var(--color-text-muted)]">-</span>;

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
            className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[11px] font-semibold truncate max-w-[72px]"
            style={{
              backgroundColor: color,
              color: isLight(color) ? "#1a1a1a" : "#fff",
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
  role: TABLE_COL.status,
  name: TABLE_COL.nameCompact,
  phone: TABLE_COL.phone,
  status: TABLE_COL.statusBadge,
  manager: TABLE_COL.statusBadge,
  payType: TABLE_COL.medium,
  workTypeTags: 180,
  actions: 120,
} as const;

const TABLE_WIDTH =
  COL.checkbox +
  COL.role +
  COL.name +
  COL.phone +
  COL.status +
  COL.manager +
  COL.payType +
  COL.workTypeTags +
  COL.actions;

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
  const allIds = useMemo(() => dataSource.map((r) => r.id), [dataSource]);
  const allSelected =
    dataSource.length > 0 && allIds.every((id) => selectedSet.has(id));

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
          <col style={{ width: COL.actions }} />
        </colgroup>

        <thead>
          <tr>
            <th scope="col" style={{ width: COL.checkbox }} className="ds-checkbox-cell" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={allSelected}
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
            <th scope="col">관리</th>
          </tr>
        </thead>

        <tbody>
          {hasOwner && (
            <tr className="bg-[var(--color-bg-surface-hover)]/60" aria-label="원장">
              <td onClick={(e) => e.stopPropagation()} style={{ width: COL.checkbox }} className="ds-checkbox-cell align-middle">
                <input type="checkbox" disabled aria-label="원장 선택 불가" className="cursor-not-allowed opacity-60" />
              </td>
              <td className="align-middle">
                <span className="ds-status-badge" data-tone="primary" aria-label="원장">
                  원장
                </span>
              </td>
              <td className="text-[15px] font-bold leading-6 text-[var(--color-text-primary)] truncate align-middle">
                {owner!.name}
              </td>
              <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate align-middle">
                {owner!.phone || "-"}
              </td>
              <td className="align-middle">
                <span className="ds-status-badge" data-status="active">활성</span>
              </td>
              <td className="align-middle">
                <span className="ds-status-badge" data-status="active">ON</span>
              </td>
              <td className="text-[14px] leading-6 text-[var(--color-text-muted)] align-middle">-</td>
              <td className="align-middle">
                <span className="text-[var(--color-text-muted)]">-</span>
              </td>
              <td className="text-[14px] leading-6 text-[var(--color-text-muted)] align-middle">-</td>
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
                  checked={selectedSet.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${r.name} 선택`}
                  className="cursor-pointer"
                />
              </td>
              <td className="align-middle">
                <span className="ds-status-badge" data-tone={r.role === "TEACHER" ? "primary" : "neutral"} aria-label={r.role === "TEACHER" ? "강사" : "조교"}>
                  {r.role === "TEACHER" ? "강사" : "조교"}
                </span>
              </td>
              <td className="text-[15px] font-bold leading-6 text-[var(--color-text-primary)] truncate align-middle">
                {r.name}
              </td>
              <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate align-middle">
                {r.phone || "-"}
              </td>
              <td className="align-middle">
                <span className="ds-status-badge" data-status={r.is_active ? "active" : "inactive"}>
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
                  <span className="ds-status-badge" data-status={r.is_manager ? "active" : "inactive"}>
                    {r.is_manager ? "ON" : "OFF"}
                  </span>
                )}
              </td>
              <td className="align-middle" onClick={(e) => e.stopPropagation()}>
                {!canManage ? (
                  <span className="text-[14px] text-[var(--color-text-secondary)]">
                    {r.pay_type === "HOURLY" ? "시급" : "월급"}
                  </span>
                ) : (
                  <span className="inline-flex rounded-md border border-[var(--border-divider)] p-0.5 bg-[var(--bg-surface-soft)]">
                    <button
                      type="button"
                      disabled={patchPayTypeM.isPending}
                      onClick={() => {
                        if (r.pay_type === "HOURLY") return;
                        patchPayTypeM.mutate({ staffId: r.id, pay_type: "HOURLY" });
                      }}
                      aria-label={`${r.name} 시급`}
                      className={[
                        "px-2.5 py-1 text-[12px] font-semibold rounded transition-colors",
                        r.pay_type === "HOURLY"
                          ? "bg-[var(--color-brand-primary)] text-[var(--color-text-inverse)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--bg-surface)]",
                      ].join(" ")}
                    >
                      시급
                    </button>
                    <button
                      type="button"
                      disabled={patchPayTypeM.isPending}
                      onClick={() => {
                        if (r.pay_type === "MONTHLY") return;
                        patchPayTypeM.mutate({ staffId: r.id, pay_type: "MONTHLY" });
                      }}
                      aria-label={`${r.name} 월급`}
                      className={[
                        "px-2.5 py-1 text-[12px] font-semibold rounded transition-colors",
                        r.pay_type === "MONTHLY"
                          ? "bg-[var(--color-brand-primary)] text-[var(--color-text-inverse)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--bg-surface)]",
                      ].join(" ")}
                    >
                      월급
                    </button>
                  </span>
                )}
              </td>
              <td className="align-middle">
                <WorkTypeTags workTypes={r.staff_work_types} />
              </td>
              <td className="align-middle" onClick={(e) => e.stopPropagation()}>
                <span className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => onOperate(r.id)}
                    className="text-[13px] font-semibold text-[var(--color-brand-primary)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                  >
                    작업
                  </button>
                  <button
                    type="button"
                    onClick={() => onDetail(r.id)}
                    className="text-[13px] font-semibold text-[var(--color-text-secondary)] hover:underline"
                  >
                    상세
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </DomainTable>
    </div>
  );
}
