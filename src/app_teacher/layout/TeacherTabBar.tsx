/**
 * PATH: src/app_teacher/layout/TeacherTabBar.tsx
 * 하단 탭 — 대시보드 | 학생 | 강의 | 커뮤니티 (4탭, 사이드바는 헤더에서 열기)
 * 용어·순서: PC 사이드바 SSOT와 통일
 */
import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { ICON } from "@/shared/ui/ds";
import { useTeacherPendingCounts } from "@teacher/shared/hooks/useTeacherPendingCounts";
import { Home, BookOpen, Users, MessageSquare } from "@teacher/shared/ui/Icons";
import styles from "./TeacherTabBar.module.css";

type TeacherTab = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  hasBadge?: boolean;
};

const TABS: TeacherTab[] = [
  { to: "/workspace/mobile", label: "대시보드", icon: <Home size={ICON.lg} />, end: true },
  { to: "/workspace/mobile/students", label: "학생", icon: <Users size={ICON.lg} /> },
  { to: "/workspace/mobile/classes", label: "강의", icon: <BookOpen size={ICON.lg} /> },
  { to: "/workspace/mobile/comms", label: "커뮤니티", icon: <MessageSquare size={ICON.lg} />, hasBadge: true },
];

export default function TeacherTabBar() {
  const { counts, failures, isLoading, isError } = useTeacherPendingCounts();
  const badge = counts?.total ?? 0;
  const badgeIncomplete = isError || failures.length > 0;
  const hasBadge = isLoading || badgeIncomplete || badge > 0;
  const badgeLabel = isLoading ? "…" : badgeIncomplete ? "!" : badge > 99 ? "99+" : String(badge);
  const badgeAriaLabel = isLoading
    ? "커뮤니티 알림 집계 중"
    : badgeIncomplete
      ? "커뮤니티 알림 일부 확인 필요"
      : `커뮤니티 알림 ${badge}건`;

  return (
    <nav
      aria-label="하단 메뉴"
      className={styles.nav}
      data-analytics-placement="teacher.bottom-tab"
    >
      <div className={styles.inner}>
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.activeLink}` : styles.link
            }
          >
            <span className={styles.iconWrap}>
              {t.icon}
              {t.hasBadge && hasBadge && (
                <span className={styles.badge} aria-label={badgeAriaLabel}>
                  {badgeLabel}
                </span>
              )}
            </span>
            <span className={styles.label}>{t.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
