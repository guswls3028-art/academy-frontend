/**
 * PATH: src/app_teacher/layout/TeacherTabBar.tsx
 * 하단 탭 — 대시보드 | 학생 | 강의 | 커뮤니티 (4탭, 사이드바는 헤더에서 열기)
 * 용어·순서: PC 사이드바 SSOT와 통일
 */
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
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
  { to: "/teacher", label: "대시보드", icon: <Home size={ICON.lg} />, end: true },
  { to: "/teacher/students", label: "학생", icon: <Users size={ICON.lg} /> },
  { to: "/teacher/classes", label: "강의", icon: <BookOpen size={ICON.lg} /> },
  { to: "/teacher/comms", label: "커뮤니티", icon: <MessageSquare size={ICON.lg} />, hasBadge: true },
];

export default function TeacherTabBar() {
  const { counts } = useTeacherPendingCounts();
  const badge = counts?.total ?? 0;

  return (
    <nav aria-label="하단 메뉴" className={styles.nav}>
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
              {t.hasBadge && badge > 0 && (
                <span className={styles.badge}>
                  {badge > 99 ? "99+" : badge}
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
