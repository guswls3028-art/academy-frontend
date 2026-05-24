// PATH: src/landing/pages/LandingMatchupBoardShell.tsx
// 매치업 공개 게시판(list/detail) 공통 랜딩 shell.
/* eslint-disable no-restricted-syntax */

import type { ReactNode } from "react";
import LandingFooter, { FOOTER_TOKENS_DARK } from "../components/LandingFooter";
import LandingRoleFab from "../components/LandingRoleFab";
import { LandingNavBar, type NavBarTokens } from "../templates/shared";
import type { LandingConfig } from "../types";

export const MATCHUP_NAV_TOKENS: NavBarTokens = {
  bg: "rgba(10,14,26,0.88)",
  border: "rgba(255,255,255,0.08)",
  textPrimary: "#F5F1E8",
  textSecondary: "#9CA3AF",
  primaryColor: "#D4A04C",
  primaryRgb: "212,160,76",
  ctaGradient: "linear-gradient(135deg, #D4A04C 0%, #B8862F 100%)",
  ctaTextColor: "#0A0E1A",
  panelBg: "#0F1525",
};

export const MATCHUP_COLORS = {
  bg: "#0A0E1A",
  bgAlt: "#0F1525",
  bgSoft: "rgba(255,255,255,0.045)",
  border: "rgba(255,255,255,0.09)",
  borderStrong: "rgba(212,160,76,0.26)",
  gold: "#D4A04C",
  textPrimary: "#F5F1E8",
  textSecondary: "#B7BEC9",
  textMuted: "#7B8494",
};

function MatchupBrandMark({ name }: { name: string }) {
  const initial = (name || "").trim().charAt(0) || "A";
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: "linear-gradient(135deg, #D4A04C 0%, #8B5E1F 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#0A0E1A",
        fontSize: 18,
        fontWeight: 900,
      }}
    >
      {initial}
    </div>
  );
}

export function MatchupCenterState({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: MATCHUP_COLORS.bg,
        color: MATCHUP_COLORS.textPrimary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
      }}
    >
      <div>{children}</div>
    </div>
  );
}

export function MatchupCenterSpin({ label = "불러오는 중..." }: { label?: string }) {
  return (
    <MatchupCenterState>
      <div
        style={{
          width: 36,
          height: 36,
          margin: "0 auto 14px",
          border: "3px solid rgba(255,255,255,0.15)",
          borderTopColor: MATCHUP_COLORS.gold,
          borderRadius: "50%",
          animation: "matchupSpin 0.6s linear infinite",
        }}
      />
      <div style={{ color: MATCHUP_COLORS.textSecondary, fontSize: 13, fontWeight: 700 }}>{label}</div>
      <style>{`@keyframes matchupSpin { to { transform: rotate(360deg) } }`}</style>
    </MatchupCenterState>
  );
}

export function MatchupLandingShell({
  cfg,
  children,
  fill = false,
}: {
  cfg: LandingConfig;
  children: ReactNode;
  fill?: boolean;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: MATCHUP_COLORS.bg,
        color: MATCHUP_COLORS.textPrimary,
        fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <LandingNavBar
        config={cfg}
        sections={cfg.sections || []}
        tokens={MATCHUP_NAV_TOKENS}
        brandMark={<MatchupBrandMark name={cfg.brand_name} />}
      />
      <main style={fill ? { flex: 1, display: "flex", flexDirection: "column" } : undefined}>{children}</main>
      <LandingFooter config={cfg} sections={cfg.sections || []} tokens={FOOTER_TOKENS_DARK} />
      <LandingRoleFab />
    </div>
  );
}
