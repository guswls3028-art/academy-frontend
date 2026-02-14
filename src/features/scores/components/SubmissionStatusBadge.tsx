/** 사이즈·색상 SSOT: ds-status-badge + data-tone (success/danger/warning/primary/neutral) */
type Props = { status: string };

const TONE: Record<string, "success" | "danger" | "warning" | "primary" | "neutral"> = {
  PROCESSING: "primary",
  ANSWERS_READY: "warning",
  NEEDS_IDENTIFICATION: "danger",
  GRADED: "success",
  FAILED: "neutral",
};

const LABEL: Record<string, string> = {
  PROCESSING: "AI 처리중",
  ANSWERS_READY: "답안 확인",
  NEEDS_IDENTIFICATION: "식별 필요",
  GRADED: "채점 완료",
  FAILED: "실패",
};

export default function SubmissionStatusBadge({ status }: Props) {
  const tone = TONE[status] ?? "neutral";
  return (
    <span className="ds-status-badge" data-tone={tone}>
      {LABEL[status] ?? status}
    </span>
  );
}
