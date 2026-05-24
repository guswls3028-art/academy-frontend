// PATH: src/landing/pages/LandingBoardWritePage.tsx
// 자유게시판 글쓰기 — 학원 family 로그인 필수. parent 차단 (Comment-only role).
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import { fetchLandingPublic } from "../api";
import { createBoardPost, type BoardCategory } from "../api/publicCommunity";
import HitReportPicker from "../components/HitReportPicker";
import type { LandingConfig, LandingPublicResponse } from "../types";
import { LandingNavBar, type NavBarTokens } from "../templates/shared";
import LandingFooter, { FOOTER_TOKENS_DARK } from "../components/LandingFooter";
import LandingRoleFab from "../components/LandingRoleFab";

const NAV_TOKENS: NavBarTokens = {
  bg: "rgba(10,14,26,0.85)",
  border: "rgba(255,255,255,0.08)",
  textPrimary: "#F5F1E8",
  textSecondary: "#9CA3AF",
  primaryColor: "#D4A04C",
  primaryRgb: "212,160,76",
  ctaGradient: "linear-gradient(135deg, #D4A04C 0%, #B8862F 100%)",
  ctaTextColor: "#0A0E1A",
  panelBg: "#0F1525",
};

const CATEGORIES: { v: BoardCategory; label: string }[] = [
  { v: "free", label: "자유" },
  { v: "tip", label: "공부 팁" },
  { v: "story", label: "수강 이야기" },
  { v: "question", label: "질문" },
  { v: "other", label: "기타" },
];

function BrandMark({ name }: { name: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #D4A04C 0%, #8B5E1F 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0E1A", fontSize: 18, fontWeight: 800 }}>{initial}</div>
  );
}

