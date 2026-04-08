// PATH: src/student/domains/grades/components/GradeRow.tsx

import { ReactNode } from "react";
import GradeBadge from "./GradeBadge";

type GradeRowProps = {
  icon: ReactNode;
  title: string;
  subtitle?: string | null;
  score: string;
  passed?: boolean;
  onClick?: () => void;
  href?: string;
  trailingIcon?: ReactNode;
};

export default function GradeRow({
  icon,
  title,
  subtitle,
  score,
  passed,
  trailingIcon,
}: GradeRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--stu-space-4)",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "var(--stu-surface-soft)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>
          {subtitle && `${subtitle} · `}
          {score}
          {passed != null && (
            <>
              {" · "}
              <GradeBadge passed={passed} />
            </>
          )}
        </div>
      </div>
      {trailingIcon && (
        <div style={{ flexShrink: 0 }}>{trailingIcon}</div>
      )}
    </div>
  );
}
