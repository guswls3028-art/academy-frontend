// PATH: src/landing/pages/LandingBoardEditPage.tsx
// 자유게시판 글 수정 (Phase #72, 2026-05-13) — audit P0 fix.
//
// 이전: LandingBoardDetailPage 의 "수정" 버튼이 `/landing/board/${id}/edit` 로 navigate하는데
// 라우트 미등록 → 404. 본 페이지가 그 dead link 메꿈.
//
// 권한: 본인 작성 + status가 published/hidden. staff(owner/admin)는 어떤 글이든 수정 가능
// (backend `_can_edit` 와 정합). 권한 없으면 detail로 redirect.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import { fetchLandingPublic } from "../api";
import {
  fetchBoardDetail,
  updateBoardPost,
  type BoardCategory,
  type PublicBoardPostDetail,
} from "../api/publicCommunity";
import HitReportPicker from "../components/HitReportPicker";
import type { LandingPublicResponse } from "../types";
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

export default function LandingBoardEditPage() {
  const { postId } = useParams<{ postId: string }>();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const u = user as { id?: number; tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();
  const isStaff = !!u?.is_superuser || ["owner", "admin", "staff", "teacher", "assistant"].includes(role);

  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [post, setPost] = useState<PublicBoardPostDetail | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<BoardCategory>("free");
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [matchupReportIds, setMatchupReportIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchLandingPublic().then(setLanding).catch(() => setLanding(null)); }, []);

  useEffect(() => {
    const id = Number(postId);
    if (!Number.isFinite(id) || id <= 0) {
      setLoadErr("잘못된 글 번호입니다.");
      return;
    }
    fetchBoardDetail(id)
      .then((p) => {
        setPost(p);
        setTitle(p.title);
        setCategory(p.category);
        setContent(p.content);
        setIsAnonymous(p.is_anonymous);
        const ids = (p.meta as Record<string, unknown> | null)?.matchup_report_ids;
        if (Array.isArray(ids)) setMatchupReportIds(ids.filter((n) => typeof n === "number") as number[]);
      })
      .catch((e) => {
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setLoadErr(typeof detail === "string" ? detail : "글을 불러올 수 없습니다.");
      });
  }, [postId]);

  // useAuth hydrate race 방어 — hydrate 끝나기 전 redirect 금지 (#74-1 패턴 정합)
  if (authLoading) return <CenterSpin />;
  if (!isAuthenticated) return <Navigate to={`/login?next=${encodeURIComponent(`/landing/board/${postId}/edit`)}`} replace />;

  // 권한 검사 — backend 가 직렬화한 is_owner_or_author 우선, fallback 으로 staff 권한.
  const canEdit = post ? (isStaff || post.is_owner_or_author) : false;

  if (loadErr) {
    return (
      <Shell cfg={landing?.config}>
        <ErrorView title="글을 불러올 수 없습니다" body={loadErr} postId={Number(postId) || 0} />
      </Shell>
    );
  }

  if (!landing?.config || !post) return <CenterSpin />;

  if (!canEdit) {
    return (
      <Shell cfg={landing.config}>
        <ErrorView title="수정 권한이 없습니다" body="본인이 작성한 글이거나 학원 운영자만 수정할 수 있습니다." postId={post.id} />
      </Shell>
    );
  }

  const valid = title.trim().length >= 2 && content.replace(/<[^>]+>/g, "").trim().length >= 2;

  const onSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateBoardPost(post.id, {
        title: title.trim(),
        content,
        category,
        is_anonymous: isAnonymous,
        meta: matchupReportIds.length > 0 ? { matchup_report_ids: matchupReportIds } : {},
      });
      navigate(`/landing/board/${post.id}`, { replace: true });
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "수정 실패. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const border = "rgba(255,255,255,0.08)";
  const cardBg = "rgba(255,255,255,0.03)";
  const textPrimary = "#F5F1E8";
  const textSecondary = "#9CA3AF";
  const gold = "#D4A04C";

  return (
    <Shell cfg={landing.config}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ marginBottom: 20 }}>
          <Link to={`/landing/board/${post.id}`} data-testid="board-edit-back"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: textSecondary, textDecoration: "none", fontSize: 13, fontWeight: 600 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="15,18 9,12 15,6" /></svg>
            글로 돌아가기
          </Link>
        </div>

        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: textPrimary, letterSpacing: "-0.025em" }}>글 수정</h1>
        <p style={{ marginTop: 8, fontSize: 13, color: textSecondary }}>
          내용을 다듬어 저장하시면 즉시 반영됩니다.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
          style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div>
            <label style={lblStyle(textSecondary)}>카테고리</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CATEGORIES.map((c) => {
                const on = c.v === category;
                return (
                  <button key={c.v} type="button" onClick={() => setCategory(c.v)}
                    data-testid={`board-edit-cat-${c.v}`}
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

          <div>
            <label style={lblStyle(textSecondary)}>제목</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              data-testid="board-edit-title" maxLength={200}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10,
                background: cardBg, border: `1px solid ${border}`,
                color: textPrimary, fontSize: 15, fontFamily: "inherit", outline: "none",
                letterSpacing: "-0.01em",
              }}
            />
          </div>

          <div>
            <label style={lblStyle(textSecondary)}>본문</label>
            <div data-app="admin" data-testid="board-edit-content-wrap" style={LANDING_RICH_EDITOR_THEME}>
              <RichTextEditor value={content} onChange={setContent} placeholder="내용을 입력해주세요" minHeight={240} />
            </div>
          </div>

          {isStaff && (
            <HitReportPicker selected={matchupReportIds} onChange={setMatchupReportIds} max={3} />
          )}

          <label data-testid="board-edit-anonymous" style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: textSecondary, userSelect: "none" }}>
            <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: gold }}
            />
            <span>익명으로 표시</span>
          </label>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => navigate(`/landing/board/${post.id}`)}
              style={{ padding: "11px 22px", borderRadius: 999, border: `1px solid ${border}`, background: "transparent", color: textSecondary, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >취소</button>
            <button type="submit" disabled={!valid || submitting} data-testid="board-edit-submit"
              style={{
                padding: "11px 22px", borderRadius: 999, border: "none",
                background: valid && !submitting ? gold : "rgba(255,255,255,0.08)",
                color: valid && !submitting ? "#0A0E1A" : textSecondary,
                fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em",
                cursor: valid && !submitting ? "pointer" : "not-allowed",
              }}
            >{submitting ? "저장 중…" : "저장"}</button>
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

function Shell({ cfg, children }: { cfg: PublicLandingCfg | undefined; children: React.ReactNode }) {
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

// LandingPublicResponse.config 의 narrow type (templates/shared.tsx 와 정합).
type PublicLandingCfg = NonNullable<LandingPublicResponse["config"]>;

function ErrorView({ title, body, postId }: { title: string; body: string; postId: number }) {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "100px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 42, marginBottom: 14 }}>⚠️</div>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#F5F1E8", letterSpacing: "-0.02em" }}>{title}</h1>
      <p style={{ marginTop: 10, fontSize: 14, color: "#9CA3AF", lineHeight: 1.6 }}>{body}</p>
      <Link to={postId ? `/landing/board/${postId}` : "/landing/board"} style={{ display: "inline-block", marginTop: 22, padding: "11px 22px", borderRadius: 999, background: "#D4A04C", color: "#0A0E1A", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
        {postId ? "글로 돌아가기" : "자유게시판으로"}
      </Link>
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
