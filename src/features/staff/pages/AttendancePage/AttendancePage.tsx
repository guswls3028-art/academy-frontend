// PATH: src/features/staff/pages/AttendancePage/AttendancePage.tsx
// Premium 2-panel: left = staff list, right = header + calendar + daily records + payroll summary

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import { WorkMonthProvider } from "../../operations/context/WorkMonthContext";
import StaffOperationTable from "../OperationsPage/StaffOperationTable";
import WorkRecordsPanel from "../OperationsPage/WorkRecordsPanel";
import { AttendanceCalendar } from "../../components/AttendanceCalendar";
import { PayrollSummaryCard } from "../../components/PayrollSummaryCard";
import { useWorkRecords } from "../../hooks/useWorkRecords";
import { useWorkMonth } from "../../operations/context/WorkMonthContext";
import { useStaffs } from "../../hooks/useStaffs";
import { useQuery } from "@tanstack/react-query";
import { fetchStaffSummaryByRange } from "../../api/staff.detail.api";
import { Button } from "@/shared/ui/ds";
import "../../styles/staff-area.css";

function getThisMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function ymLabel(y: number, m: number) {
  return `${y}년 ${m}월`;
}

function RightPanelContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { staffId, year, month, range } = useWorkMonth();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const goMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta);
    const nextY = d.getFullYear();
    const nextM = d.getMonth() + 1;
    const next = new URLSearchParams(searchParams);
    next.set("staffId", String(staffId));
    next.set("year", String(nextY));
    next.set("month", String(nextM));
    setSearchParams(next);
  };

  const { listQ } = useWorkRecords({
    staff: staffId,
    date_from: range.from,
    date_to: range.to,
  });
  const records = listQ.data ?? [];

  const summaryQ = useQuery({
    queryKey: ["staff-summary", staffId, range.from, range.to],
    queryFn: () => fetchStaffSummaryByRange(staffId, range.from, range.to),
    enabled: !!staffId,
  });
  const summary = summaryQ.data;

  const { data: staffData } = useStaffs();
  const staffs = staffData?.staffs ?? [];
  const staff = staffs.find((s) => s.id === staffId);

  const workHours = summary ? Number(summary.work_hours) || 0 : 0;
  const basePay = summary ? Number(summary.work_amount) || 0 : 0;
  const allowance = summary ? Number(summary.expense_amount) || 0 : 0;
  const gross = basePay + allowance;
  const tax = Math.floor(gross * 0.033);
  const net = gross - tax;

  return (
    <div className="flex flex-col gap-6">
      {/* Header: month selector + summary chips */}
      <div className="staff-panel__header flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {staff && <span className="staff-page-title text-base mr-2">{staff.name}</span>}
          <div className="flex items-center gap-1">
            <Button
              intent="ghost"
              size="sm"
              aria-label="이전 달"
              onClick={() => goMonth(-1)}
            >
              <ChevronLeft size={18} />
            </Button>
            <span className="staff-page-title min-w-[100px]">{ymLabel(year, month)}</span>
            <Button
              intent="ghost"
              size="sm"
              aria-label="다음 달"
              onClick={() => goMonth(1)}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
          {staff && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="ds-status-badge ds-status-badge--action" data-tone={staff.role === "TEACHER" ? "primary" : "neutral"}>
                {staff.role === "TEACHER" ? "강사" : "조교"}
              </span>
              {(staff.staff_work_types ?? []).slice(0, 2).map((swt) => (
                <span
                  key={swt.id}
                  className="staff-wage-badge staff-wage-badge--dark"
                  style={{ backgroundColor: swt.work_type?.color || "#6b7280" }}
                >
                  {swt.work_type?.name} {(swt.effective_hourly_wage / 10000).toFixed(1)}만
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="staff-chip">총 {workHours.toFixed(1)}h</span>
          <span className="staff-chip staff-chip--primary">기본급 {basePay.toLocaleString()}원</span>
          <span className="staff-chip">수당 {allowance.toLocaleString()}원</span>
          <span className="staff-chip staff-chip--success">실지급 {net.toLocaleString()}원</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Calendar */}
          <div className="staff-panel">
            <div className="staff-panel__header">
              <span className="staff-section-title">월별 근무 현황</span>
            </div>
            <div className="staff-panel__body">
              <AttendanceCalendar
                year={year}
                month={month}
                records={records}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </div>
          </div>

          {/* Daily work records */}
          <WorkRecordsPanel />
        </div>

        <div className="space-y-6">
          <PayrollSummaryCard />
        </div>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const [params] = useSearchParams();
  const staffId = Number(params.get("staffId"));
  const yearParam = params.get("year");
  const monthParam = params.get("month");
  const initialYm = useMemo(getThisMonth, []);
  const year = yearParam ? Number(yearParam) : initialYm.year;
  const month = monthParam ? Number(monthParam) : initialYm.month;

  return (
    <div className="grid grid-cols-[300px_1fr] gap-6 min-h-0" data-no-internal-header>
      {/* LEFT: Staff list */}
      <div className="staff-panel flex flex-col min-h-0">
        <div className="staff-panel__header">
          <div className="staff-page-title">직원 선택</div>
          <p className="staff-helper mt-1">선택한 직원의 근태·급여를 조회합니다.</p>
        </div>
        <div className="staff-panel__body overflow-y-auto min-h-0">
          <StaffOperationTable selectedStaffId={staffId} basePath="attendance" />
        </div>
      </div>

      {/* RIGHT: Detail */}
      <div className="staff-panel min-h-[420px] flex flex-col overflow-hidden">
        {!staffId ? (
          <div className="staff-empty flex-1">
            <User className="staff-empty__icon" strokeWidth={1.5} />
            <p className="staff-empty__title">직원이 선택되지 않았습니다</p>
            <p className="staff-empty__desc">좌측 목록에서 직원을 선택하면 근무 기록과 급여 요약을 볼 수 있습니다.</p>
          </div>
        ) : (
          <WorkMonthProvider staffId={staffId} year={year} month={month}>
            <div className="staff-panel__body overflow-y-auto flex-1">
              <RightPanelContent />
            </div>
          </WorkMonthProvider>
        )}
      </div>
    </div>
  );
}
