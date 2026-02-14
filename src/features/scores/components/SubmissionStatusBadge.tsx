/** 사이즈 SSOT: ds-status-badge (2ch) — shared/ui/ds/styles/status.css */
type Props = { status: string };

const STYLE: Record<string, string> = {
  PROCESSING: "!bg-blue-100 !text-blue-700",
  ANSWERS_READY: "!bg-amber-100 !text-amber-700",
  NEEDS_IDENTIFICATION: "!bg-red-100 !text-red-700",
  GRADED: "!bg-emerald-100 !text-emerald-700",
  FAILED: "!bg-gray-200 !text-gray-600",
};

const LABEL: Record<string, string> = {
  PROCESSING: "AI 처리중",
  ANSWERS_READY: "답안 확인",
  NEEDS_IDENTIFICATION: "식별 필요",
  GRADED: "채점 완료",
  FAILED: "실패",
};

export default function SubmissionStatusBadge({ status }: Props) {
  const cls = STYLE[status] ?? "!bg-gray-100 !text-gray-500";
  return (
    <span className={`ds-status-badge ${cls}`}>
      {LABEL[status] ?? status}
    </span>
  );
}
