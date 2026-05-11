// PATH: src/app_admin/domains/landing/pages/PublicLandingPage.tsx
// 공개 랜딩페이지. 게시된 설정을 읽어 적절한 템플릿으로 렌더링.
//
// 로그인된 학원 admin/owner가 진입하면 우하단 floating 컨트롤로 콘솔 진입 가능.
// 일반 학생/학부모/외부인에게는 컨트롤 안 보임.
//
// 랜딩 도메인 inline style 면제 (페이지 spinner + floating fab은 템플릿과 분리된 격리 컴포넌트).
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { fetchLandingPublic } from "../api";
import { getTemplateComponent } from "../templates";
import type { LandingPublicResponse } from "../types";
import LandingRoleFab from "../components/LandingRoleFab";
import NoticePopup from "../components/NoticePopup";
import { setLandingMeta as setMeta } from "../utils/seoMeta";
import { scrollToLandingSection } from "../utils/scrollToSection";

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

  // hash → section scroll. /landing 외 페이지(reports 등)에서 nav 메뉴 누르면 /landing#features 로
  // 이동하므로, mount 후 sections 렌더 끝나면 해당 section을 찾아 스크롤. retry: 비동기 fetch 후
  // section[data-stype] 렌더 시점에 element 못 찾는 경우 대비.
  useEffect(() => {
    if (state.loading || !state.data?.config) return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    let tries = 0;
    const tryScroll = () => {
      if (scrollToLandingSection(hash, { updateHash: false })) return;
      if (tries++ < 20) setTimeout(tryScroll, 100);
    };
    setTimeout(tryScroll, 100);
  }, [state.loading, state.data]);

  // 동적 PWA manifest (#55) — tenant별 brand_name/theme/icon 반영.
  // 정적 /manifest.json은 fallback, 학원 도메인에서는 backend dynamic으로 swap.
  useEffect(() => {
    if (!state.data?.has_landing) return;
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || "";
    const dyn = `${apiBase}/api/v1/core/landing/manifest.json`;
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = dyn;
    // theme-color도 학원 primary로 swap
    const primary = state.data.config?.primary_color;
    if (primary) {
      let tc = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (!tc) {
        tc = document.createElement("meta");
        tc.name = "theme-color";
        document.head.appendChild(tc);
      }
      tc.content = primary;
    }
  }, [state.data]);

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
      <NoticePopup notice={state.data.config?.notice_popup} />
      <LandingRoleFab />
    </>
  );
}

