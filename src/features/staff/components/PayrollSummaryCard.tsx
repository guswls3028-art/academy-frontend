// PATH: src/features/staff/components/PayrollSummaryCard.tsx
// Premium payroll summary: 총 근무시간, 기본급, 수당, 총 지급액, 세금(3.3%), 실지급액

import { useQuery } from "@tanstack/react-query";
import { fetchStaffSummaryByRange } from "../api/staff.detail.api";
import { useWorkMonth } from "../operations/context/WorkMonthContext";
import "../styles/staff-area.css";

const TAX_RATE = 0.033;

export function PayrollSummaryCard() {
  const { staffId, range } = useWorkMonth();

  const summaryQ = useQuery({
    queryKey: ["staff-summary", staffId, range.from, range.to],
    queryFn: () => fetchStaffSummaryByRange(staffId, range.from, range.to),
    enabled: !!staffId && !!range.from && !!range.to,
  });

  const s = summaryQ.data;
  if (summaryQ.isLoading || !s) {
    return (
      <div className="staff-area staff-payroll-card">
        <div className="staff-payroll-card__title">급여 요약</div>
        <div className="staff-payroll-card__body">
          <p className="staff-helper">불러오는 중…</p>
        </div>
      </div>
    );
  }

  const workHours = Number(s.work_hours) || 0;
  const baseWage = Number(s.work_amount) || 0;
  const allowance = Number(s.expense_amount) || 0;
  const grossPay = baseWage + allowance;
  const tax = Math.floor(grossPay * TAX_RATE);
  const netPay = grossPay - tax;

  return (
    <div className="staff-area staff-payroll-card">
      <div className="staff-payroll-card__title">급여 요약</div>
      <div className="staff-payroll-card__body">
        <div className="staff-payroll-row">
          <span className="label">총 근무시간</span>
          <span className="value">{workHours.toFixed(1)} h</span>
        </div>
        <div className="staff-payroll-row">
          <span className="label">기본급</span>
          <span className="value">{baseWage.toLocaleString()}원</span>
        </div>
        <div className="staff-payroll-row">
          <span className="label">수당 · 경비</span>
          <span className="value">{allowance.toLocaleString()}원</span>
        </div>
        <div className="staff-payroll-row">
          <span className="label">총 지급액</span>
          <span className="value">{grossPay.toLocaleString()}원</span>
        </div>
        <div className="staff-payroll-row">
          <span className="label">세금(3.3%)</span>
          <span className="value">-{tax.toLocaleString()}원</span>
        </div>
        <div className="staff-payroll-row staff-payroll-row--total">
          <span className="label">실지급액</span>
          <span className="value">{netPay.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  );
}
