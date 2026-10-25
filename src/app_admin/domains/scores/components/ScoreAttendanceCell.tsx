import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import type { SessionScoreRow } from "@/shared/api/contracts/sessionScores";

export default function ScoreAttendanceCell({ row, status }: { row: SessionScoreRow; status?: string | null }) {
  if (!status) return <span className="text-[var(--color-text-muted)]">-</span>;
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <AttendanceStatusBadge status={status as Parameters<typeof AttendanceStatusBadge>[0]["status"]} variant="2ch" />
      {status === "ONLINE" && (
        <span className="text-[10px] leading-tight text-[var(--color-text-muted)] whitespace-nowrap">
          {row.video_completed ? "영상 완료" : row.video_progress_rate != null ? `영상 ${row.video_progress_rate}%` : "영상 기록 없음"}
        </span>
      )}
    </span>
  );
}