export default function LandingBoardWritePage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();

  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<BoardCategory>("free");
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [matchupReportIds, setMatchupReportIds] = useState<number[]>([]);
  const isStaff = !!u?.is_superuser || ["owner", "admin", "staff", "teacher", "assistant"].includes(role);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchLandingPublic().then(setLanding).catch(() => setLanding(null)); }, []);

  // useAuth hydrate race 방어 — 토큰이 있어도 /core/me 완료 전에는 user=null일 수 있다.
  if (authLoading) return <CenterSpin />;
  // 비로그인 → 로그인. 학부모는 자유게시판 작성 차단(읽기만).
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role === "parent") {
    return (
      <Shell cfg={landing?.config}>
        <Refuse title="학부모님은 자유게시판 글쓰기가 제한되어 있습니다" body="대신 댓글과 좋아요로 의견을 남기실 수 있습니다." />
      </Shell>
    );
  }

  const valid = title.trim().length >= 2 && content.replace(/<[^>]+>/g, "").trim().length >= 2;

  const onSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createBoardPost({
        title: title.trim(),
        content,
        category,
        is_anonymous: isAnonymous,
        meta: matchupReportIds.length > 0 ? { matchup_report_ids: matchupReportIds } : undefined,
      });
      navigate(`/landing/board/${created.id}`, { replace: true });
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, "글 등록 실패. 잠시 후 다시 시도해주세요."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!landing?.config) {
    return <CenterSpin />;
  }

  const border = "rgba(255,255,255,0.08)";
  const cardBg = "rgba(255,255,255,0.03)";
  const textPrimary = "#F5F1E8";
  const textSecondary = "#9CA3AF";
  const gold = "#D4A04C";

  return (
    <Shell cfg={landing.config}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ marginBottom: 20 }}>
          <Link to="/landing/board" data-testid="board-write-back"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: textSecondary, textDecoration: "none", fontSize: 13, fontWeight: 600 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="15,18 9,12 15,6" /></svg>
            자유게시판
          </Link>
        </div>

        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: textPrimary, letterSpacing: "-0.025em" }}>새 글쓰기</h1>
        <p style={{ marginTop: 8, fontSize: 13, color: textSecondary }}>
          외부 학부모도 함께 읽습니다. 정성과 배려가 담긴 글로 학원 분위기를 만들어 주세요.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
          style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}
        >
          {/* 카테고리 */}
          <div>
            <label style={lblStyle(textSecondary)}>카테고리</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CATEGORIES.map((c) => {
                const on = c.v === category;
                return (
                  <button key={c.v} type="button" onClick={() => setCategory(c.v)}
                    data-testid={`board-write-cat-${c.v}`}
                    style={{
                      padding: "7px 14px", border: `1px solid ${on ? gold : border}`, borderRadius: 999, cursor: "pointer",
                      background: on ? gold : "transparent", color: on ? "#0A0E1A" : textSecondary,
                      fontSize: 12.5, fontWeight: on ? 700 : 600, letterSpacing: "-0.01em",
                    }}
                  >{c.label}</button>
                );
              })}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label style={lblStyle(textSecondary)}>제목</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              data-testid="board-write-title" maxLength={200}
              placeholder="제목을 입력해주세요 (2~200자)"
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10,
                background: cardBg, border: `1px solid ${border}`,
                color: textPrimary, fontSize: 15, fontFamily: "inherit", outline: "none",
                letterSpacing: "-0.01em",
              }}
            />
          </div>

          {/* 본문 */}
          <div>
            <label style={lblStyle(textSecondary)}>본문</label>
            <div data-app="admin" data-testid="board-write-content-wrap" style={LANDING_RICH_EDITOR_THEME}>
              <RichTextEditor value={content} onChange={setContent} placeholder="내용을 입력해주세요" minHeight={240} />
            </div>
            <p style={{ marginTop: 6, fontSize: 11, color: textSecondary }}>이미지 / 링크 / 굵게 / 리스트 등 서식을 사용할 수 있어요.</p>
          </div>

          {/* 적중보고서 첨부 — staff 전용 */}
          {isStaff && (
            <HitReportPicker selected={matchupReportIds} onChange={setMatchupReportIds} max={3} />
          )}

          {/* 익명 toggle */}
          <label data-testid="board-write-anonymous" style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: textSecondary, userSelect: "none" }}>
            <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: gold }}
            />
            <span>익명으로 등록 (작성자 이름이 "익명"으로 표시됩니다)</span>
          </label>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => navigate(-1)}
              style={{ padding: "11px 22px", borderRadius: 999, border: `1px solid ${border}`, background: "transparent", color: textSecondary, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >취소</button>
            <button type="submit" disabled={!valid || submitting} data-testid="board-write-submit"
              style={{
                padding: "11px 22px", borderRadius: 999, border: "none",
                background: valid && !submitting ? gold : "rgba(255,255,255,0.08)",
                color: valid && !submitting ? "#0A0E1A" : textSecondary,
                fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em",
                cursor: valid && !submitting ? "pointer" : "not-allowed",
              }}
            >{submitting ? "등록 중…" : "글 등록"}</button>
          </div>
        </form>
      </div>
    </Shell>
  );

  function CenterSpin() {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#D4A04C", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }
}

function Shell({ cfg, children }: { cfg?: LandingConfig; children: React.ReactNode }) {
  if (!cfg) return <>{children}</>;
  return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", color: "#F5F1E8", fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      <LandingNavBar config={cfg} sections={cfg.sections || []} tokens={NAV_TOKENS} brandMark={<BrandMark name={cfg.brand_name} />} />
      {children}
      <LandingFooter config={cfg} sections={cfg.sections || []} tokens={FOOTER_TOKENS_DARK} />
      <LandingRoleFab />
    </div>
  );
}

function Refuse({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "100px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 42, marginBottom: 14 }}>🤝</div>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#F5F1E8", letterSpacing: "-0.02em" }}>{title}</h1>
      <p style={{ marginTop: 10, fontSize: 14, color: "#9CA3AF", lineHeight: 1.6 }}>{body}</p>
      <Link to="/landing/board" style={{ display: "inline-block", marginTop: 22, padding: "11px 22px", borderRadius: 999, background: "#D4A04C", color: "#0A0E1A", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>자유게시판으로 →</Link>
    </div>
  );
}

function lblStyle(color: string): React.CSSProperties {
  return {
    display: "block", fontSize: 12, fontWeight: 700,
    color, marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase",
  };
}

const LANDING_RICH_EDITOR_THEME = {
  borderRadius: 12,
  background: "#ffffff",
  overflow: "visible",
  "--color-border-divider": "#D1D5DB",
  "--color-bg-surface": "#FFFFFF",
  "--color-bg-surface-hover": "#F8FAFC",
  "--color-bg-surface-active": "#E5E7EB",
  "--color-text-primary": "#111827",
  "--color-text-secondary": "#475569",
  "--color-text-muted": "#94A3B8",
  "--color-text-link": "#2563EB",
  "--color-brand-primary": "#D4A04C",
  "--font-sans": "inherit",
  "--letter-base": "0",
  "--radius-md": "12px",
  "--radius-sm": "8px",
  "--space-1": "4px",
  "--space-2": "8px",
  "--space-3": "12px",
  "--space-4": "16px",
} as React.CSSProperties;
