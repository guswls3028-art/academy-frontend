// PATH: src/features/profile/attendance/components/AttendanceSummary.tsx
import { PageSection } from "@/shared/ui/page";
import AttendanceSummaryCard from "@/features/profile/components/AttendanceSummaryCard";
import { AttendanceSummary } from "@/features/profile/api/profile";

export default function AttendanceSummary({
  summary,
}: {
  summary?: AttendanceSummary;
}) {
  return (
    <PageSection title="근태 요약">
      <AttendanceSummaryCard summary={summary} />
    </PageSection>
  );
}
