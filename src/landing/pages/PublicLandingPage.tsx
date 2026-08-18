// PATH: src/app_admin/domains/landing/pages/PublicLandingPage.tsx
// 공개 랜딩페이지. 게시된 설정을 읽어 적절한 템플릿으로 렌더링.
//
// 로그인된 학원 admin/owner가 진입하면 우하단 floating 컨트롤로 콘솔 진입 가능.
// 일반 학생/학부모/외부인에게는 컨트롤 안 보임.
//
// 랜딩 도메인 inline style 면제 (페이지 spinner + floating fab은 템플릿과 분리된 격리 컴포넌트).
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { fetchLandingPublic } from "../api";
import { getTemplateComponent } from "../templates";
import type { LandingPublicResponse } from "../types";
import LandingRoleFab from "../components/LandingRoleFab";
import LandingInlineEditorFab from "../components/LandingInlineEditorFab";
import NoticePopup from "../components/NoticePopup";
import { setLandingMeta as setMeta } from "../utils/seoMeta";
import { scrollToLandingSection } from "../utils/scrollToSection";
import type { LandingConfig } from "../types";

type PublicLandingState =
  | { status: "loading"; data: null }
  | { status: "error"; data: null }
  | { status: "ready"; data: LandingPublicResponse };

export default function PublicLandingPage() {
  const [state, setState] = useState<PublicLandingState>({
    status: "loading",
    data: null,
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null });
    fetchLandingPublic()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", data: null });
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  // hash → section scroll. /landing 외 페이지(reports 등)에서 nav 메뉴 누르면 /landing#features 로
  // 이동하므로, mount 후 sections 렌더 끝나면 해당 section을 찾아 스크롤. retry: 비동기 fetch 후
  // section[data-stype] 렌더 시점에 element 못 찾는 경우 대비.
  useEffect(() => {
    if (state.status !== "ready" || !state.data.config) return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    let tries = 0;
    const tryScroll = () => {
      if (scrollToLandingSection(hash, { updateHash: false })) return;
      if (tries++ < 20) setTimeout(tryScroll, 100);
    };
    setTimeout(tryScroll, 100);
  }, [state]);

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

      const desc = [config.tagline, config.subtitle].filter(Boolean).join(" · ") || `${config.brand_name} 학원 안내`;
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

  if (state.status === "loading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#fff", gap: 16 }}>
        <div data-landing-spinner style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } } @media (prefers-reduced-motion: reduce) { [data-landing-spinner] { animation: none !important; } }`}</style>
      </div>
    );
  }

  if (state.status === "error") {
    return <LandingConnectionError onRetry={() => setReloadKey((current) => current + 1)} />;
  }

  // 랜딩 없거나, 설정이 불완전하면 로그인으로 이동
  if (!state.data.has_landing || !state.data.config || !state.data.config.brand_name) {
    return <Navigate to="/login" replace />;
  }

  // 학원장이 어드민에서 입력한 LandingConfig가 SSOT. hostname 기반 override 없음.
  const baseConfig = state.data.config;
  const effectiveTemplateKey = state.data.template_key || "minimal_tutor";
  const Template = getTemplateComponent(effectiveTemplateKey);
  return (
    <PublicLandingContent
      template={Template}
      initialConfig={baseConfig}
      notice={baseConfig?.notice_popup}
    />
  );
}

function LandingConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <main
      aria-labelledby="landing-connection-error-title"
      style={{
        alignItems: "center",
        background: "#f5f7fa",
        color: "#0f172a",
        display: "flex",
        fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
        justifyContent: "center",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <section style={{ maxWidth: 440, textAlign: "center", width: "100%" }}>
        <div
          aria-hidden="true"
          style={{
            alignItems: "center",
            background: "#e6fffb",
            border: "1px solid #99f6e4",
            borderRadius: 999,
            color: "#0f766e",
            display: "inline-flex",
            fontSize: 24,
            height: 52,
            justifyContent: "center",
            marginBottom: 20,
            width: 52,
          }}
        >
          ↻
        </div>
        <h1 id="landing-connection-error-title" style={{ fontSize: 24, letterSpacing: "-0.03em", lineHeight: 1.35, margin: 0 }}>
          홈페이지 연결이 잠시 원활하지 않습니다
        </h1>
        <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.7, margin: "12px 0 24px" }}>
          공개된 학원 정보를 불러오지 못했습니다. 연결을 확인한 뒤 다시 불러와 주세요.
        </p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: "#0f766e",
            border: 0,
            borderRadius: 12,
            color: "#fff",
            cursor: "pointer",
            font: "inherit",
            fontSize: 15,
            fontWeight: 700,
            minHeight: 46,
            padding: "0 24px",
          }}
        >
          다시 불러오기
        </button>
        <div style={{ marginTop: 16 }}>
          <Link to="/login" style={{ color: "#475569", fontSize: 13, textUnderlineOffset: 3 }}>
            로그인으로 이동
          </Link>
        </div>
      </section>
    </main>
  );
}

/** inline editor가 config을 partial merge로 update할 수 있게 state owner 분리.
 *  학원장 시점 우상단 톱니바퀴 → drawer 입력 시 즉시 Template re-render WYSIWYG. */
function PublicLandingContent({ template: Template, initialConfig, notice }: {
  template: React.ComponentType<{ config: LandingConfig }>;
  initialConfig: LandingConfig;
  notice: unknown;
}) {
  const [config, setConfig] = useState<LandingConfig>(initialConfig);
  const onConfigPreview = (partial: Partial<LandingConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };
  return (
    <>
      <Template config={config} />
      <NoticePopup notice={notice as never} />
      <LandingRoleFab />
      <LandingInlineEditorFab config={config} onConfigPreview={onConfigPreview} />
    </>
  );
}
