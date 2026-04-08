/**
 * 좌측 사이드 드로어 — 더보기 메뉴 (모바일 슬라이드)
 */
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { logout } from "@/features/auth/api/auth";
import {
  IconUser,
  IconBoard,
  IconClipboard,
  IconCheck,
  IconExam,
  IconGrade,
  IconLogout,
  IconClinic,
  IconSettings,
  IconFolder,
  IconPlay,
  IconCalendar,
  IconBell,
  IconNotice,
  IconFileText,
} from "@/student/shared/ui/icons/Icons";
import type { ReactNode } from "react";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
};

const NAV: { category: string; items: { label: string; to: string; icon: ReactNode }[] }[] = [
  {
    category: "학습",
    items: [
      { label: "영상", to: "/student/video", icon: <IconPlay style={{ width: 20, height: 20, flexShrink: 0 }} /> },
      { label: "성적", to: "/student/grades", icon: <IconGrade style={{ width: 20, height: 20, flexShrink: 0 }} /> },
      { label: "시험", to: "/student/exams", icon: <IconExam style={{ width: 20, height: 20, flexShrink: 0 }} /> },
      { label: "과제", to: "/student/submit/assignment", icon: <IconClipboard style={{ width: 20, height: 20, flexShrink: 0 }} /> },
    ],
  },
  {
    category: "클리닉",
    items: [
      { label: "클리닉", to: "/student/clinic", icon: <IconClinic style={{ width: 20, height: 20, flexShrink: 0 }} /> },
      { label: "클리닉 인증 패스", to: "/student/idcard", icon: <IconCheck style={{ width: 20, height: 20, flexShrink: 0 }} /> },
    ],
  },
  {
    category: "학원",
    items: [
      { label: "일정", to: "/student/sessions", icon: <IconCalendar style={{ width: 20, height: 20, flexShrink: 0 }} /> },
      { label: "공지사항", to: "/student/notices", icon: <IconNotice style={{ width: 20, height: 20, flexShrink: 0 }} /> },
      { label: "커뮤니티", to: "/student/community", icon: <IconBoard style={{ width: 20, height: 20, flexShrink: 0 }} /> },
      { label: "출결 현황", to: "/student/attendance", icon: <IconClipboard style={{ width: 20, height: 20, flexShrink: 0 }} /> },
    ],
  },
  {
    category: "나",
    items: [
      { label: "제출", to: "/student/submit", icon: <IconClipboard style={{ width: 20, height: 20, flexShrink: 0 }} /> },
      { label: "내 인벤토리", to: "/student/inventory", icon: <IconFolder style={{ width: 20, height: 20, flexShrink: 0 }} /> },
      { label: "알림", to: "/student/notifications", icon: <IconBell style={{ width: 20, height: 20, flexShrink: 0 }} /> },
      { label: "프로필", to: "/student/profile", icon: <IconUser style={{ width: 20, height: 20, flexShrink: 0 }} /> },
      { label: "설정", to: "/student/settings", icon: <IconSettings style={{ width: 20, height: 20, flexShrink: 0 }} /> },
      { label: "사용 가이드", to: "/student/guide", icon: <IconFileText style={{ width: 20, height: 20, flexShrink: 0 }} /> },
    ],
  },
];

export default function StudentDrawer({ open, onClose }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // 열릴 때 body 스크롤 방지
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 8999,
          background: "var(--stu-backdrop)",
          backdropFilter: "blur(2px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 250ms ease",
        }}
      />

      {/* 드로어 패널 */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="메뉴"
        aria-modal={open}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 9000,
          width: "min(280px, 80vw)",
          background: "var(--stu-bg)",
          borderRight: "1px solid var(--stu-border)",
          boxShadow: open ? "4px 0 24px rgba(0, 0, 0, 0.12)" : "none",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)",
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          paddingTop: "var(--stu-safe-top)",
          paddingBottom: "var(--stu-safe-bottom)",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: "var(--stu-space-4) var(--stu-space-4) var(--stu-space-3)",
            borderBottom: "1px solid var(--stu-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 16, color: "var(--stu-text)", letterSpacing: "-0.3px" }}>
            메뉴
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              background: "transparent",
              border: "none",
              borderRadius: "var(--stu-radius-sm)",
              cursor: "pointer",
              color: "var(--stu-text-muted)",
              fontSize: 18,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 메뉴 목록 */}
        <div style={{ flex: 1, padding: "var(--stu-space-3) var(--stu-space-3)" }}>
          {NAV.map((group) => (
            <div key={group.category} style={{ marginBottom: "var(--stu-space-5)" }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--stu-text-muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "0 var(--stu-space-2)",
                  marginBottom: "var(--stu-space-2)",
                }}
              >
                {group.category}
              </div>
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--stu-space-3)",
                    padding: "12px var(--stu-space-3)",
                    minHeight: 44,
                    borderRadius: "var(--stu-radius-md)",
                    color: "var(--stu-text)",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: 14,
                    transition: "background 150ms",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--stu-surface-soft)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* 로그아웃 */}
        <div style={{ padding: "var(--stu-space-3) var(--stu-space-3)", borderTop: "1px solid var(--stu-border)" }}>
          <button
            type="button"
            onClick={() => { onClose(); logout(); }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--stu-space-3)",
              padding: "10px",
              borderRadius: "var(--stu-radius-md)",
              border: "none",
              background: "var(--stu-danger-bg)",
              color: "var(--stu-danger)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <IconLogout style={{ width: 18, height: 18 }} />
            로그아웃
          </button>
        </div>
      </div>
    </>
  );
}
