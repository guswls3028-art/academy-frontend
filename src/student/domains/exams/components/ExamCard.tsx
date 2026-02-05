// PATH: src/student/domains/exams/components/ExamActionButton.tsx

import { Link } from "react-router-dom";

export type ExamActionButtonProps = {
  to: string;
  label: string;
  disabled?: boolean;
};

export default function ExamActionButton({
  to,
  label,
  disabled,
}: ExamActionButtonProps) {
  if (disabled) {
    return (
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid var(--stu-border)",
          background: "var(--stu-surface)",
          color: "var(--stu-text-muted)",
          fontWeight: 800,
          opacity: 0.5,
        }}
      >
        {label}
      </div>
    );
  }

  return (
    <Link
      to={to}
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid var(--stu-border)",
        background: "var(--stu-primary, #111)",
        color: "#fff",
        fontWeight: 900,
        textDecoration: "none",
        display: "inline-block",
      }}
    >
      {label}
    </Link>
  );
}
