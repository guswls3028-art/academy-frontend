// PATH: src/student/domains/grades/components/GradeBadge.tsx

import type { Achievement } from "../api/grades";

type GradeBadgeProps = {
  passed: boolean | null;
  achievement?: Achievement | null;
  label?: { pass?: string; fail?: string };
};

export default function GradeBadge({ passed, achievement, label }: GradeBadgeProps) {
  const passText = label?.pass ?? "합격";
  const failText = label?.fail ?? "불합격";

  // 합격 기준 미설정 → 뱃지 미표시
  if (passed === null || passed === undefined) {
    return null;
  }

  // 보강 합격
  if (achievement === "REMEDIATED") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          background: "var(--stu-success-bg)",
          color: "var(--stu-success-text)",
          whiteSpace: "nowrap",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        보강 합격
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: passed ? "var(--stu-success-bg)" : "var(--stu-danger-bg)",
        color: passed ? "var(--stu-success-text)" : "var(--stu-danger-text)",
        whiteSpace: "nowrap",
      }}
    >
      {passed ? passText : failText}
    </span>
  );
}
