// PATH: src/features/homework/types.ts
/**
 * HomeworkPolicy (Session 단위 정책)
 *
 * ✅ LOCKED
 * - 프론트는 "설정 입력"만 한다
 * - passed/clinic 판단은 서버 단일 진실
 *
 * ✅ 추가 요구사항
 * - 커트라인 입력 모드 선택 (% or 문항수)
 * - 반올림 단위는 유지
 * - 클리닉 옵션은 UI에서 제거 (자동 제공)
 */

export type HomeworkCutlineMode = "PERCENT" | "COUNT";

export type HomeworkPolicy = {
  id: number;
  session: number;

  cutline_mode: HomeworkCutlineMode; // "PERCENT" | "COUNT"
  cutline_value: number; // 70 or 40

  round_unit_percent: number; // percent 모드에서만 실질 의미 (예: 5)

  created_at: string;
  updated_at: string;
};
