export const MATCHUP_EXAM_CYCLE_LABELS = {
  "": "미지정",
  semester1_midterm: "1학기 중간고사",
  semester1_final: "1학기 기말고사",
  semester2_midterm: "2학기 중간고사",
  semester2_final: "2학기 기말고사",
  midterm: "중간고사 (학기 미지정)",
  final: "기말고사 (학기 미지정)",
  mock: "모의고사",
  other: "기타",
} as const;

export type MatchupExamCycle = keyof typeof MATCHUP_EXAM_CYCLE_LABELS;

export const MATCHUP_EXAM_CYCLE_OPTIONS: readonly MatchupExamCycle[] = [
  "", "semester1_midterm", "semester1_final", "semester2_midterm", "semester2_final", "mock", "other",
];

export const MATCHUP_EXAM_CYCLE_ORDER: readonly MatchupExamCycle[] = [
  "semester1_midterm", "semester1_final", "semester2_midterm", "semester2_final",
  "midterm", "final", "mock", "other", "",
];
