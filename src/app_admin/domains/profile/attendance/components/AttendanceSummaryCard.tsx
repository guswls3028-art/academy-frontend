// PATH: src/app_admin/domains/profile/attendance/components/AttendanceSummaryCard.tsx
import { Panel } from "@/shared/ui/ds";
import { AttendanceSummary } from "../../api/profile.api";
import styles from "./AttendanceCards.module.css";

export default function AttendanceSummaryCard({
  summary,
}: {
  summary?: AttendanceSummary | null;
}) {
  if (!summary) return null;

  return (
    <Panel variant="primary">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Item label="총 근무 시간" value={`${summary.total_hours}`} unit="시간" />
        <Item
          label="총 근무액 (공제 전)"
          value={summary.total_amount.toLocaleString()}
          unit="원"
          tone="primary"
        />
        <Item
          label="승인 환급비"
          value={summary.approved_expense_amount.toLocaleString()}
          unit="원"
        />
        <Item
          label="이체 예정액"
          value={summary.reference_transfer_amount.toLocaleString()}
          unit="원"
          tone="primary"
        />
      </div>
      <dl className={`mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-t pt-4 text-sm tabular-nums ${styles.summaryBreakdown}`}>
        <dt>근무 공제 전</dt>
        <dd className="font-semibold">{summary.total_amount.toLocaleString()}원</dd>
        <dt>기본 공제 3.3%</dt>
        <dd className="font-semibold">-{summary.reference_deduction_total.toLocaleString()}원</dd>
        <dt className="text-xs text-slate-500">사업소득세 3% + 지방소득세 0.3%</dt>
        <dd className="text-xs text-slate-500">{summary.reference_business_income_tax.toLocaleString()}원 + {summary.reference_local_income_tax.toLocaleString()}원</dd>
        <dt>공제 후 급여</dt>
        <dd className="font-semibold">{summary.reference_net_work_amount.toLocaleString()}원</dd>
        <dt>승인 환급비</dt>
        <dd className="font-semibold">+{summary.approved_expense_amount.toLocaleString()}원</dd>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        기본 공제 3.3%를 원 단위 반올림합니다. 승인 환급은 공제 없이 더하며, 이체 예정액은 송금 완료를 뜻하지 않습니다.
      </p>
    </Panel>
  );
}

function Item({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: "primary" | "normal";
}) {
  return (
    <div
      className={`rounded-xl border px-5 py-4 transition-all ${styles.summaryItem}`}
      data-tone={tone ?? "normal"}
    >
      <div className={styles.summaryLabel}>
        {label}
      </div>
      <div
        className={`mt-2 flex items-baseline gap-1 ${styles.summaryValue}`}
        data-tone={tone ?? "normal"}
      >
        <span>{typeof value === "number" ? value.toLocaleString() : value}</span>
        {unit && (
          <span className={styles.summaryUnit}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
