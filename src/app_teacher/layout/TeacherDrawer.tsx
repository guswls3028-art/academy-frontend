/**
 * PATH: src/app_teacher/layout/TeacherDrawer.tsx
 * 사이드 드로어 — 더보기 메뉴. 부가 기능 + 데스크톱 전환 + 로그아웃
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { setPreferAdmin } from "@/core/router/MobileTeacherRedirect";

interface Props {
  open: boolean;
  onClose: () => void;
}

const MENU_ITEMS = [
  { label: "내 프로필", path: "/teacher/profile", icon: "person" },
  { label: "알림 센터", path: "/teacher/notifications", icon: "bell" },
  { label: "시험 목록", path: "/teacher/exams", icon: "clipboard" },
] as const;

export default function TeacherDrawer({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { clearAuth } = useAuth();

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
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

      {/* Drawer panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(280px, 80vw)",
          zIndex: "calc(var(--tc-z-overlay) + 1)" as any,
          background: "var(--tc-surface)",
          boxShadow: open ? "-4px 0 24px rgba(0,0,0,0.12)" : "none",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          paddingTop: "var(--tc-safe-top)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "var(--tc-space-5) var(--tc-space-4)",
            borderBottom: "1px solid var(--tc-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--tc-text)" }}>더보기</span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
              color: "var(--tc-text-secondary)",
              display: "flex",
            }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1={18} y1={6} x2={6} y2={18} />
              <line x1={6} y1={6} x2={18} y2={18} />
            </svg>
          </button>
        </div>

        {/* Menu items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "var(--tc-space-2) 0" }}>
          {MENU_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "14px var(--tc-space-4)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 15,
                color: "var(--tc-text)",
                textAlign: "left",
              }}
            >
              {item.label}
            </button>
          ))}

          <div style={{ height: 1, background: "var(--tc-border)", margin: "var(--tc-space-2) var(--tc-space-4)" }} />

          {/* Desktop switch */}
          <button
            onClick={handleDesktopSwitch}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              padding: "14px var(--tc-space-4)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 15,
              color: "var(--tc-primary)",
              textAlign: "left",
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x={2} y={3} width={20} height={14} rx={2} />
              <line x1={8} y1={21} x2={16} y2={21} />
              <line x1={12} y1={17} x2={12} y2={21} />
            </svg>
            데스크톱 버전으로 전환
          </button>
        </div>

        {/* 문제 신고 */}
        <div style={{ padding: "0 var(--tc-space-4)" }}>
          <button
            onClick={() => {
              onClose();
              document.dispatchEvent(new Event("ui:bugreport:open"));
            }}
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid var(--tc-border)",
              borderRadius: "var(--tc-radius)",
              background: "transparent",
              color: "var(--tc-text-secondary)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            문제 신고
          </button>
        </div>

        {/* Logout */}
        <div style={{ padding: "var(--tc-space-4)", borderTop: "1px solid var(--tc-border)" }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid var(--tc-border-strong)",
              borderRadius: "var(--tc-radius)",
              background: "transparent",
              color: "var(--tc-danger)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            로그아웃
          </button>
        </div>
      </div>
    </>
  );
}
