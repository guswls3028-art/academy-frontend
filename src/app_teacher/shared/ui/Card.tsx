// PATH: src/app_teacher/shared/ui/Card.tsx
// 공용 카드/섹션 — 데스크톱 ds-section/ds-panel 모바일 대응
import type { CSSProperties, ReactNode } from "react";

/** 카드 컨테이너 */
export function Card({
  children,
  className = "",
  style,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{
        background: "var(--tc-surface)",
        border: "1px solid var(--tc-border)",
        boxShadow: "var(--tc-shadow-sm)",
        padding: "var(--tc-space-4)",
        ...(onClick ? { cursor: "pointer" } : {}),
        ...style,
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

/** 섹션 헤더 */
export function SectionTitle({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex justify-between items-center py-1">
      <h2 className="text-[15px] font-bold m-0" style={{ color: "var(--tc-text)" }}>
        {children}
      </h2>
      {right}
    </div>
  );
}

/** KPI 카드 */
export function KpiCard({
  label,
  value,
  sub,
  color,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="rounded-xl flex flex-col items-center justify-center py-3 px-2"
      style={{
        background: "var(--tc-surface)",
        border: "1px solid var(--tc-border)",
        boxShadow: "var(--tc-shadow-sm)",
        cursor: onClick ? "pointer" : undefined,
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <span
        className="text-lg font-bold leading-tight"
        style={{ color: color ?? "var(--tc-text)" }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[10px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
          {sub}
        </span>
      )}
      <span className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

/** 탭 바 (세그먼트형) */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex rounded-lg overflow-hidden"
      style={{
        border: "1px solid var(--tc-border)",
        background: "var(--tc-surface-soft)",
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className="flex-1 text-[13px] font-semibold py-2 cursor-pointer"
          style={{
            border: "none",
            background: value === t.key ? "var(--tc-primary)" : "transparent",
            color: value === t.key ? "#fff" : "var(--tc-text-secondary)",
            transition: "all 100ms ease",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** 리스트 아이템 (네비게이션용) */
export function ListItem({
  children,
  onClick,
  right,
}: {
  children: ReactNode;
  onClick?: () => void;
  right?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl w-full text-left cursor-pointer"
      style={{
        padding: "var(--tc-space-3) var(--tc-space-4)",
        background: "var(--tc-surface)",
        border: "1px solid var(--tc-border)",
        boxShadow: "var(--tc-shadow-sm)",
      }}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {right}
    </button>
  );
}

/** 뒤로가기 버튼 */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center p-1 cursor-pointer shrink-0"
      style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
