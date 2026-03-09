// PATH: src/student/domains/grades/components/GradeBadge.tsx

type GradeBadgeProps = {
  passed: boolean;
  label?: { pass?: string; fail?: string };
};

export default function GradeBadge({ passed, label }: GradeBadgeProps) {
  const passText = label?.pass ?? "합격";
  const failText = label?.fail ?? "불합격";
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
