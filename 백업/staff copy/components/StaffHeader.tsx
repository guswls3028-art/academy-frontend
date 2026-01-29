// PATH: src/features/staff/components/StaffHeader.tsx
import { PageToolbar } from "@/shared/ui/page";
import { StaffFilters } from "../hooks/useStaffDomain";

export default function StaffHeader({
  rangeLabel,
  filters,
  setFilters,
  onRefresh,
  onCreate,
}: {
  rangeLabel: string;
  filters: StaffFilters;
  setFilters: (next: StaffFilters) => void;
  onRefresh: () => void;
  onCreate: () => void;
}) {
  return (
    <PageToolbar>
      <div className="flex flex-wrap items-end justify-between gap-4">
        {/* Left: filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs font-medium text-[var(--text-muted)]">검색</div>
            <input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="h-[38px] w-[220px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm outline-none focus:border-[var(--color-primary)]"
              placeholder="이름/전화번호"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-[var(--text-muted)]">상태</div>
            <select
              value={filters.is_active}
              onChange={(e) =>
                setFilters({ ...filters, is_active: e.target.value as any })
              }
              className="h-[38px] w-[130px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm outline-none focus:border-[var(--color-primary)]"
            >
              <option value="ALL">전체</option>
              <option value="ACTIVE">활성</option>
              <option value="INACTIVE">비활성</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-[var(--text-muted)]">역할</div>
            <select
              value={filters.is_manager}
              onChange={(e) =>
                setFilters({ ...filters, is_manager: e.target.value as any })
              }
              className="h-[38px] w-[130px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm outline-none focus:border-[var(--color-primary)]"
            >
              <option value="ALL">전체</option>
              <option value="MANAGER">관리자</option>
              <option value="STAFF">직원</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-[var(--text-muted)]">급여</div>
            <select
              value={filters.pay_type}
              onChange={(e) =>
                setFilters({ ...filters, pay_type: e.target.value as any })
              }
              className="h-[38px] w-[130px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm outline-none focus:border-[var(--color-primary)]"
            >
              <option value="ALL">전체</option>
              <option value="HOURLY">시급</option>
              <option value="MONTHLY">월급</option>
            </select>
          </div>

          <div className="pb-[2px] text-xs text-[var(--text-muted)]">
            {rangeLabel}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="h-[38px] px-4 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-sm font-semibold hover:bg-[var(--bg-surface-soft)]"
          >
            새로고침
          </button>

          <button onClick={onCreate} className="btn-primary">
            + 직원 등록
          </button>
        </div>
      </div>
    </PageToolbar>
  );
}
