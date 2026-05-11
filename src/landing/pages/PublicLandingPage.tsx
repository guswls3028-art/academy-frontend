// PATH: src/app_admin/domains/landing/pages/PublicLandingPage.tsx
// 공개 랜딩페이지. 게시된 설정을 읽어 적절한 템플릿으로 렌더링.
//
// 로그인된 학원 admin/owner가 진입하면 우하단 floating 컨트롤로 콘솔 진입 가능.
// 일반 학생/학부모/외부인에게는 컨트롤 안 보임.
//
// 랜딩 도메인 inline style 면제 (페이지 spinner + floating fab은 템플릿과 분리된 격리 컴포넌트).
/* eslint-disable no-restricted-syntax */

import { useEffect, useState, useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import { fetchLandingPublic } from "../api";
import { getTemplateComponent } from "../templates";
import type { LandingPublicResponse } from "../types";
import useAuth from "@/auth/hooks/useAuth";

export default function PublicLandingPage() {
  const [state, setState] = useState<{ loading: boolean; data: LandingPublicResponse | null }>({
    loading: true,
    data: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetchLandingPublic()
      .then((data) => {
        if (!cancelled) setState({ loading: false, data });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, data: null });
      });
    return () => { cancelled = true; };
  }, []);

  // Document title + OG meta — SEO 강화
  useEffect(() => {
    if (state.data?.config?.brand_name) {
      const config = state.data.config;
      const titleParts = [config.brand_name];
      if (config.tagline) titleParts.unshift(config.tagline);
      const titleStr = titleParts.join(" — ");
      document.title = titleStr;

      const desc = [config.tagline, config.subtitle].filter(Boolean).join(" · ") || `${config.brand_name} — 학원플러스 SaaS`;
      setMeta("description", desc);
      setMeta("og:title", titleStr);
      setMeta("og:description", desc);
      setMeta("og:type", "website");
      setMeta("og:url", window.location.href);
      setMeta("og:site_name", config.brand_name);
      if (config.logo_url) setMeta("og:image", config.logo_url);
      if (config.hero_image_url) setMeta("og:image", config.hero_image_url);
      // Twitter card
      setMeta("twitter:card", "summary_large_image");
      setMeta("twitter:title", titleStr);
      setMeta("twitter:description", desc);
    }
    return () => { document.title = "학원플러스"; };
  }, [state.data]);

  if (state.loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#fff", gap: 16 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // 랜딩 없거나, 설정이 불완전하면 로그인으로 이동
  if (!state.data?.has_landing || !state.data.config || !state.data.config.brand_name) {
    return <Navigate to="/login" replace />;
  }

  const Template = getTemplateComponent(state.data.template_key || "minimal_tutor");
  return (
    <>
      <Template config={state.data.config} />
      <LandingAdminFab />
    </>
  );
}

/** 로그인된 학원 admin/owner에게만 보이는 우하단 floating 액션.
 * 학원장이 자기 도메인에서 랜딩 보면서 바로 편집 콘솔로 점프. 외부인에겐 안 보임.
 */
function LandingAdminFab() {
  const { user, isAuthenticated } = useAuth();
  // ?preview=public 쿼리 → 학원장이 외부인 시점으로 페이지 보고 싶을 때. fab 숨김.
  const isPreviewPublic = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "public";
  if (!isAuthenticated) return null;
  if (isPreviewPublic) return <PreviewPublicBanner />;
  // role 확인: owner/admin만. 학생/학부모/teacher는 노출 X.
  // backend SSOT는 tenantRole (TenantMembership.role).
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();
  if (role !== "owner" && role !== "admin" && !u?.is_superuser) return null;

  return <LandingAdminFabCollapsible />;
}

/** 학원장 floating action bar — collapsed가 default(작은 single icon).
 * 클릭 시 panel slide-up + actions 펼침. 사용자 요청(2026-05-11): 큰 button 3개가
 * 항상 노출되니 학원장 본인이 랜딩 콘텐츠 검수할 때 시야 가림 → nexon dnfm 스타일의
 * minimal 토글 nav. localStorage로 사용자 선호 기억(다음 진입 시 자동 적용). */
function LandingAdminFabCollapsible() {
  const STORAGE_KEY = "landing-fab-open";
  const [open, setOpen] = useState<boolean>(() => {
    try { return window.localStorage.getItem(STORAGE_KEY) === "1"; }
    catch { return false; }
  });
  const persistOpen = (next: boolean) => {
    setOpen(next);
    try { window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
  };

  // panel 외부 클릭 시 collapse
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        persistOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "flex-end",
        fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
      }}
    >
      {open && (
        <>
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
          <Link
            to="/admin/settings/landing"
            onClick={() => persistOpen(false)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "8px 14px",
              background: "rgba(15,23,42,0.92)",
              color: "#fff",
              borderRadius: 999,
              fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
              textDecoration: "none",
              boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
            title="홈페이지 꾸미기 페이지로 이동"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            홈페이지 꾸미기
          </Link>
          <Link
            to="/admin"
            onClick={() => persistOpen(false)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "8px 14px",
              background: "rgba(255,255,255,0.92)",
              color: "#0f172a",
              borderRadius: 999,
              fontSize: 13, fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            title="학원 관리실로 이동"
          >
            관리실로 →
          </Link>
        </>
      )}
      <button
        type="button"
        onClick={() => persistOpen(!open)}
        data-testid="landing-admin-fab-toggle"
        aria-label={open ? "메뉴 닫기" : "학원장 메뉴 열기"}
        title={open ? "메뉴 닫기" : "학원장 메뉴 — 관리실 / 홈페이지 꾸미기"}
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
        {/* + icon — open 시 rotate 45° → x icon */}
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

/** meta 태그 동적 설정 헬퍼 */
function setMeta(name: string, content: string) {
  const isOg = name.startsWith("og:");
  const selector = isOg ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    if (isOg) el.setAttribute("property", name);
    else el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
