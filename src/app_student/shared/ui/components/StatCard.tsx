/**
 * StatCard — 도메인 통계 카드 (공유)
 * 3-column grid로 배치. accent 색상 지원.
 */
import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string;
  accent?: "success" | "danger" | "warn";
  icon?: ReactNode;
  /** 추세 표시 (예: "+5%", "-2점") */
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
};

const accentColors: Record<string, string> = {
  success: "var(--stu-success-text)",
  danger: "var(--stu-danger-text)",
  warn: "var(--stu-warn-text)",
};

export function StatCard({ label, value, accent, icon, trend, trendDirection }: StatCardProps) {
  const valueColor = accent ? accentColors[accent] : "var(--stu-text)";
  const trendColor =
    trendDirection === "up"
      ? "var(--stu-success-text)"
      : trendDirection === "down"
        ? "var(--stu-danger-text)"
        : "var(--stu-text-muted)";

  return (
    <div
      style={{
        background: "var(--stu-surface-soft)",
        borderRadius: "var(--stu-radius)",
        padding: "var(--stu-space-5)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      {icon && (
        <div style={{ marginBottom: 4, color: "var(--stu-text-muted)", opacity: 0.7 }}>
          {icon}
        </div>
      )}
      <div style={{ fontSize: 20, fontWeight: 900, color: valueColor, lineHeight: 1.2 }}>
        {value}
      </div>
      <div className="stu-muted" style={{ fontSize: 12, marginTop: 2 }}>
        {label}
      </div>
      {trend && (
        <div style={{ fontSize: 11, fontWeight: 600, color: trendColor, marginTop: 2 }}>
          {trend}
        </div>
      )}
    </div>
  );
}

/** 3-column 반응형 그리드 래퍼 */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "var(--stu-space-4)",
      }}
    >
      {children}
    </div>
  );
}
