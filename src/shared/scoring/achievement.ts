/**
 * PATH: src/shared/scoring/achievement.ts
 *
 * 시험 성취(achievement) 타입 + 유틸 SSOT.
 *
 * 정책 (backend/apps/domains/results/utils/exam_achievement.py 와 1:1 대응):
 * - PASS: 1차 합격
 * - REMEDIATED: 1차 불합격 + 클리닉 해소(EXAM_PASS / MANUAL_OVERRIDE) = 보강 합격
 * - FAIL: 1차 불합격 + 미해소
 * - NOT_SUBMITTED: 미응시 + 미해소
 * - null: 판정 기준 없음 (pass_score=0)
 *
 * 분리:
 * - 석차 = 1차 점수(공정 경쟁) → rank 필드
 * - 성취 = 전체 이력 + 보강합격 인정(성장) → achievement 필드
 *
 * 뱃지/KPI/통계에서 `achievement`를 우선 사용하고,
 * 백엔드가 필드를 내려주지 않을 때만 `passed`/`is_pass`/`final_pass`로 폴백.
 */

export type Achievement =
  | "PASS"
  | "REMEDIATED"
  | "FAIL"
  | "NOT_SUBMITTED";

export type AchievementInput = {
  /** 성취 분류 (백엔드가 내려주면 최우선) */
  achievement?: Achievement | null;
  /** 1차 합격 여부 (석차용). null: 판정 기준 없음(pass_score=0). */
  is_pass?: boolean | null;
  /** 1차 불합격 + 클리닉 해소 */
  remediated?: boolean | null;
  /** 최종 합격 (1차 OR remediated). 뱃지 색상/게이지용. */
  final_pass?: boolean | null;
  /** 미응시 표식 (attempt.meta.status) */
  meta_status?: string | null;
  /** 레거시 호환: passed 필드를 쓰는 이전 응답 */
  passed?: boolean | null;
};

/**
 * 입력 필드에서 Achievement를 파생한다.
 * backend가 직접 `achievement`를 내려주면 그 값을 신뢰하고,
 * 없으면 is_pass/remediated/meta_status로 계산.
 */
export function deriveAchievement(input: AchievementInput): Achievement | null {
  if (input.achievement) return input.achievement;

  const isNotSubmitted = input.meta_status === "NOT_SUBMITTED";
  const remediated = !!input.remediated;
  const basePass = input.is_pass ?? input.passed ?? null;

  if (remediated) return "REMEDIATED";
  if (basePass === true) return "PASS";
  if (isNotSubmitted) return "NOT_SUBMITTED";
  if (basePass === false) return "FAIL";
  return null;
}

/**
 * 최종 합격 여부 (뱃지 색상, 게이지 색, 합격률 집계 공통 기준).
 * - PASS/REMEDIATED → true (성취 인정)
 * - FAIL → false
 * - NOT_SUBMITTED / null → null (미판정)
 */
export function deriveFinalPass(input: AchievementInput): boolean | null {
  if (typeof input.final_pass === "boolean") return input.final_pass;
  const a = deriveAchievement(input);
  if (a === "PASS" || a === "REMEDIATED") return true;
  if (a === "FAIL") return false;
  return null;
}

/**
 * Achievement를 "합격/보강합격/불합격/미응시/—" 한글 라벨로.
 */
export function achievementLabel(a: Achievement | null | undefined): string {
  switch (a) {
    case "PASS":
      return "합격";
    case "REMEDIATED":
      return "보강 합격";
    case "FAIL":
      return "불합격";
    case "NOT_SUBMITTED":
      return "미응시";
    default:
      return "—";
  }
}

/**
 * 뱃지 톤(색상 semantic). DS tone: success/warn/danger/muted/neutral.
 */
export function achievementTone(
  a: Achievement | null | undefined,
): "success" | "warn" | "danger" | "muted" | "neutral" {
  switch (a) {
    case "PASS":
      return "success";
    case "REMEDIATED":
      // 성취 인정이지만 1차 불합격 이력은 구분되어야 함 → warn 톤
      return "warn";
    case "FAIL":
      return "danger";
    case "NOT_SUBMITTED":
      return "muted";
    default:
      return "neutral";
  }
}

/**
 * 합격률/통계 집계에 성취를 반영할 때 사용.
 * passCount: 성취 인정 (PASS + REMEDIATED)
 * failCount: 불합격 (FAIL)
 * scoredCount: 판정 기준이 있는 응시 (PASS + REMEDIATED + FAIL)
 * 미응시/null은 분모에서 제외.
 */
export function tallyAchievements<T extends AchievementInput>(
  rows: readonly T[],
): { passCount: number; failCount: number; scoredCount: number; notSubmitted: number } {
  let passCount = 0;
  let failCount = 0;
  let notSubmitted = 0;
  for (const r of rows) {
    const a = deriveAchievement(r);
    if (a === "PASS" || a === "REMEDIATED") passCount += 1;
    else if (a === "FAIL") failCount += 1;
    else if (a === "NOT_SUBMITTED") notSubmitted += 1;
  }
  return {
    passCount,
    failCount,
    notSubmitted,
    scoredCount: passCount + failCount,
  };
}
