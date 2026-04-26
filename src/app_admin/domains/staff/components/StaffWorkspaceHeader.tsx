// PATH: src/app_admin/domains/staff/components/StaffWorkspaceHeader.tsx
// Persistent header when a staff is selected: name, role, pay type, wage tag, month selector, KPI chips

import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStaffs } from "../hooks/useStaffs";
import { useQuery } from "@tanstack/react-query";
import { fetchStaffSummaryByRange } from "../api/staff.detail.api";
import { Button, Badge } from "@/shared/ui/ds";

const TAX_RATE = 0.033;

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
  const { data: staffData } = useStaffs();
  const staffs = staffData?.staffs ?? [];
  const staff = staffs.find((s) => s.id === staffId);
  const range = monthRange(year, month);

  const summaryQ = useQuery({
    queryKey: ["staff-summary", staffId, range.from, range.to],
    queryFn: () => fetchStaffSummaryByRange(staffId, range.from, range.to),
    enabled: !!staffId,
  });
  const s = summaryQ.data;

  const workHours = s ? Number(s.work_hours) || 0 : 0;
  const basePay = s ? Number(s.work_amount) || 0 : 0;
  const allowance = s ? Number(s.expense_amount) || 0 : 0;
  const gross = basePay + allowance;
  const tax = Math.floor(gross * TAX_RATE);
  const net = gross - tax;
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
        {staff && <span className="staff-page-title text-base font-semibold text-[var(--color-text-primary)]">{staff.name}</span>}
        {staff && (
          <>
            <Badge variant="solid" actionable tone={staff.role === "TEACHER" ? "primary" : "neutral"}>
              {staff.role === "TEACHER" ? "강사" : "조교"}
            </Badge>
            <Badge variant="solid" actionable tone="neutral">
              {staff.pay_type === "HOURLY" ? "시급" : "월급"}
            </Badge>
            {primaryWageTag && (
              <span
                className="staff-wage-badge staff-wage-badge--dark text-[10px] px-2 py-0.5 rounded font-semibold"
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
            <span className="staff-chip staff-chip--primary text-xs opacity-60">기본급 —</span>
            <span className="staff-chip text-xs opacity-60">수당 —</span>
            <span className="staff-chip staff-chip--success text-xs opacity-60">예상 실지급 —</span>
          </>
        ) : (
          <>
            <span className="staff-chip text-xs">총 {workHours.toFixed(1)}h</span>
            <span className="staff-chip staff-chip--primary text-xs">기본급 {basePay.toLocaleString()}원</span>
            <span className="staff-chip text-xs">수당 {allowance.toLocaleString()}원</span>
            <span className="staff-chip staff-chip--success text-xs">예상 실지급 {net.toLocaleString()}원</span>
          </>
        )}
      </div>
    </div>
  );
}
