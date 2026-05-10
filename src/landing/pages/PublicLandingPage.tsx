// PATH: src/app_admin/domains/landing/pages/PublicLandingPage.tsx
// 공개 랜딩페이지. 게시된 설정을 읽어 적절한 템플릿으로 렌더링.
//
// 로그인된 학원 admin/owner가 진입하면 우하단 floating 컨트롤로 콘솔 진입 가능.
// 일반 학생/학부모/외부인에게는 컨트롤 안 보임.
//
// 랜딩 도메인 inline style 면제 (페이지 spinner + floating fab은 템플릿과 분리된 격리 컴포넌트).
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
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

  // Document title 설정
  useEffect(() => {
    if (state.data?.config?.brand_name) {
      document.title = state.data.config.brand_name;

      // OG meta tags 동적 설정 (SPA 한계 내에서 최선)
      const config = state.data.config;
      setMeta("og:title", config.brand_name);
      if (config.tagline) setMeta("og:description", config.tagline);
      if (config.tagline) setMeta("description", config.tagline);
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
  if (!isAuthenticated) return null;
  // role 확인: owner/admin만. 학생/학부모/teacher는 노출 X.
  // backend SSOT는 tenantRole (TenantMembership.role).
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();
  if (role !== "owner" && role !== "admin" && !u?.is_superuser) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "flex-end",
      }}
    >
      <Link
        to="/admin/settings/landing"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "12px 20px",
          background: "rgba(15,23,42,0.92)",
          color: "#fff",
          borderRadius: 999,
          fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em",
          textDecoration: "none",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06) inset",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
        }}
        title="홈페이지 꾸미기 페이지로 이동"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        홈페이지 꾸미기
      </Link>
      <Link
        to="/admin"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 14px",
          background: "rgba(255,255,255,0.85)",
          color: "#0f172a",
          borderRadius: 999,
          fontSize: 12, fontWeight: 600,
          textDecoration: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
        }}
        title="학원 관리실로 돌아가기"
      >
        관리실로 →
      </Link>
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
