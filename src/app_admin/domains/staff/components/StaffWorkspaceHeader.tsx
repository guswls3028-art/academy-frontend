// PATH: src/app_admin/domains/staff/components/StaffWorkspaceHeader.tsx
// Persistent header when a staff is selected: name, role, pay type, wage tag, month selector, KPI chips

import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStaffs } from "../hooks/useStaffs";
import { useQuery } from "@tanstack/react-query";
import { fetchStaffSummaryByRange } from "../api/staff.detail.api";
import { Button, Badge } from "@/shared/ui/ds";
import { staffQueryKeys } from "../queryKeys";
import {
  staffAccountRoleLabel,
  staffPositionLabel,
} from "../utils/staffIdentity";

function ymLabel(y: number, m: number) {
  return `${y}년 ${m}월`;
}

function monthRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

type Props = {
  staffId: number;
  year: number;
  month: number;
};

export function StaffWorkspaceHeader({ staffId, year, month }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: staffData } = useStaffs();
  const staffs = staffData?.staffs ?? [];
  const staff = staffs.find((s) => s.id === staffId);
  const range = monthRange(year, month);

  const summaryQ = useQuery({
    queryKey: staffQueryKeys.summaryRange(staffId, range.from, range.to),
    queryFn: () => fetchStaffSummaryByRange(staffId, range.from, range.to),
    enabled: !!staffId,
  });
  const s = summaryQ.data;

  const workHours = s ? Number(s.work_hours) || 0 : 0;
  const basePay = s ? Number(s.work_amount) || 0 : 0;
  const allowance = s ? Number(s.expense_amount) || 0 : 0;
  const settlementTotal = s ? Number(s.total_amount) || basePay + allowance : 0;
  const isLoading = summaryQ.isLoading;

  const goMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta);
    const next = new URLSearchParams(searchParams);
    next.set("staffId", String(staffId));
    next.set("year", String(d.getFullYear()));
    next.set("month", String(d.getMonth() + 1));
    setSearchParams(next);
  };

  const primaryWageTag = staff?.staff_work_types?.[0];

  return (
    <div className="staff-panel__header flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border-divider)] bg-[color-mix(in_srgb,var(--color-border-divider)_4%,var(--color-bg-surface))]">
      <div className="flex items-center gap-3 flex-wrap">
        {staff && (
          <button
            type="button"
            className="staff-page-title staff-detail-entry text-base font-semibold text-[var(--color-text-primary)]"
            onClick={() => navigate(`/workspace/staff/${staff.id}`, {
              state: { backgroundLocation: location },
            })}
            aria-label={`${staff.name} 직원 상세 열기`}
            title="직원 상세 열기"
          >
            {staff.name}
          </button>
        )}
        {staff && (
          <>
            <Badge
              variant="solid"
              actionable
              tone={staff.position === "DIRECTOR" || staff.position === "INSTRUCTOR" ? "primary" : "neutral"}
            >
              {staffPositionLabel(staff.position, staff.role)}
            </Badge>
            <Badge variant="solid" actionable tone="neutral">
              {staffAccountRoleLabel(staff.account_role, staff.role)}
            </Badge>
            <Badge variant="solid" actionable tone="neutral">
              {staff.pay_type === "HOURLY" ? "시급" : "월급(수동 확인)"}
            </Badge>
            {primaryWageTag && (
              <span
                className="staff-wage-badge staff-wage-badge--dark text-[10px] px-2 py-0.5 rounded font-semibold"
                // eslint-disable-next-line no-restricted-syntax -- work type colors are tenant-configured data.
                style={{ backgroundColor: primaryWageTag.work_type?.color || "#6b7280" }}
              >
                {primaryWageTag.work_type?.name} {(primaryWageTag.effective_hourly_wage / 10000).toFixed(1)}만
              </span>
            )}
          </>
        )}
        <div className="flex items-center gap-0.5">
          <Button intent="ghost" size="sm" iconOnly aria-label="이전 달" onClick={() => goMonth(-1)}>
            <ChevronLeft size={18} />
          </Button>
          <span className="staff-section-title min-w-[88px] text-center">{ymLabel(year, month)}</span>
          <Button intent="ghost" size="sm" iconOnly aria-label="다음 달" onClick={() => goMonth(1)}>
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {isLoading ? (
          <>
            <span className="staff-chip text-xs opacity-60">총 —h</span>
            <span className="staff-chip staff-chip--primary text-xs opacity-60">근무기록 —</span>
            <span className="staff-chip text-xs opacity-60">승인 선결제 환급 —</span>
            <span className="staff-chip staff-chip--success text-xs opacity-60">공제 전 합계 —</span>
          </>
        ) : summaryQ.isError ? (
          <Button intent="secondary" size="sm" onClick={() => summaryQ.refetch()}>
            정산 요약 다시 시도
          </Button>
        ) : (
          <>
            <span className="staff-chip text-xs">총 {workHours.toFixed(1)}h</span>
            <span className="staff-chip staff-chip--primary text-xs">근무기록 {basePay.toLocaleString()}원</span>
            <span className="staff-chip text-xs">승인 선결제 환급 {allowance.toLocaleString()}원</span>
            <span className="staff-chip staff-chip--success text-xs">공제 전 합계 {settlementTotal.toLocaleString()}원</span>
          </>
        )}
      </div>
    </div>
  );
}
