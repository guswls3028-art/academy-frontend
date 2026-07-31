import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

type StudentDetailLinkProps = {
  studentId?: number | null;
  studentName: string;
  children: ReactNode;
  className?: string;
};

function validStudentId(studentId: number | null | undefined): studentId is number {
  return Number.isInteger(studentId) && Number(studentId) > 0;
}

export default function StudentDetailLink({
  studentId,
  studentName,
  children,
  className,
}: StudentDetailLinkProps) {
  const location = useLocation();

  if (!validStudentId(studentId)) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      to={`/workspace/students/${studentId}`}
      state={{ backgroundLocation: location }}
      className={[
        "inline-flex max-w-full rounded-md text-left text-inherit no-underline",
        "hover:underline focus:outline-none focus-visible:ring-2",
        "focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-1",
        className ?? "",
      ].filter(Boolean).join(" ")}
      aria-label={`${studentName} 학생 상세 열기`}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </Link>
  );
}
