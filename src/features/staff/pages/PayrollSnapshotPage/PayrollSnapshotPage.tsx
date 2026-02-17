// PATH: src/features/staff/pages/PayrollSnapshotPage/PayrollSnapshotPage.tsx
// 급여 스냅샷: 월별 확정 근무시간·급여·경비 요약
// ※ 직원 열 뱃지/급여형태는 홈(근태) 탭과 동일 SSOT: StaffRoleAvatar, RoleBadge, payLabel

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchPayrollSnapshots,
  exportPayrollSnapshotExcel,
  type PayrollSnapshot,
} from "../../api/payrollSnapshots.api";
import { exportPayrollSnapshotPDF } from "../../api/payrollSnapshotPdf.api";
import { useStaffs } from "../../hooks/useStaffs";
import type { Staff } from "../../api/staff.api";
import { StaffRoleAvatar } from "@/shared/ui/avatars";
import { RoleBadge } from "../../components/StatusBadge";
import ActionButton from "../../components/ActionButton";

function ymLabel(y: number, m: number) {
  return `${y}년 ${m}월`;
}

function payLabel(payType: Staff["pay_type"]) {
  return payType === "HOURLY" ? "시급" : "월급";
}

export default function PayrollSnapshotPage() {
  const now = useMemo(() => new Date(), []);
  const [ym, setYm] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  const { data: staffsData } = useStaffs();
  const staffById = useMemo(() => {
    const list = Array.isArray(staffsData?.staffs) ? staffsData!.staffs : [];
    return new Map(list.map((s) => [s.id, s]));
  }, [staffsData]);

  const listQ = useQuery({
    queryKey: ["payroll-snapshots", ym.year, ym.month],
    queryFn: () => fetchPayrollSnapshots({ year: ym.year, month: ym.month }),
  });

  const rows: PayrollSnapshot[] = useMemo(() => listQ.data ?? [], [listQ.data]);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdfStaffId, setExportingPdfStaffId] = useState<number | null>(null);

  const handleExcel = async () => {
    setExportingExcel(true);
    try {
      await exportPayrollSnapshotExcel({ year: ym.year, month: ym.month });
    } finally {
      setExportingExcel(false);
    }
  };

  const handlePdf = async (staff: number) => {
    setExportingPdfStaffId(staff);
    try {
      await exportPayrollSnapshotPDF({ staff, year: ym.year, month: ym.month });
    } finally {
      setExportingPdfStaffId(null);
    }
  };

  return (
    <>
    <div className="ds-panel-card px-6 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">기준월</div>
            <div className="flex items-center gap-2 mt-2">
              <select
                value={ym.year}
                onChange={(e) => setYm((p) => ({ ...p, year: Number(e.target.value) }))}
                className="ds-input h-9 min-w-[88px]"
                aria-label="연도"
              >
                {[ym.year - 1, ym.year, ym.year + 1].map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select
                value={ym.month}
                onChange={(e) => setYm((p) => ({ ...p, month: Number(e.target.value) }))}
                className="ds-input h-9 min-w-[80px]"
                aria-label="월"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton
              variant="primary"
              size="sm"
              disabled={exportingExcel || rows.length === 0}
              onClick={handleExcel}
            >
              {exportingExcel ? "다운로드 중…" : "엑셀 다운로드"}
            </ActionButton>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-[var(--color-text-muted)]">
          * {ymLabel(ym.year, ym.month)} 월 마감 시 생성된 스냅샷만 표시됩니다.
        </div>
    </div>

      {listQ.isLoading && (
        <div className="ds-panel-card p-8 text-center text-[var(--color-text-muted)]">불러오는 중…</div>
      )}

      {!listQ.isLoading && rows.length === 0 && (
        <div className="ds-panel-card p-8">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">확정 급여 없음</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            해당 월은 아직 마감되지 않았거나 급여 스냅샷이 없습니다. 월 마감 탭에서 마감 후 확인하세요.
          </div>
        </div>
      )}

      {!listQ.isLoading && rows.length > 0 && (
        <div className="ds-panel-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full ds-table--flat" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)]">직원</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)]">근무시간</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)]">근무금액</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)]">승인경비</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)]">총 급여</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)]">명세</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const staff = staffById.get(r.staff);
                  return (
                  <tr key={r.id} className="border-t border-[var(--color-border-divider)]">
                    <td className="py-3 px-4 text-sm">
                      {staff ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <StaffRoleAvatar role={staff.role} size={20} className="shrink-0 text-[var(--color-text-secondary)]" />
                          <span className="font-medium text-[var(--color-text-primary)]">{r.staff_name}</span>
                          <RoleBadge isManager={!!staff.is_manager} />
                          <span className="text-xs text-[var(--color-text-muted)]">{payLabel(staff.pay_type)}</span>
                        </div>
                      ) : (
                        <span className="font-medium text-[var(--color-text-primary)]">{r.staff_name}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-right">{r.work_hours}</td>
                    <td className="py-3 px-4 text-sm text-right">{r.work_amount.toLocaleString()}원</td>
                    <td className="py-3 px-4 text-sm text-right">{r.approved_expense_amount.toLocaleString()}원</td>
                    <td className="py-3 px-4 text-sm font-semibold text-right">{r.total_amount.toLocaleString()}원</td>
                    <td className="py-3 px-4 text-right">
                      <ActionButton
                        variant="outline"
                        size="xs"
                        disabled={exportingPdfStaffId === r.staff}
                        onClick={() => handlePdf(r.staff)}
                      >
                        {exportingPdfStaffId === r.staff ? "…" : "PDF"}
                      </ActionButton>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4 text-[11px] text-[var(--color-text-muted)]">
            * PDF는 직원별 급여명세, 엑셀은 해당 월 전체 직원 목록입니다.
          </div>
        </div>
      )}
    </>
  );
}
