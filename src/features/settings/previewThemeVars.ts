// PATH: src/features/settings/previewThemeVars.ts
import type React from "react";
import type { ThemeKey } from "./constants/themes";

/**
 * Preview Scope Variables (SSOT for preview only)
 * - 전역 디자인 시스템(var(--color-*)) 영향 차단 목적
 * - MiniAdminPreview는 pv-* 변수만 사용한다.
 */
export const PREVIEW_THEME_VARS: Record<ThemeKey, React.CSSProperties & Record<string, string>> = {
  "modern-white": {
    "--pv-canvas": "#ffffff",
    "--pv-page": "#f6f8fc",
    "--pv-panel": "#ffffff",
    "--pv-border": "rgba(0,0,0,0.08)",
    "--pv-primary": "#2563eb",

    "--pv-sidebar-bg": "#ffffff",
    "--pv-sidebar-active-bg": "rgba(37,99,235,0.16)",
    "--pv-sidebar-muted": "rgba(15,23,42,0.45)",
  },

  "navy-pro": {
    "--pv-canvas": "#ffffff",
    "--pv-page": "#f3f6fb",
    "--pv-panel": "#ffffff",
    "--pv-border": "rgba(0,0,0,0.08)",
    "--pv-primary": "#3b82f6",

    "--pv-sidebar-bg": "#f2f6ff",
    "--pv-sidebar-active-bg": "rgba(59,130,246,0.18)",
    "--pv-sidebar-muted": "rgba(11,23,48,0.42)",
  },

  "kakao-business": {
    "--pv-canvas": "#ffffff",
    "--pv-page": "#ffffff",
    "--pv-panel": "#ffffff",
    "--pv-border": "rgba(59,30,30,0.18)",
    "--pv-primary": "#3B1E1E",

    "--pv-sidebar-bg": "#FBE300",
    "--pv-sidebar-active-bg": "#3B1E1E",
    "--pv-sidebar-muted": "rgba(59,30,30,0.45)",
  },

  "naver-works": {
    "--pv-canvas": "#ffffff",
    "--pv-page": "#ffffff",
    "--pv-panel": "#ffffff",
    "--pv-border": "rgba(0,0,0,0.08)",
    "--pv-primary": "#14532d",

    "--pv-sidebar-bg": "#14532d",
    "--pv-sidebar-active-bg": "#ffffff",
    "--pv-sidebar-muted": "rgba(244,255,248,0.55)",
  },

  "samsung-admin": {
    "--pv-canvas": "#ffffff",
    "--pv-page": "#ffffff",
    "--pv-panel": "#ffffff",
    "--pv-border": "rgba(0,0,0,0.08)",
    "--pv-primary": "#0057d9",

    "--pv-sidebar-bg": "#0057d9",
    "--pv-sidebar-active-bg": "#e6efff",
    "--pv-sidebar-muted": "rgba(255,255,255,0.55)",
  },

  "purple-insight": {
    "--pv-canvas": "#ffffff",
    "--pv-page": "#ffffff",
    "--pv-panel": "#ffffff",
    "--pv-border": "rgba(0,0,0,0.08)",
    "--pv-primary": "#7c3aed",

    "--pv-sidebar-bg": "#4c1d95",
    "--pv-sidebar-active-bg": "#ede9fe",
    "--pv-sidebar-muted": "rgba(245,243,255,0.6)",
  },

  "minimal-mono": {
    "--pv-canvas": "#ffffff",
    "--pv-page": "#ffffff",
    "--pv-panel": "#ffffff",
    "--pv-border": "rgba(0,0,0,0.12)",
    "--pv-primary": "#0a0a0a",

    "--pv-sidebar-bg": "#ffffff",
    "--pv-sidebar-active-bg": "#0a0a0a",
    "--pv-sidebar-muted": "rgba(10,10,10,0.45)",
  },

  "dark-navy": {
    "--pv-canvas": "#071024",
    "--pv-page": "#071024",
    "--pv-panel": "#102044",
    "--pv-border": "rgba(229,239,255,0.14)",
    "--pv-primary": "#3b82f6",

    "--pv-sidebar-bg": "#06102a",
    "--pv-sidebar-active-bg": "rgba(59,130,246,0.22)",
    "--pv-sidebar-muted": "rgba(229,239,255,0.35)",
  },

  "youtube-studio": {
    "--pv-canvas": "#0b0b0c",
    "--pv-page": "#0b0b0c",
    "--pv-panel": "#17171a",
    "--pv-border": "rgba(249,250,251,0.14)",
    "--pv-primary": "#ff0000",

    "--pv-sidebar-bg": "#0f0f10",
    "--pv-sidebar-active-bg": "rgba(255,0,0,0.22)",
    "--pv-sidebar-muted": "rgba(249,250,251,0.32)",
  },

  "ivory-office": {
    "--pv-canvas": "#faf8f5",
    "--pv-page": "#f5f0ea",
    "--pv-panel": "#ffffff",
    "--pv-border": "rgba(0,0,0,0.08)",
    "--pv-primary": "#8b6914",

    "--pv-sidebar-bg": "#faf8f5",
    "--pv-sidebar-active-bg": "rgba(139,105,20,0.12)",
    "--pv-sidebar-muted": "rgba(0,0,0,0.4)",
  },

  "modern-dark": {
    "--pv-canvas": "#121212",
    "--pv-page": "#121212",
    "--pv-panel": "#1e1e1e",
    "--pv-border": "rgba(255,255,255,0.1)",
    "--pv-primary": "#2563eb",

    "--pv-sidebar-bg": "#121212",
    "--pv-sidebar-active-bg": "rgba(37,99,235,0.2)",
    "--pv-sidebar-muted": "rgba(255,255,255,0.4)",
  },

  "terminal-neon": {
    "--pv-canvas": "#0a0a0a",
    "--pv-page": "#0a0a0a",
    "--pv-panel": "#141414",
    "--pv-border": "rgba(0,255,65,0.15)",
    "--pv-primary": "#00ff41",

    "--pv-sidebar-bg": "#0a0a0a",
    "--pv-sidebar-active-bg": "rgba(0,255,65,0.15)",
    "--pv-sidebar-muted": "rgba(0,255,65,0.4)",
  },
};
