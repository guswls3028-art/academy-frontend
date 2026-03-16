// PATH: src/features/staff/pages/OperationsPage/StaffOperationTable.tsx
// Design: docs/DESIGN_SSOT.md — Staff list: avatar + name only. Detail is in workspace header/tabs.

import { useMemo, useState } from "react";
import { useStaffs } from "../../hooks/useStaffs";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Staff } from "../../api/staff.api";
import { EmptyState } from "@/shared/ui/ds";
import { StaffRoleAvatar } from "@/shared/ui/avatars";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/** basePath: 해당 탭 경로 (attendance | expenses | month-lock 등) */
export default function StaffOperationTable({
  selectedStaffId,
  basePath = "operations",
  year,
  month,
}: {
  selectedStaffId?: number;
  basePath?: "operations" | "attendance" | "expenses" | "month-lock" | "reports" | "payroll-snapshot";
  year?: number;
  month?: number;
}) {
  const { data, isLoading } = useStaffs();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");

  /** 작업 콘솔은 Staff만 대상(원장 제외) */
  const staffs: Staff[] = Array.isArray(data?.staffs) ? data!.staffs : [];

  // ✅ UX: 검색은 “필터링(선택)”이며 계산/추론이 아님
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return staffs;

    return staffs.filter((s) => {
      const name = (s.name ?? "").toLowerCase();
      const phone = (s.phone ?? "").toLowerCase();
      return name.includes(needle) || phone.includes(needle);
    });
  }, [staffs, q]);

  // ✅ 직급순 정렬(강사 → 조교), 동일 직급 시 이름순
  const roleOrder = { TEACHER: 0, ASSISTANT: 1 } as const;
  const byRoleThenName = (a: Staff, b: Staff) => {
    const r = (roleOrder[a.role] ?? 1) - (roleOrder[b.role] ?? 1);
    return r !== 0 ? r : (a.name || "").localeCompare(b.name || "", "ko");
  };

  const active = useMemo(
    () => filtered.filter((s) => s.is_active).sort(byRoleThenName),
    [filtered]
  );
  const inactive = useMemo(
    () => filtered.filter((s) => !s.is_active).sort(byRoleThenName),
    [filtered]
  );

  const pick = (id: number) => {
    const next = new URLSearchParams(params);
    next.set("staffId", String(id));
    const now = new Date();
    if (!next.has("year")) next.set("year", String(now.getFullYear()));
    if (!next.has("month")) next.set("month", String(now.getMonth() + 1));
    navigate(`/admin/staff/${basePath}?${next.toString()}`);
  };

  return (
    <div className="space-y-3">
      <input
        type="search"
        className="ds-input w-full"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="이름/전화번호 검색"
        aria-label="직원 검색"
      />

      {isLoading && (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      )}

      {!isLoading && staffs.length === 0 && (
        <EmptyState
          scope="panel"
          tone="empty"
          title="직원 없음"
          description="직원이 등록되어야 작업 콘솔을 사용할 수 있습니다."
        />
      )}

      {!isLoading && staffs.length > 0 && filtered.length === 0 && (
        <EmptyState
          scope="panel"
          tone="empty"
          title="검색 결과 없음"
          description="이름 또는 전화번호로 다시 검색해보세요."
        />
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="space-y-4">
          <Section title={`활성 (${active.length})`} emptyText="활성 직원이 없습니다.">
            {active.map((s) => (
              <Row
                key={s.id}
                staff={s}
                selected={s.id === selectedStaffId}
                onClick={() => pick(s.id)}
              />
            ))}
          </Section>

          <Section title={`비활성 (${inactive.length})`} emptyText="비활성 직원이 없습니다.">
            {inactive.map((s) => (
              <Row
                key={s.id}
                staff={s}
                selected={s.id === selectedStaffId}
                onClick={() => pick(s.id)}
              />
            ))}
          </Section>
        </div>
      )}

      <p className="staff-helper mt-3">
        선택된 직원이 우측 패널에 반영됩니다.
      </p>
    </div>
  );
}

function Section({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const hasItems = !!children && Array.isArray(children) ? children.length > 0 : true;

  return (
    <div className="space-y-1.5">
      <div className="staff-section-title px-0.5">{title}</div>
      {!hasItems ? (
        <div className="rounded-lg bg-[var(--color-bg-surface-soft)] px-3 py-2.5 text-sm text-[var(--color-text-muted)]">
          {emptyText}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border-divider)] overflow-hidden bg-[var(--color-bg-surface)]">
          {children}
        </div>
      )}
    </div>
  );
}

function Row({
  staff,
  selected,
  onClick,
}: {
  staff: Staff;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "staff-list-item staff-list-item--compact flex items-center gap-3 min-w-0",
        selected && "staff-list-item--selected",
        !staff.is_active && "staff-list-item--inactive"
      )}
    >
      <StaffRoleAvatar role={staff.role} size={32} className="shrink-0 text-[var(--color-text-secondary)]" />
      <span className="staff-list-item__name flex-1 truncate text-left font-medium text-[var(--color-text-primary)]">
        {staff.name}
      </span>
    </button>
  );
}
