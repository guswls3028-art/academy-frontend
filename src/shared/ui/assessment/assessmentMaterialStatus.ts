const labels = {
  none: "원본 미등록",
  processing: "문항 분리 중",
  review_required: "문항·해설 검수 필요",
  conversion_required: "원본 확인 필요",
  failed: "분리 실패 · 원본 확인 필요",
  ready: "문항 준비 완료",
};

export function assessmentMaterialStatus(status: keyof typeof labels) {
  return labels[status];
}
