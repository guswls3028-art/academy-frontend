// PATH: src/app_teacher/shared/ui/Card.tsx
// 공용 카드/섹션 — 데스크톱 ds-section/ds-panel 모바일 대응
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { ICON } from "@/shared/ui/ds";
import { cx } from "@/shared/utils/cx";
import { ChevronLeft } from "@teacher/shared/ui/Icons";
import styles from "./Card.module.css";

const KPI_VALUE_COLOR_CLASS: Record<string, string> = {
  "var(--tc-primary)": styles.kpiValuePrimary,
  "var(--tc-success)": styles.kpiValueSuccess,
  "var(--tc-danger)": styles.kpiValueDanger,
  "var(--tc-info)": styles.kpiValueInfo,
  "var(--tc-text-muted)": styles.kpiValueMuted,
  "var(--tc-text-secondary)": styles.kpiValueSecondary,
  "var(--tc-text)": "",
};

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
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={cx(styles.card, onClick && styles.clickable, className)}
      style={style}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
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
    <div className={styles.sectionTitle}>
      <h2 className={styles.sectionHeading}>
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
  const valueClass = color ? KPI_VALUE_COLOR_CLASS[color] : undefined;

  return (
    <div
      className={cx(styles.kpiCard, onClick && styles.clickable)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <span className={cx(styles.kpiValue, valueClass)}>
        {value}
      </span>
      {sub && (
        <span className={styles.kpiSub}>
          {sub}
        </span>
      )}
      <span className={styles.kpiLabel}>
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
    <div className={styles.tabBar}>
      {tabs.map((t) => (
        <button
          type="button"
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cx(styles.tabButton, value === t.key && styles.tabButtonActive)}
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
      type="button"
      onClick={onClick}
      className={styles.listItem}
    >
      <div className={styles.listItemBody}>{children}</div>
      {right}
    </button>
  );
}

/** 뒤로가기 버튼 */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.backButton}
    >
      <ChevronLeft size={ICON.md} />
    </button>
  );
}
