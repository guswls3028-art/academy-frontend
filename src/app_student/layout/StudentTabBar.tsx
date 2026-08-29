/**
 * 하단 탭바 - 5개: 홈 | 영상 | 일정 | 알림 | 소식·자료
 * 유튜브 모바일형, 아이콘 + 라벨
 */
import type { ComponentType, SVGProps } from "react";
import { NavLink } from "react-router";

import type { NotificationCounts } from "@student/domains/notifications/api/notifications.api";
import { useNotificationCounts } from "@student/domains/notifications/hooks/useNotificationCounts";
import { cx } from "@/shared/utils/cx";
import { IconBell, IconBoard, IconCalendar, IconHome, IconPlay } from "../shared/ui/icons/Icons";
import NotificationBadge from "../shared/ui/components/NotificationBadge";
import styles from "./StudentTabBar.module.css";

type TabIcon = ComponentType<SVGProps<SVGSVGElement>>;

type StudentTabItem = {
  to: string;
  label: string;
  Icon: TabIcon;
  badgeKey?: keyof NotificationCounts;
};

const tabs: StudentTabItem[] = [
  { to: "/student/dashboard", label: "홈", Icon: IconHome },
  { to: "/student/video", label: "영상", Icon: IconPlay },
  { to: "/student/sessions", label: "일정", Icon: IconCalendar },
  { to: "/student/notifications", label: "알림", Icon: IconBell, badgeKey: "total" },
  { to: "/student/community?tab=notice", label: "소식·자료", Icon: IconBoard },
];

export default function StudentTabBar() {
  const { data: counts, isLoading, isError } = useNotificationCounts();

  return (
    <nav
      aria-label="하단 메뉴"
      className={cx("stu-tabbar", styles.root)}
      data-analytics-placement="student.bottom-tab"
    >
      <div className={styles.inner}>
        {tabs.map(({ to, label, Icon, badgeKey }) => {
          const badgeCount = !isLoading && !isError && badgeKey && counts ? counts[badgeKey] : 0;
          const accessibleLabel = badgeKey
            ? isLoading
              ? "알림 수 확인 중"
              : isError
                ? "알림 수 확인 실패"
                : badgeCount > 0
                  ? `알림, ${badgeCount}개`
                  : "알림"
            : undefined;

          return (
            <NavLink
              key={to}
              to={to}
              aria-label={accessibleLabel}
              className={({ isActive }) => cx("stu-tabbar__link", styles.link, isActive && styles.linkActive)}
            >
              <span className={styles.iconSlot} aria-hidden="true">
                <Icon className={styles.icon} />
                {badgeCount > 0 && <NotificationBadge count={badgeCount} />}
                {badgeKey && isLoading && <span className={styles.badgeLoading} />}
                {badgeKey && isError && <span className={styles.badgeError}>!</span>}
              </span>
              <span className={styles.label}>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
