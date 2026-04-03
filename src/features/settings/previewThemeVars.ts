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
    "--pv-page": "#f0f4fa",
    "--pv-panel": "#ffffff",
    "--pv-border": "rgba(0,0,0,0.08)",
    "--pv-primary": "#2563eb",

    "--pv-sidebar-bg": "#1e3a5f",
    "--pv-sidebar-active-bg": "rgba(255,255,255,0.15)",
    "--pv-sidebar-muted": "rgba(176,192,216,0.7)",
  },

  "kakao-business": {
    "--pv-canvas": "#ffffff",
    "--pv-page": "#f8fafc",
    "--pv-panel": "#ffffff",
    "--pv-border": "rgba(0,0,0,0.08)",
    "--pv-primary": "#5c2d0e",

    "--pv-sidebar-bg": "#FBE300",
    "--pv-sidebar-active-bg": "#3B1E1E",
    "--pv-sidebar-muted": "rgba(59,30,30,0.45)",
  },

  "naver-works": {
    "--pv-canvas": "#ffffff",
    "--pv-page": "#f8fafc",
    "--pv-panel": "#ffffff",
    "--pv-border": "rgba(0,0,0,0.08)",
    "--pv-primary": "#0aba90",

    "--pv-sidebar-bg": "#14532d",
    "--pv-sidebar-active-bg": "#ffffff",
    "--pv-sidebar-muted": "rgba(240,253,244,0.55)",
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
    "--pv-canvas": "#0a1628",
    "--pv-page": "#0a1628",
    "--pv-panel": "#132d4f",
    "--pv-border": "rgba(207,224,255,0.14)",
    "--pv-primary": "#3b82f6",

    "--pv-sidebar-bg": "#0f2847",
    "--pv-sidebar-active-bg": "rgba(96,165,250,0.22)",
    "--pv-sidebar-muted": "rgba(207,224,255,0.40)",
  },

  "youtube-studio": {
    "--pv-canvas": "#121214",
    "--pv-page": "#121214",
    "--pv-panel": "#1a1a1e",
    "--pv-border": "rgba(250,250,250,0.12)",
    "--pv-primary": "#8b7cf8",

    "--pv-sidebar-bg": "#16161a",
    "--pv-sidebar-active-bg": "rgba(139,124,248,0.20)",
    "--pv-sidebar-muted": "rgba(250,250,250,0.35)",
  },

  "ivory-office": {
    "--pv-canvas": "#ffffff",
    "--pv-page": "#faf9f7",
    "--pv-panel": "#ffffff",
    "--pv-border": "rgba(0,0,0,0.08)",
    "--pv-primary": "#b5651d",

    "--pv-sidebar-bg": "#f5f2ed",
    "--pv-sidebar-active-bg": "rgba(181,101,29,0.14)",
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
    "--pv-canvas": "#0a0e1a",
    "--pv-page": "#0a0e1a",
    "--pv-panel": "#0f1525",
    "--pv-border": "rgba(196,216,232,0.14)",
    "--pv-primary": "#38bdf8",

    "--pv-sidebar-bg": "#0d1220",
    "--pv-sidebar-active-bg": "rgba(56,189,248,0.18)",
    "--pv-sidebar-muted": "rgba(196,216,232,0.40)",
  },
};
