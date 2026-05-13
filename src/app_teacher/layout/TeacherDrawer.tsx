/**
 * PATH: src/app_teacher/layout/TeacherDrawer.tsx
 * 사이드 드로어 — PC 사이드바 구조 1:1 매칭. 4그룹 + Lucide 아이콘
 */
import { useEffect } from "react";
import { ICON } from "@/shared/ui/ds";
import { useNavigate, useLocation } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { setPreferAdmin } from "@/core/router/MobileTeacherRedirect";
import { useAdminNotificationCounts } from "@admin/domains/admin-notifications/useAdminNotificationCounts";
import {
  Home, Users, BookOpen, Activity,
  ClipboardList, Award, Video, MessageSquare,
  FileText, Bell, User, Settings, Send, Clock,
  Monitor, LogOut, AlertCircle, X, FolderPlus, Calendar,
  RefreshCw, Bug, Wrench,
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
  const { clearAuth, user } = useAuth();
  const { counts } = useAdminNotificationCounts();
  const isOwnerOrAdmin = user?.tenantRole === "owner" || user?.tenantRole === "admin";

  const menuGroups: MenuGroup[] = [
    {
      title: "메인",
      items: [
        { label: "대시보드", path: "/teacher", icon: <Home size={ICON.md} /> },
        { label: "학생", path: "/teacher/students", icon: <Users size={ICON.md} /> },
        { label: "강의", path: "/teacher/classes", icon: <BookOpen size={ICON.md} /> },
        { label: "클리닉", path: "/teacher/clinic", icon: <Activity size={ICON.md} /> },
        { label: "클리닉 리모컨", path: "/teacher/clinic/remote", icon: <RefreshCw size={ICON.md} /> },
        { label: "클리닉 보고서", path: "/teacher/clinic/reports", icon: <Calendar size={ICON.md} /> },
      ],
    },
    {
      title: "학습·운영",
      items: [
        { label: "시험", path: "/teacher/exams", icon: <ClipboardList size={ICON.md} /> },
        { label: "제출함", path: "/teacher/submissions", icon: <Send size={ICON.md} />, badge: counts?.recentSubmissions },
        { label: "템플릿 관리", path: "/teacher/exams/templates", icon: <FileText size={ICON.md} /> },
        { label: "시험 묶음", path: "/teacher/exams/bundles", icon: <FolderPlus size={ICON.md} /> },
        { label: "성적", path: "/teacher/results", icon: <Award size={ICON.md} /> },
        { label: "영상", path: "/teacher/videos", icon: <Video size={ICON.md} /> },
        { label: "발송 내역", path: "/teacher/message-log", icon: <Send size={ICON.md} /> },
        { label: "템플릿 저장", path: "/teacher/message-templates", icon: <FileText size={ICON.md} /> },
        ...(isOwnerOrAdmin ? [{ label: "메시지 설정", path: "/teacher/messaging-settings", icon: <Settings size={ICON.md} /> }] : []),
        { label: "자료 저장소", path: "/teacher/storage", icon: <FolderPlus size={ICON.md} /> },
        { label: "학생 인벤토리", path: "/teacher/storage/inventory", icon: <Users size={ICON.md} /> },
        { label: "상담 메모", path: "/teacher/counseling", icon: <FileText size={ICON.md} /> },
      ],
    },
    {
      title: "관리",
      items: [
        ...(isOwnerOrAdmin
          ? [
              { label: "수납", path: "/teacher/fees", icon: <Award size={ICON.md} /> },
              { label: "청구서", path: "/teacher/fees/invoices", icon: <FileText size={ICON.md} /> },
            ]
          : []),
        { label: "커뮤니티", path: "/teacher/comms", icon: <MessageSquare size={ICON.md} />, badge: counts?.total },
        { label: "타이머", path: "/teacher/tools/stopwatch", icon: <Clock size={ICON.md} /> },
        ...(isOwnerOrAdmin ? [{ label: "직원 관리", path: "/teacher/staff", icon: <Users size={ICON.md} /> }] : []),
        { label: "근태 / 지출", path: "/teacher/my-records", icon: <Clock size={ICON.md} /> },
        { label: "알림 센터", path: "/teacher/notifications", icon: <Bell size={ICON.md} />, badge: counts?.total },
        { label: "프로필", path: "/teacher/profile", icon: <User size={ICON.md} /> },
        ...(isOwnerOrAdmin ? [{ label: "결제 / 구독", path: "/teacher/billing", icon: <Award size={ICON.md} /> }] : []),
        ...(isOwnerOrAdmin ? [{ label: "학원 정보", path: "/teacher/settings/organization", icon: <Settings size={ICON.md} /> }] : []),
        { label: "테마", path: "/teacher/settings/appearance", icon: <Settings size={ICON.md} /> },
        { label: "설정", path: "/teacher/settings", icon: <Settings size={ICON.md} /> },
        { label: "PC에서 처리하는 기능", path: "/teacher/desktop-only", icon: <Monitor size={ICON.md} /> },
      ],
    },
    {
      title: "To개발자",
      items: [
        { label: "패치노트", path: "/teacher/developer", icon: <FileText size={ICON.md} /> },
        { label: "버그 제보", path: "/teacher/developer/bug", icon: <Bug size={ICON.md} /> },
        { label: "피드백", path: "/teacher/developer/feedback", icon: <MessageSquare size={ICON.md} /> },
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
            <X size={ICON.md} />
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
            <Monitor size={ICON.md} />
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
            <AlertCircle size={ICON.md} />
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
            <LogOut size={ICON.md} />
            로그아웃
          </button>
        </div>
      </div>
    </>
  );
}
