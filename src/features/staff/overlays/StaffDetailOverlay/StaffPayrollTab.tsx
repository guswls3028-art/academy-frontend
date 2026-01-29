// PATH: src/features/staff/overlays/StaffDetailOverlay/StaffPayrollTab.tsx
import { useParams } from "react-router-dom";
import { usePayrollSnapshots } from "../../hooks/usePayrollSnapshots";

export default function StaffPayrollTab() {
  const { staffId } = useParams();
  const sid = Number(staffId);

  const { data, isLoading } = usePayrollSnapshots({ staff: sid });

  if (isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">Loading payroll...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="text-sm text-[var(--text-muted)]">급여 데이터 없음</div>;
  }

  return (
    <div className="space-y-2">
      {data.map((p) => (
        <div
          key={p.id}
          className="flex justify-between rounded-lg border border-[var(--border-divider)] px-4 py-2 text-sm"
        >
          <div>
            {p.year}-{String(p.month).padStart(2, "0")}
          </div>
          <div className="font-semibold">
            {p.total_amount.toLocaleString()} 원
          </div>
        </div>
      ))}

      <div className="text-xs text-[var(--text-muted)]">
        * 급여는 수정 불가하며 PayrollSnapshot 기준으로만 표시됩니다.
      </div>
    </div>
  );
}
