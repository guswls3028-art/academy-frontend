// PATH: src/app_admin/domains/storage/utils/normalizeOcrText.ts
//
// OCR 결과 텍스트의 시각 정규화 — 카드/리스트 미리보기 전용.
// 원본 OCR 텍스트는 토큰별로 잘려서 "그림 ( 가 ) 는 , 구조 를 ." 같이
// 한국어 문장에 부자연스러운 공백이 끼어 있다.
//
// 안전한 패턴만 정리:
//  - 괄호 안 양쪽 공백 제거: "( 가 )" → "(가)", "[ 보기 ]" → "[보기]", "< 보기 >" → "<보기>"
//  - 닫는 문장부호 앞 공백 제거: " ." → ".", " ," → ","
//  - 다중 공백 → 단일
//
// 한글-한글 사이 공백은 손대지 않는다 (의미 손상 위험).
// raw OCR 표시(ProblemDetailModal "OCR 텍스트 - 복사")에서는 호출 금지 — 원본 그대로가 정확.

export function normalizeOcrTextPreview(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\[\s+/g, "[")
    .replace(/\s+\]/g, "]")
    .replace(/<\s+/g, "<")
    .replace(/\s+>/g, ">")
    .replace(/\s+([.,;:?!])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
