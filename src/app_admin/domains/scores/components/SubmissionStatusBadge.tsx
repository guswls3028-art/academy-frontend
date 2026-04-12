/** 사이즈·색상 SSOT: ds-status-badge + data-tone (success/danger/warning/primary/neutral) */
type Props = { status: string };

const TONE: Record<string, "success" | "danger" | "warning" | "primary" | "neutral"> = {
  submitted: "primary",
  dispatched: "primary",
  extracting: "warning",
  needs_identification: "danger",
  graded: "success",
  failed: "neutral",
};

const LABEL: Record<string, string> = {
  submitted: "제출됨",
  dispatched: "AI 처리중",
  extracting: "답안 확인",
  needs_identification: "식별 필요",
  graded: "채점 완료",
  failed: "실패",
};

export default function SubmissionStatusBadge({ status }: Props) {
  const tone = TONE[status] ?? "neutral";
  return (
    <span className="ds-status-badge" data-tone={tone}>
      {LABEL[status] ?? status}
    </span>
  );
}
