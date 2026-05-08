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
  return intent === "test" ? "school_exam_pdf" : "academy_workbook";
}

/**
 * 파일명 휴리스틱으로 source_type 추론 — 사용자가 매번 7가지 라디오를 고르지 않게.
 * 학원장 directive 2026-05-09: "내부 알고리즘으로 알아서 구분해야"
 * 의도. 업로드 시점엔 paper_type 분류가 아직 없으므로 파일명/intent 만 사용.
 *
 * 우선순위:
 *   1. 명시 키워드 (해설/정답/답안)
 *   2. 학생 사진 신호 (학생/필기/카카오톡 + 이미지 확장자)
 *   3. 학교/시판/학원 키워드
 *   4. intent fallback
 *
 * post-analysis backfill 단계에서 paper_type 결과로 다시 보정되므로 여기는 "default 똑똑하게"
 * 정도의 best-effort. 학원장이 헤더 chip 으로 언제든 정정 가능.
 */
export function suggestSourceType(
  filenames: string[],
  intent: MatchupDocumentIntent,
): { sourceType: MatchupSourceType; reason: string } {
  const joined = filenames.join(" ").toLowerCase();
  const hasImage = filenames.some((n) => /\.(jpe?g|png|heic|heif)$/i.test(n));
  const hasPdf = filenames.some((n) => /\.pdf$/i.test(n));

  // 1. 해설/정답 키워드 — 인덱싱 제외 source.
  if (/(해설|풀이|solution|explanation)/i.test(joined)) {
    return { sourceType: "explanation", reason: "파일명에 '해설' 키워드" };
  }
  if (/(정답표|답지|answer.?key|정답.?\d|단답형.?정답)/i.test(joined)) {
    return { sourceType: "answer_key", reason: "파일명에 '정답' 키워드" };
  }

  // 2. 학생 사진 신호 — 카카오톡/필기/사진 + 이미지 확장자
  if (hasImage && /(카카오톡|kakao|학생|필기|채점|photo|img_|사진)/i.test(joined)) {
    return { sourceType: "student_exam_photo", reason: "이미지 + 학생/필기 키워드" };
  }

  // 3. 카테고리 신호
  if (/(기출|수능|모의고사|모평|학평|중간고사|기말고사|학교)/i.test(joined)) {
    return { sourceType: "school_exam_pdf", reason: "파일명에 시험/학교 키워드" };
  }
  if (/(쎈|개념원리|마플|블랙라벨|자이스토리|수특|수완|EBS|일등급)/i.test(joined)) {
    return { sourceType: "commercial_workbook", reason: "파일명에 시판 교재 키워드" };
  }
  if (/(워크북|학원|자체|workbook)/i.test(joined)) {
    return { sourceType: "academy_workbook", reason: "파일명에 학원 워크북 키워드" };
  }

  // 4. intent fallback — test 는 학교 PDF, reference 는 학원 워크북 (보수적 default).
  if (intent === "test") {
    // 시험지 intent + 이미지만 있으면 학생 사진 가능성 높음.
    if (hasImage && !hasPdf) {
      return { sourceType: "student_exam_photo", reason: "시험지 intent + 이미지 only" };
    }
    return { sourceType: "school_exam_pdf", reason: "시험지 intent default" };
  }
  return { sourceType: "academy_workbook", reason: "참고자료 intent default" };
}
