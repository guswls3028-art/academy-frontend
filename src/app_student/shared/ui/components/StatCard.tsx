/**
 * StatCard - 도메인 통계 카드 (공유)
 * 3-column grid로 배치. accent 색상 지원.
 */
import type { ReactNode } from "react";

import styles from "./StatCard.module.css";

type AccentTone = "success" | "danger" | "warn";
type TrendDirection = "up" | "down" | "neutral";

type StatCardProps = {
  label: string;
  value: string;
  accent?: AccentTone;
  icon?: ReactNode;
  /** 추세 표시 (예: "+5%", "-2점") */
  trend?: string;
  trendDirection?: TrendDirection;
};

const valueToneClass: Record<AccentTone, string> = {
  success: styles.valueSuccess,
  danger: styles.valueDanger,
  warn: styles.valueWarn,
};

const trendToneClass: Record<TrendDirection, string> = {
  up: styles.trendUp,
  down: styles.trendDown,
  neutral: styles.trendNeutral,
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function StatCard({ label, value, accent, icon, trend, trendDirection }: StatCardProps) {
  return (
    <div className={styles.card}>
      {icon && (
        <div className={styles.icon}>
          {icon}
        </div>
      )}
      <div className={cx(styles.value, accent && valueToneClass[accent])}>
        {value}
      </div>
      <div className={styles.label}>
        {label}
      </div>
      {trend && (
        <div className={cx(styles.trend, trendToneClass[trendDirection ?? "neutral"])}>
          {trend}
        </div>
      )}
    </div>
  );
}

/** 3-column 반응형 그리드 래퍼 */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
