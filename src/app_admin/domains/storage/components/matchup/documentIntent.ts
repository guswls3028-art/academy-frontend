// PATH: src/app_admin/domains/storage/components/matchup/documentIntent.ts
//
// 매치업 자료 유형 SSOT (frontend).
// 동기: 2026-05-02 학원장 directive — 알고리즘 X 라우터 부재가 본질.
// backend `apps/domains/matchup/source_types.py`와 짝.

import type { MatchupDocument } from "../../api/matchup.api";

// 7-value source_type SSOT (backend와 정합).
export type MatchupSourceType =
  | "student_exam_photo"   // 학생 시험지/답안지 사진
  | "school_exam_pdf"      // 학교 기출/시험지 PDF
  | "commercial_workbook"  // 시판 교재
  | "academy_workbook"     // 학원 자체 워크북
  | "explanation"          // 해설지
  | "answer_key"           // 답안지
  | "other";               // 기타

// Legacy 2-value (이전 시스템 잔존) — 새 코드는 사용 X. UI 진입점 prop으로만.
export type MatchupDocumentIntent = "reference" | "test";

// 한국어 레이블
export const SOURCE_TYPE_LABELS: Record<MatchupSourceType, string> = {
  student_exam_photo:  "학생 시험지/답안지 사진",
  school_exam_pdf:     "학교 기출/시험지 PDF",
  commercial_workbook: "시판 교재",
  academy_workbook:    "학원 자체 워크북",
  explanation:         "해설지",
  answer_key:          "답안지",
  other:               "기타",
};

// UI 표시 순서 (학원 워크플로우 빈도 기준).
export const SOURCE_TYPE_ORDER: MatchupSourceType[] = [
  "school_exam_pdf",
  "student_exam_photo",
  "commercial_workbook",
  "academy_workbook",
  "explanation",
  "answer_key",
  "other",
];

// Legacy intent → 7-value 매핑 (도큐먼트 분류 시 안전 default).
const LEGACY_INTENT_TO_SOURCE_TYPE: Record<string, MatchupSourceType> = {
  test:      "school_exam_pdf",
  exam_sheet: "school_exam_pdf",
  reference: "other",
};

const VALID_SOURCE_TYPES: ReadonlySet<string> = new Set(SOURCE_TYPE_ORDER);

/**
 * 입력 문자열을 7-value source_type으로 정규화.
 * - 7-value 그대로 → 그대로 반환
 * - legacy 2-value → 매핑
 * - 빈/미인식 → "other" (보수적 default)
 */
export function normalizeSourceType(value: string | null | undefined): MatchupSourceType {
  if (!value) return "other";
  const v = value.trim().toLowerCase();
  if (VALID_SOURCE_TYPES.has(v)) return v as MatchupSourceType;
  if (v in LEGACY_INTENT_TO_SOURCE_TYPE) return LEGACY_INTENT_TO_SOURCE_TYPE[v];
  return "other";
}

/**
 * 매치업 후보 인덱싱 대상인지 — 해설지/답안지는 X.
 * backend `is_indexable`와 짝.
 */
export function isIndexableSourceType(sourceType: MatchupSourceType): boolean {
  return sourceType !== "explanation" && sourceType !== "answer_key";
}

/**
 * doc.meta에서 source_type 추출 (legacy upload_intent / document_role도 지원).
 */
export function getSourceType(doc: MatchupDocument): MatchupSourceType {
  const meta = doc.meta as { source_type?: string; upload_intent?: string; document_role?: string } | undefined;
  return normalizeSourceType(
    meta?.source_type ?? meta?.upload_intent ?? meta?.document_role
  );
}

/**
 * 기존 binary 분류 (UI 표시: 시험지 vs 학원자료) — 학원장 mental model 보존.
 * source_type이 명확하면 그쪽으로 분기, 아니면 legacy intent 사용.
 */
export function getDocumentIntent(doc: MatchupDocument): MatchupDocumentIntent {
  const st = getSourceType(doc);
  // 시험지 카테고리: 학교 PDF + 학생 폰사진
  if (st === "school_exam_pdf" || st === "student_exam_photo") return "test";
  // 그 외 (workbook/commercial/explanation/answer_key/other) → 학원자료
  return "reference";
}

/**
 * Legacy intent → source_type 매핑 (업로드 시 backend 전송 시 호환).
 * 모달 진입 prop이 아직 2-value 일 때 backend로 전송하는 변환점.
 */
export function intentToSourceType(intent: MatchupDocumentIntent): MatchupSourceType {
  return intent === "test" ? "school_exam_pdf" : "other";
}
