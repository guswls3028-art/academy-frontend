// src/student/shared/components/SectionHeader.tsx
/**
 * ✅ SectionHeader
 * - 카드/섹션 상단 제목용
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
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
      }}
    >
      <div style={{ fontWeight: 800 }}>{title}</div>
      {right && <div>{right}</div>}
    </div>
  );
}
