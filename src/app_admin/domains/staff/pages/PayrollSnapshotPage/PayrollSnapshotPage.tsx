// PATH: src/app_admin/domains/staff/pages/PayrollSnapshotPage/PayrollSnapshotPage.tsx
// Payroll snapshot tab: selected staff's finalized monthly payroll. Layout is in StaffWorkspace.

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchPayrollSnapshots,
  type PayrollSnapshot,
} from "../../api/payrollSnapshots.api";
import { exportPayrollSnapshotPDF } from "../../api/payrollSnapshotPdf.api";
import { Button } from "@/shared/ui/ds";

const TAX_RATE = 0.033;

function getThisMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function ymLabel(y: number, m: number) {
  return `${y}년 ${m}월`;
}

export default function PayrollSnapshotPage() {
  const [params] = useSearchParams();
  const staffId = params.get("staffId") ? Number(params.get("staffId")) : null;
  const initialYm = useMemo(getThisMonth, []);
  const year = params.get("year") ? Number(params.get("year")) : initialYm.year;
  const month = params.get("month") ? Number(params.get("month")) : initialYm.month;
  const [exportingPdf, setExportingPdf] = useState(false);

  const listQ = useQuery({
    queryKey: ["payroll-snapshots", year, month, staffId],
    queryFn: () => fetchPayrollSnapshots({ year, month, staff: staffId ?? undefined }),
    enabled: staffId != null,
  });

  const snap = useMemo((): PayrollSnapshot | null => {
    const list = listQ.data ?? [];
    if (staffId == null) return null;
    return list.find((s) => s.staff === staffId) ?? null;
  }, [listQ.data, staffId]);

  const handlePdf = async () => {
    if (staffId == null || exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportPayrollSnapshotPDF({ staff: staffId, year, month });
    } finally {
      setExportingPdf(false);
    }
  };

  if (staffId == null) return null;
  if (listQ.isLoading) {
    return (
      <div className="staff-panel">
        <div className="staff-panel__body">
          <p className="staff-helper">불러오는 중…</p>
        </div>
      </div>
    );
  }

  if (snap == null) {
    return (
      <div className="staff-panel">
        <div className="staff-panel__header">
          <span className="staff-section-title">급여 스냅샷 · {ymLabel(year, month)}</span>
        </div>
        <div className="staff-panel__body">
          <p className="staff-helper">해당 월은 아직 마감되지 않았거나 스냅샷이 없습니다. 월 마감 탭에서 마감 후 확인하세요.</p>
        </div>
      </div>
    );
  }

  const tax = Math.floor(snap.total_amount * TAX_RATE);
  const net = snap.total_amount - tax;

  return (
    <div className="staff-panel">
      <div className="staff-panel__header flex flex-wrap items-center justify-between gap-4">
        <span className="staff-section-title">확정 급여 · {ymLabel(snap.year, snap.month)}</span>
        <Button intent="secondary" size="sm" disabled={exportingPdf} onClick={handlePdf}>
          {exportingPdf ? "다운로드 중…" : "PDF 명세"}
        </Button>
      </div>
      <div className="staff-panel__body space-y-4">
        <div className="staff-payroll-card rounded-lg border border-[var(--color-border-divider)] overflow-hidden">
          <div className="staff-payroll-card__body">
            <div className="staff-payroll-row">
              <span className="label">총 근무시간</span>
              <span className="value">{Number(snap.work_hours)} h</span>
            </div>
            <div className="staff-payroll-row">
              <span className="label">기본급</span>
              <span className="value">{snap.work_amount.toLocaleString()}원</span>
            </div>
            <div className="staff-payroll-row">
              <span className="label">승인 경비</span>
              <span className="value">{snap.approved_expense_amount.toLocaleString()}원</span>
            </div>
            <div className="staff-payroll-row">
              <span className="label">총 지급액</span>
              <span className="value">{snap.total_amount.toLocaleString()}원</span>
            </div>
            <div className="staff-payroll-row">
              <span className="label">세금(3.3%)</span>
              <span className="value">-{tax.toLocaleString()}원</span>
            </div>
            <div className="staff-payroll-row staff-payroll-row--total">
              <span className="label">실지급액</span>
              <span className="value">{net.toLocaleString()}원</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">
          확정일시: {snap.created_at ? new Date(snap.created_at).toLocaleString("ko-KR") : "-"}
          {snap.generated_by_name && ` · 확정자: ${snap.generated_by_name}`}
        </div>
      </div>
    </div>
  );
}
