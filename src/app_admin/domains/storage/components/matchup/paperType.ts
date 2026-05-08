// PATH: src/app_admin/domains/storage/components/matchup/paperType.ts
//
// 매치업 paper_type SSOT (frontend).
// backend `backend/academy/domain/tools/paper_type.py` 의 PaperType enum 과 짝.
//
// 9 enum + UI 한국어 라벨. 이전엔 MatchupPage / LowConfPageReviewer 두 곳에 동일
// PAPER_TYPE_LABEL 이 동기 없이 잔존했음 (A-3 2026-05-08 SSOT 추출).
//
// paper_type 은 학원장에게 노출되는 자료 유형 라벨. 학원장 직접 변경 UI 는 없고
// 백엔드가 자동 분류. 노출 위치:
//   - DocumentGuidanceBanner (헤더 안내 배너 — paper_type 별 안내 문구)
//   - LowConfPageReviewer (페이지별 검수 사이드바)
//   - paper_type_summary distribution details (현재는 제거됨, 추후 admin only 가능)

export type PaperType =
  | "clean_pdf_single"
  | "clean_pdf_dual"
  | "quadrant"
  | "scan_single"
  | "scan_dual"
  | "student_answer_photo"
  | "side_notes"
  | "non_question"
  | "unknown";

// 한국어 라벨 — 학원장에게 노출되는 자료 유형명. 변경 시 DocumentGuidanceBanner
// 안내 카피와 정합 검증 필요.
export const PAPER_TYPE_LABELS: Record<PaperType, string> = {
  clean_pdf_single:     "PDF (1단)",
  clean_pdf_dual:       "PDF (2단)",
  quadrant:             "4분할 시험지",
  scan_single:          "스캔본 (1단)",
  scan_dual:            "스캔본 (2단)",
  student_answer_photo: "학생 답안지 폰사진",
  side_notes:           "학습자료 본문",
  non_question:         "표지/정답지/해설지",
  unknown:              "분류 불명",
};

/**
 * 미지의 paper_type 문자열에 대한 안전한 라벨 변환. 백엔드가 신규 enum 을 추가했을
 * 때도 graceful fallback (raw key 그대로 반환).
 */
export function paperTypeLabel(key: string | null | undefined): string {
  if (!key) return PAPER_TYPE_LABELS.unknown;
  return (PAPER_TYPE_LABELS as Record<string, string>)[key] ?? key;
}
