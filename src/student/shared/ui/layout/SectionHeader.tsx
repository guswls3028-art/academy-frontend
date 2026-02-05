// PATH: src/student/shared/ui/layout/SectionHeader.tsx
/**
 * ✅ SectionHeader (LOCK v2)
 * - 타이포/간격을 typography + base.css로 통일
 * - 페이지/카드 어디서든 일관된 헤더
 */

import { ReactNode } from "react";

export default function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="stu-between" style={{ marginBottom: "var(--stu-space-6)" }}>
      <div className="stu-h3">{title}</div>
      {right && <div>{right}</div>}
    </div>
  );
}
