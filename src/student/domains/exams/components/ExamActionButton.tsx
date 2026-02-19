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
      <div className="stu-muted" style={{ fontSize: 14 }}>
        {label}
      </div>
    );
  }

  return (
    <Link to={to} className="stu-cta-link">
      {label}
    </Link>
  );
}
