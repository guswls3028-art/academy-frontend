// PATH: src/features/staff/pages/ReportsPage/PayrollHistoryTable.tsx
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  fetchPayrollSnapshots,
  exportPayrollSnapshotExcel,
} from "../../api/payrollSnapshots.api";
import { exportPayrollSnapshotPDF } from "../../api/payrollSnapshotPdf.api";
import ActionButton from "../../components/ActionButton";

function ymLabel(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** staffIdProp: 리포트/명세 페이지에서 쿼리로 전달할 때 사용. 없으면 useParams (상세 오버레이) */
export default function PayrollHistoryTable({ staffId: staffIdProp }: { staffId?: number } = {}) {
  const { staffId: paramId } = useParams();
  const sid = staffIdProp ?? (paramId ? Number(paramId) : undefined);

  const listQ = useQuery({
    queryKey: ["payroll-history", sid],
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

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-5 py-6">
        <div className="text-sm font-semibold">급여 히스토리 없음</div>
        <div className="text-xs text-[var(--text-muted)] mt-1">
          아직 마감된 급여 내역이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-5 py-4 flex justify-between items-center gap-4"
        >
          <div>
            <div className="font-semibold">{ymLabel(r.year, r.month)}</div>
            <div className="text-xs text-[var(--text-muted)]">
              생성:{" "}
              {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="font-semibold">{r.total_amount.toLocaleString()}원</div>

            <ActionButton
              variant="outline"
              size="xs"
              onClick={() =>
                exportPayrollSnapshotPDF({
                  staff: sid as number,
                  year: r.year,
                  month: r.month,
                })
              }
            >
              PDF
            </ActionButton>

            <ActionButton
              variant="outline"
              size="xs"
              title="엑셀은 해당 월 전체 급여 다운로드입니다."
              onClick={() =>
                exportPayrollSnapshotExcel({
                  year: r.year,
                  month: r.month,
                })
              }
            >
              XLSX
            </ActionButton>
          </div>
        </div>
      ))}
    </div>
  );
}
