const materialStatus = {
  none: { label: "원본 미등록", tone: "neutral" },
  processing: { label: "문항 분리 중", tone: "info" },
  review_required: { label: "검수 필요", tone: "warning" },
  conversion_required: { label: "원본 확인 필요", tone: "warning" },
  failed: { label: "분리 실패", tone: "danger" },
  ready: { label: "문항 준비 완료", tone: "success" },
} as const;

export function assessmentMaterialStatus(status: keyof typeof materialStatus) {
  return materialStatus[status];
}
