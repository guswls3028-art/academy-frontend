/**
 * PATH: src/app_teacher/layout/TeacherDrawer.tsx
 * 사이드 드로어 — PC 사이드바 구조 1:1 매칭. 4그룹 + Lucide 아이콘
 */
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { setPreferAdmin } from "@/core/router/MobileTeacherRedirect";
import { useAdminNotificationCounts } from "@admin/domains/admin-notifications/useAdminNotificationCounts";
import {
  Home, Users, BookOpen, Activity,
  ClipboardList, Award, Video, MessageSquare,
  FileText, Bell, User, Settings, Send,
  Monitor, LogOut, AlertCircle, X,
} from "@teacher/shared/ui/Icons";

interface Props {
  open: boolean;
  onClose: () => void;
}

/* PC 사이드바 4그룹 구조 */
type MenuItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

export default function TeacherDrawer({ open, onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearAuth } = useAuth();
  const { counts } = useAdminNotificationCounts();

  const menuGroups: MenuGroup[] = [
    {
      title: "주요 메뉴",
      items: [
        { label: "대시보드", path: "/teacher", icon: <Home size={18} /> },
        { label: "학생", path: "/teacher/students", icon: <Users size={18} /> },
        { label: "강의", path: "/teacher/classes", icon: <BookOpen size={18} /> },
        { label: "클리닉", path: "/teacher/clinic", icon: <Activity size={18} /> },
      ],
    },
    {
      title: "학습 · 콘텐츠",
      items: [
        { label: "시험 / 과제", path: "/teacher/exams", icon: <ClipboardList size={18} /> },
        { label: "성적 조회", path: "/teacher/results", icon: <Award size={18} /> },
        { label: "영상", path: "/teacher/videos", icon: <Video size={18} /> },
        { label: "커뮤니티", path: "/teacher/comms", icon: <MessageSquare size={18} />, badge: counts?.total },
      ],
    },
    {
      title: "관리",
      items: [
        { label: "상담 메모", path: "/teacher/counseling", icon: <FileText size={18} /> },
        { label: "발송 이력", path: "/teacher/message-log", icon: <Send size={18} /> },
        { label: "알림 센터", path: "/teacher/notifications", icon: <Bell size={18} />, badge: counts?.total },
      ],
    },
    {
      title: "설정",
      items: [
        { label: "내 프로필", path: "/teacher/profile", icon: <User size={18} /> },
        { label: "설정", path: "/teacher/settings", icon: <Settings size={18} /> },
      ],
    },
  ];

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const handleNav = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleDesktopSwitch = () => {
    onClose();
    setPreferAdmin(true);
    navigate("/admin");
  };

  const handleLogout = () => {
    onClose();
    clearAuth();
    navigate("/login");
  };

  const isActive = (path: string) => {
    if (path === "/teacher") return location.pathname === "/teacher";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: "var(--tc-z-overlay)" as any,
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(2px)",
            transition: "opacity var(--tc-motion-base)",
          }}
        />
      )}

      {/* Drawer panel — PC 사이드바 스타일 */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "min(280px, 80vw)",
          zIndex: "calc(var(--tc-z-overlay) + 1)" as any,
          background: "var(--tc-bg)",
          boxShadow: open ? "4px 0 24px rgba(0,0,0,0.12)" : "none",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          paddingTop: "var(--tc-safe-top)",
        }}
      >
        {/* Header — 사이드바 로고 영역 대응 */}
        <div
          style={{
            padding: "var(--tc-space-4) var(--tc-space-4)",
            borderBottom: "1px solid var(--tc-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--tc-text)", letterSpacing: "-0.3px" }}>
            메뉴
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              color: "var(--tc-text-muted)",
              display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Grouped menu — PC 사이드바 구조 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "var(--tc-space-2) 0" }}>
          {menuGroups.map((group, gi) => (
            <div key={group.title}>
              {/* Group header */}
              <div
                style={{
                  padding: "var(--tc-space-3) var(--tc-space-4) var(--tc-space-1)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--tc-text-muted)",
                  letterSpacing: "0.3px",
                  textTransform: "uppercase",
                }}
              >
                {group.title}
              </div>

              {/* Items */}
              {group.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "10px var(--tc-space-4)",
                      margin: "1px 0",
                      background: active ? "var(--tc-primary-bg)" : "none",
                      border: "none",
                      borderLeft: active ? "3px solid var(--tc-primary)" : "3px solid transparent",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: active ? 600 : 400,
                      color: active ? "var(--tc-primary)" : "var(--tc-text)",
                      textAlign: "left",
                      transition: "all 80ms ease",
                    }}
                  >
                    <span style={{ color: active ? "var(--tc-primary)" : "var(--tc-text-muted)", display: "flex" }}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge != null && item.badge > 0 && (
                      <span
                        style={{
                          minWidth: 18,
                          height: 18,
                          lineHeight: "18px",
                          fontSize: 10,
                          fontWeight: 700,
                          textAlign: "center",
                          borderRadius: 9,
                          padding: "0 5px",
                          background: "var(--tc-danger)",
                          color: "#fff",
                        }}
                      >
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Divider between groups */}
              {gi < menuGroups.length - 1 && (
                <div style={{ height: 1, background: "var(--tc-border)", margin: "var(--tc-space-2) var(--tc-space-4)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        <div style={{ borderTop: "1px solid var(--tc-border)", padding: "var(--tc-space-2) 0" }}>
          {/* Desktop switch */}
          <button
            onClick={handleDesktopSwitch}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "10px var(--tc-space-4)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              color: "var(--tc-primary)",
              textAlign: "left",
            }}
          >
            <Monitor size={18} />
            데스크톱 버전
          </button>

          {/* Bug report */}
          <button
            onClick={() => {
              onClose();
              document.dispatchEvent(new Event("ui:bugreport:open"));
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "10px var(--tc-space-4)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              color: "var(--tc-text-secondary)",
              textAlign: "left",
            }}
          >
            <AlertCircle size={18} />
            문제 신고
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "10px var(--tc-space-4)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              color: "var(--tc-danger)",
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            <LogOut size={18} />
            로그아웃
          </button>
        </div>
      </div>
    </>
  );
}
