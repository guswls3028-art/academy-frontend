// PATH: src/student/shared/components/StudentPageShell.tsx

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
    <div>
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
            <div className="student-muted" style={{ marginTop: 4 }}>
              {description}
            </div>
          )}
        </div>
        {actions && <div>{actions}</div>}
      </div>

      <div className="stu-section">{children}</div>
    </div>
  );
}
