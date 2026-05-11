// PATH: src/landing/components/LandingRoleFab.tsx
// 학원 랜딩 페이지 우하단 floating action bar — role별 진입 동선 SSOT.
//
// 사용자 요청(2026-05-11): 학원장이 매치업 보고서 작성 후 홈페이지 ↔ 콘솔 오가기 자유롭고
// 편리하게. 학생도 마찬가지 홈페이지 ↔ 학생앱 오가기 편리하게.
//
// - 모든 랜딩 페이지(PublicLandingPage / Reports list / Reports detail)에서 사용.
// - 비로그인 외부인에겐 안 보임.
// - role별 액션 SSOT — owner/admin/teacher/student/parent/assistant 각각 다른 진입.
// - collapsed default, 클릭 시 panel slide-up. localStorage로 사용자 선호 기억.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";

type RoleAction = {
  key: string;
  label: string;
  to: string;
  title: string;
  emphasis?: boolean; // 강조 = 흰 배경 + 짙은 텍스트(primary action)
  icon?: React.ReactNode;
};

/** role별 액션 SSOT. backend role(TenantMembership.role) 기준. */
function actionsForRole(role: string, isSuperuser: boolean): RoleAction[] {
  if (isSuperuser || role === "owner" || role === "admin") {
    return [
      {
        key: "landing-edit", label: "홈페이지 꾸미기", to: "/admin/settings/landing",
        title: "랜딩 페이지 편집 콘솔로 이동",
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        ),
      },
      {
        key: "matchup-console", label: "매치업 보고서", to: "/admin/storage/hit-reports",
        title: "매치업 적중 보고서 콘솔로 이동",
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3,17 9,11 13,15 21,7" /><polyline points="14,7 21,7 21,14" /></svg>
        ),
      },
      {
        key: "admin-console", label: "관리실로", to: "/admin",
        title: "학원 관리실로 이동", emphasis: true,
      },
    ];
  }
  if (role === "teacher" || role === "assistant") {
    return [
      {
        key: "matchup-console", label: "매치업 보고서", to: "/admin/storage/hit-reports",
        title: "매치업 적중 보고서 작성/관리",
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3,17 9,11 13,15 21,7" /><polyline points="14,7 21,7 21,14" /></svg>
        ),
      },
      {
        key: "community", label: "커뮤니티 글 작성", to: "/admin/community/board",
        title: "커뮤니티 게시판 글 작성",
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        ),
      },
      {
        key: "teacher-console", label: "강사 콘솔로", to: "/admin",
        title: "강사 콘솔로 이동", emphasis: true,
      },
    ];
  }
  if (role === "student") {
    return [
      {
        key: "student-community", label: "커뮤니티", to: "/student/community",
        title: "학생 커뮤니티",
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
        ),
      },
      {
        key: "student-home", label: "내 학생앱으로", to: "/student",
        title: "내 학생앱 메인", emphasis: true,
      },
    ];
  }
  if (role === "parent") {
    return [
      {
        key: "parent-page", label: "학부모 페이지로", to: "/student",
        title: "학부모 페이지로 이동", emphasis: true,
      },
    ];
  }
  return [];
}

/** 랜딩 페이지 우하단 role-aware fab. 모든 랜딩 페이지에서 호출. */
export default function LandingRoleFab() {
  const { user, isAuthenticated } = useAuth();
  // ?preview=public — 학원장이 외부인 시점으로 페이지 보고 싶을 때. fab 숨김 + preview 안내 배너 노출.
  const isPreviewPublic = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "public";
  if (!isAuthenticated) return null;
  if (isPreviewPublic) return <PreviewPublicBanner />;
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();
  const isSuper = !!u?.is_superuser;
  const actions = actionsForRole(role, isSuper);
  const isOwnerLike = isSuper || role === "owner" || role === "admin";
  if (!actions.length) return null;
  return <FabCollapsible actions={actions} isOwnerLike={isOwnerLike} />;
}

function FabCollapsible({ actions, isOwnerLike }: { actions: RoleAction[]; isOwnerLike: boolean }) {
  const STORAGE_KEY = "landing-fab-open";
  const [open, setOpen] = useState<boolean>(() => {
    try { return window.localStorage.getItem(STORAGE_KEY) === "1"; }
    catch { return false; }
  });
  const persistOpen = (next: boolean) => {
    setOpen(next);
    try { window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
  };

  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) persistOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "fixed", right: 16, bottom: 16, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end",
        fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
      }}
    >
      {open && (
        <>
          {/* 학원장만 외부인 시점 미리보기 — 학원장이 자기 페이지 어떻게 보이는지 검수용 */}
          {isOwnerLike && (
            <button
              type="button"
              onClick={() => { window.location.assign(`${window.location.pathname}?preview=public`); }}
              title="외부 학부모/학생이 보는 화면으로 잠시 전환"
              style={{
                padding: "7px 13px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                background: "rgba(15,23,42,0.78)", color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
              }}
            >
              외부인 시점으로 보기
            </button>
          )}
          {actions.map((a) => (
            <Link
              key={a.key}
              to={a.to}
              data-testid={`landing-fab-${a.key}`}
              onClick={() => persistOpen(false)}
              style={{
                display: "inline-flex", alignItems: "center", gap: a.emphasis ? 5 : 7,
                padding: "8px 14px",
                background: a.emphasis ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.92)",
                color: a.emphasis ? "#0f172a" : "#fff",
                borderRadius: 999,
                fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
                textDecoration: "none",
                boxShadow: a.emphasis ? "0 4px 14px rgba(0,0,0,0.12)" : "0 6px 20px rgba(0,0,0,0.22)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
              title={a.title}
            >
              {a.icon}
              {a.emphasis ? `${a.label} →` : a.label}
            </Link>
          ))}
        </>
      )}
      <button
        type="button"
        onClick={() => persistOpen(!open)}
        data-testid="landing-role-fab-toggle"
        aria-label={open ? "메뉴 닫기" : "내 콘솔 메뉴 열기"}
        title={open ? "메뉴 닫기" : "내 콘솔로 빠르게 이동"}
        style={{
          width: 42, height: 42, borderRadius: "50%",
          background: open ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.72)",
          color: "#fff", border: "1px solid rgba(255,255,255,0.12)",
          cursor: "pointer",
          boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.15s, transform 0.15s",
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}

/** ?preview=public 모드 — 학원장에게 외부 시점 안내 + 빠져나가기 */
function PreviewPublicBanner() {
  return (
    <div style={{
      position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, padding: "10px 18px", borderRadius: 999,
      background: "rgba(15,23,42,0.92)", color: "#fff",
      fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
      boxShadow: "0 8px 24px rgba(0,0,0,0.3)", backdropFilter: "blur(12px)",
      display: "inline-flex", alignItems: "center", gap: 12,
      fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
      maxWidth: "calc(100vw - 24px)",
    }}>
      <span>👀 외부 학부모 시점 미리보기</span>
      <button
        type="button"
        onClick={() => { window.location.assign(window.location.pathname); }}
        style={{
          padding: "5px 12px", borderRadius: 999, border: "none",
          background: "#fff", color: "#0f172a", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}
      >학원장 시점으로 돌아가기</button>
    </div>
  );
}
