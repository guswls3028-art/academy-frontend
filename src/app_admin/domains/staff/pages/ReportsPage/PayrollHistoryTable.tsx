// PATH: src/app_admin/domains/staff/pages/ReportsPage/PayrollHistoryTable.tsx
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import {
  fetchPayrollSnapshots,
  type PayrollSnapshot,
  exportPayrollSnapshotExcel,
} from "../../api/payrollSnapshots.api";
import { exportPayrollSnapshotPDF } from "../../api/payrollSnapshotPdf.api";
import ActionButton from "../../components/ActionButton";
import { staffQueryKeys } from "../../queryKeys";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

function ymLabel(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** staffIdProp: 리포트/명세 페이지에서 쿼리로 전달할 때 사용. 없으면 useParams (상세 오버레이) */
export default function PayrollHistoryTable({ staffId: staffIdProp }: { staffId?: number } = {}) {
  const { staffId: paramId } = useParams();
  const sid = staffIdProp ?? (paramId ? Number(paramId) : undefined);

  const [exporting, setExporting] = useState<string | null>(null);
  const download = async (row: PayrollSnapshot, format: "PDF" | "XLSX") => {
    if (exporting || !sid) return;
    setExporting(`${row.id}-${format}`);
    try {
      if (format === "PDF") {
        await exportPayrollSnapshotPDF({ staff: sid, year: row.year, month: row.month });
      } else {
        await exportPayrollSnapshotExcel({ year: row.year, month: row.month });
      }
      feedback.success(`${format} 다운로드가 시작되었습니다.`);
    } catch (error: unknown) {
      feedback.error(extractApiError(error, `${format} 다운로드에 실패했습니다. 다시 시도해 주세요.`));
    } finally {
      setExporting(null);
    }
  };

  const listQ = useQuery({
    queryKey: staffQueryKeys.payrollHistory(sid),
    queryFn: () => fetchPayrollSnapshots({ staff: sid }),
    enabled: typeof sid === "number" && sid > 0,
  });

  const rows = useMemo(
    () =>
      (listQ.data ?? []).slice().sort(
        (a, b) => b.year * 100 + b.month - (a.year * 100 + a.month)
      ),
    [listQ.data]
  );

  if (!sid) {
    return (
      <div className="text-sm text-[var(--text-muted)]">
        직원 상세 화면에서만 급여 히스토리를 확인할 수 있습니다.
      </div>
    );
  }

  if (listQ.isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  if (listQ.isError) {
    return <div role="alert" className="text-sm text-[var(--color-error)]">급여 히스토리를 불러오지 못했습니다. <button type="button" className="underline" onClick={() => void listQ.refetch()}>다시 시도</button></div>;
  }

  if (rows.length === 0) {
    return (
      <div className="staff-section-card__empty">
        <div className="staff-section-title">급여 히스토리 없음</div>
        <div className="staff-helper mt-2">아직 마감된 급여 내역이 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] px-5 py-4 flex flex-wrap justify-between items-center gap-4 shadow-sm"
        >
          <div>
            <div className="staff-section-title font-semibold">{ymLabel(r.year, r.month)}</div>
            <div className="staff-helper mt-0.5">
              생성: {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="staff-body font-semibold tabular-nums">
              <div className="staff-helper">이체 예정액</div>
              {r.default_deduction.transfer_amount.toLocaleString()}원
              <div className="staff-helper">공제 전 급여 {r.work_amount.toLocaleString()}원 · 기본 공제 {r.default_deduction.deduction_total.toLocaleString()}원</div>
            </div>

            <ActionButton
              variant="outline"
              size="xs"
              disabled={exporting !== null}
              onClick={() => void download(r, "PDF")}
            >
              {exporting === `${r.id}-PDF` ? "준비 중…" : "PDF"}
            </ActionButton>

            <ActionButton
              variant="outline"
              size="xs"
              title="엑셀은 해당 월 전체 급여 다운로드입니다."
              disabled={exporting !== null}
              onClick={() => void download(r, "XLSX")}
            >
              {exporting === `${r.id}-XLSX` ? "준비 중…" : "XLSX"}
            </ActionButton>
          </div>
        </div>
      ))}
    </div>
  );
}
