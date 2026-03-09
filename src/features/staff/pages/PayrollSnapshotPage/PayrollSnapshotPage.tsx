// PATH: src/features/staff/pages/PayrollSnapshotPage/PayrollSnapshotPage.tsx
// 급여 스냅샷: 월별 확정 근무시간·급여·경비 요약 (마감 시점 고정 데이터)

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
import "../../styles/staff-area.css";

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
    <div className="staff-area staff-panel">
        <div className="staff-panel__header flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="staff-section-title">기준월</div>
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
        <div className="staff-panel__body pt-0">
        <p className="staff-helper">* {ymLabel(ym.year, ym.month)} 월 마감 시 생성된 스냅샷만 표시됩니다.</p>
        </div>
    </div>

      {listQ.isLoading && (
        <div className="staff-area staff-panel p-8 text-center staff-helper">불러오는 중…</div>
      )}

      {!listQ.isLoading && rows.length === 0 && (
        <div className="staff-area staff-panel p-8">
          <div className="staff-section-title">확정 급여 없음</div>
          <p className="staff-helper mt-1">해당 월은 아직 마감되지 않았거나 급여 스냅샷이 없습니다. 월 마감 탭에서 마감 후 확인하세요.</p>
        </div>
      )}

      {!listQ.isLoading && rows.length > 0 && (
        <div className="staff-area staff-panel overflow-hidden">
          <div className="staff-panel__header">
            <span className="staff-section-title">스냅샷 목록 (확정 데이터)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full ds-table ds-table--flat" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 staff-label">직원</th>
                  <th className="text-right py-3 px-4 staff-label">근무시간</th>
                  <th className="text-right py-3 px-4 staff-label">기본급</th>
                  <th className="text-right py-3 px-4 staff-label">승인경비</th>
                  <th className="text-right py-3 px-4 staff-label">총 급여</th>
                  <th className="text-right py-3 px-4 staff-label">확정일시</th>
                  <th className="text-right py-3 px-4 staff-label">명세</th>
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
                    <td className="py-3 px-4 text-sm text-right staff-num">{r.work_hours}</td>
                    <td className="py-3 px-4 text-sm text-right staff-num">{r.work_amount.toLocaleString()}원</td>
                    <td className="py-3 px-4 text-sm text-right staff-num">{r.approved_expense_amount.toLocaleString()}원</td>
                    <td className="py-3 px-4 text-sm font-semibold text-right staff-num">{r.total_amount.toLocaleString()}원</td>
                    <td className="py-3 px-4 text-xs text-[var(--color-text-muted)] staff-num">
                      {r.created_at ? new Date(r.created_at).toLocaleString("ko-KR") : "-"}
                    </td>
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
          <div className="staff-panel__body border-t border-[var(--color-border-divider)]">
            <p className="staff-helper">* PDF는 직원별 급여명세, 엑셀은 해당 월 전체 직원 목록입니다.</p>
          </div>
        </div>
      )}
    </>
  );
}
