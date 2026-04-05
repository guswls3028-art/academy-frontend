// PATH: src/student/domains/grades/components/GradeBadge.tsx

import type { Achievement } from "../api/grades";

type GradeBadgeProps = {
  passed: boolean | null;
  achievement?: Achievement | null;
  label?: { pass?: string; fail?: string };
  /** 미응시/미입력 구분: true면 "미응시" 표시, false/undefined면 뱃지 미표시 */
  showNotSubmitted?: boolean;
  size?: "sm" | "md";
};

const CHECK_SVG = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DASH_SVG = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export default function GradeBadge({ passed, achievement, label, showNotSubmitted, size = "md" }: GradeBadgeProps) {
  const passText = label?.pass ?? "합격";
  const failText = label?.fail ?? "불합격";
  const sizeClass = size === "sm" ? " stu-badge--sm" : "";

  // 보강 합격 — 최고 우선순위
  if (achievement === "REMEDIATED") {
    return (
      <span className={`stu-badge stu-badge--success${sizeClass}`} style={{ gap: 3 }}>
        {CHECK_SVG}
        보강 합격
      </span>
    );
  }

  // 미응시 (NOT_SUBMITTED)
  if (achievement === "NOT_SUBMITTED") {
    return (
      <span className={`stu-badge stu-badge--warn${sizeClass}`} style={{ gap: 3 }}>
        {DASH_SVG}
        미응시
      </span>
    );
  }

  // 합격 기준 미설정 또는 미입력
  if (passed === null || passed === undefined) {
    if (showNotSubmitted) {
      return (
        <span className={`stu-badge stu-badge--neutral${sizeClass}`} style={{ gap: 3 }}>
          {DASH_SVG}
          미입력
        </span>
      );
    }
    return null;
  }

  // 합격 / 불합격
  return (
    <span className={`stu-badge ${passed ? "stu-badge--success" : "stu-badge--danger"}${sizeClass}`}>
      {passed ? passText : failText}
    </span>
  );
}
