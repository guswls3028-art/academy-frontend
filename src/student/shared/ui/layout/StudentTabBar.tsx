/**
 * 하단 탭바 — 5개: 홈 | 영상 | 일정 | 알림 | 더보기
 * 유튜브 모바일형, 아이콘 + 라벨
 */
import { NavLink } from "react-router-dom";
import { IconHome, IconPlay, IconCalendar, IconBell, IconMore } from "../icons/Icons";
import { useNotificationCounts } from "@/student/domains/notifications/hooks/useNotificationCounts";
import NotificationBadge from "../components/NotificationBadge";

const tabs: { to: string; label: string; icon: React.ReactNode; badgeKey?: keyof ReturnType<typeof useNotificationCounts>["data"] }[] = [
  { to: "/student/dashboard", label: "홈", icon: <IconHome /> },
  { to: "/student/video", label: "영상", icon: <IconPlay /> },
  { to: "/student/sessions", label: "일정", icon: <IconCalendar /> },
  { to: "/student/notifications", label: "알림", icon: <IconBell />, badgeKey: "total" },
  { to: "/student/more", label: "더보기", icon: <IconMore /> },
];

export default function StudentTabBar() {
  const { data: counts, isLoading } = useNotificationCounts();

  return (
    <nav
      aria-label="하단 메뉴"
      className="stu-tabbar"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: "var(--stu-z-tabbar)",
        paddingBottom: "var(--stu-safe-bottom)",
        background: "var(--stu-tabbar-bg)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid var(--stu-border)",
        /* 프리미엄: iOS 고급 앱 스타일 - shadow 제거 */
        boxShadow: "0 -1px 0 var(--stu-border)",
      }}
    >
      <div
        style={{
          height: "var(--stu-tabbar-h)",
          display: "grid",
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
          alignItems: "center",
          maxWidth: "var(--stu-page-max-w)",
          margin: "0 auto",
          padding: "0 var(--stu-space-4)",
        }}
      >
        {tabs.map((t) => {
          // 로딩 중이거나 데이터가 없으면 배지 표시 안 함
          const badgeCount = !isLoading && t.badgeKey && counts ? counts[t.badgeKey] : 0;
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className="stu-tabbar__link"
              style={({ isActive }) => ({
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                height: "100%",
                color: isActive ? "var(--stu-primary)" : "var(--stu-text-muted)",
                background: isActive ? undefined : "transparent",
                transition: "color 180ms cubic-bezier(0.4, 0, 0.2, 1), transform 180ms cubic-bezier(0.4, 0, 0.2, 1), background 180ms cubic-bezier(0.4, 0, 0.2, 1)",
                borderRadius: "var(--stu-radius-sm)",
                position: "relative",
              })}
            >
              <span style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.85, position: "relative" }} aria-hidden>
                {t.icon}
                {badgeCount > 0 && <NotificationBadge count={badgeCount} />}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700 }}>{t.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
