// src/student/shared/components/StudentPageShell.tsx
/**
 * ✅ StudentPageShell
 * - 상용 SaaS에서 흔히 쓰는 "페이지 프레임"
 * - 제목/설명/액션 영역만 제공
 * - UI는 최소화 (CSS 분리 예정)
 */

import { ReactNode } from "react";

export default function StudentPageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{title}</div>
          {description && (
            <div style={{ marginTop: 4, fontSize: 13, color: "#666" }}>
              {description}
            </div>
          )}
        </div>
        {actions && <div>{actions}</div>}
      </div>

      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 10,
          background: "#fff",
          padding: 16,
        }}
      >
        {children}
      </div>
    </div>
  );
}
