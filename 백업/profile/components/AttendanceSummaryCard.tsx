// src/features/profile/components/AttendanceSummaryCard.tsx
import { Card, CardBody } from "@/shared/ui/card";
import { AttendanceSummary } from "../api/profile";

export default function AttendanceSummaryCard({ summary }: { summary?: AttendanceSummary }) {
  if (!summary) return null;

  return (
    <Card>
      <CardBody className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-[var(--text-muted)]">총 근무 시간</div>
          <div className="text-lg font-semibold">{summary.total_hours} h</div>
        </div>

        <div>
          <div className="text-[var(--text-muted)]">총 금액</div>
          <div className="text-lg font-semibold">{summary.total_amount.toLocaleString()} 원</div>
        </div>

        <div>
          <div className="text-[var(--text-muted)]">세후 금액</div>
          <div className="text-lg font-semibold text-[var(--color-primary)]">
            {summary.total_after_tax.toLocaleString()} 원
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
