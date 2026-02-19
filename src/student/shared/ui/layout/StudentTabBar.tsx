/**
 * 하단 탭바 — 5개: 홈 | 영상 | 일정 | 성적 | 더보기
 * 유튜브 모바일형, 아이콘 + 라벨
 */
import { NavLink } from "react-router-dom";
import { IconHome, IconPlay, IconCalendar, IconGrade, IconMore } from "../icons/Icons";

const tabs: { to: string; label: string; icon: React.ReactNode }[] = [
  { to: "/student/dashboard", label: "홈", icon: <IconHome /> },
  { to: "/student/video", label: "영상", icon: <IconPlay /> },
  { to: "/student/sessions", label: "일정", icon: <IconCalendar /> },
  { to: "/student/grades", label: "성적", icon: <IconGrade /> },
  { to: "/student/more", label: "더보기", icon: <IconMore /> },
];

export default function StudentTabBar() {
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
        boxShadow: "var(--stu-shadow-3)",
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
        {tabs.map((t) => (
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
              transition: "color 0.15s ease",
            })}
          >
            <span style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden>
              {t.icon}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700 }}>{t.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
