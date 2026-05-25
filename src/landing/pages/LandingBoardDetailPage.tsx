// PATH: src/landing/pages/LandingBoardDetailPage.tsx
// 자유게시판 글 상세 — 본문 + 좋아요 + 댓글.
// 비로그인 read OK. 좋아요/댓글은 학원 family 로그인 필요(LoginGuard).
/* eslint-disable no-restricted-syntax */

import DOMPurify from "dompurify";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { saveReturnPath } from "@/shared/api/axios";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import { fetchLandingPublic } from "../api";
import EmbeddedHitReportCards from "../components/EmbeddedHitReportCards";
import ReportButton from "../components/ReportButton";
import { setLandingMeta } from "../utils/seoMeta";
import {
  createReply,
  deleteBoardPost,
  deleteReply,
  fetchBoardDetail,
  fetchReplies,
  moderateBoardPost,
  toggleBoardLike,
  toggleReplyLike,
  type PublicBoardPostDetail,
  type PublicReply,
} from "../api/publicCommunity";
import type { LandingPublicResponse } from "../types";
import { LandingNavBar, type NavBarTokens } from "../templates/shared";
import LandingFooter, { FOOTER_TOKENS_DARK } from "../components/LandingFooter";
import LandingRoleFab from "../components/LandingRoleFab";
import PublicRichContentStyle, { PUBLIC_RICH_CONTENT_CLASS, PUBLIC_RICH_CONTENT_PRESERVE_LINES_CLASS } from "../components/PublicRichContentStyle";

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

function BrandMark({ name }: { name: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #D4A04C 0%, #8B5E1F 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0E1A", fontSize: 18, fontWeight: 800 }}>{initial}</div>
  );
}

export default function LandingBoardDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { isAuthenticated, user } = useAuth();
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();
  const isStaff = !!u?.is_superuser || ["owner", "admin", "staff", "teacher", "assistant"].includes(role);
  const isOwner = role === "owner" || !!u?.is_superuser;

  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [post, setPost] = useState<PublicBoardPostDetail | null>(null);
  const [replies, setReplies] = useState<PublicReply[] | null>(null);
  const [error, setError] = useState<"none" | "fetch" | "not-found">("none");
  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [moderating, setModerating] = useState(false);

  const id = Number(postId);

  useEffect(() => { fetchLandingPublic().then(setLanding).catch(() => setLanding(null)); }, []);

  const loadDetail = useCallback(() => {
    if (!Number.isFinite(id)) { setError("not-found"); return; }
    setPost(null);
    fetchBoardDetail(id)
      .then((p) => {
        setPost(p);
        // P1 audit (2026-05-14): liked 새로고침 후 ♥ 유지. 이전: 초기값 false 고정 →
        // 새로고침 시 토글 시 카운트 음수 가능. backend serializer is_liked_by_me 사용.
        setLiked(p.is_liked_by_me);
      })
      .catch((e: unknown) => {
        const s = (e as { response?: { status?: number } })?.response?.status;
        setError(s === 404 ? "not-found" : "fetch");
      });
  }, [id]);

  const loadReplies = useCallback(() => {
    if (!Number.isFinite(id)) return;
    fetchReplies({ kind: "board", id })
      .then((r) => setReplies(r.results))
      .catch(() => setReplies([]));
  }, [id]);

  useEffect(() => { loadDetail(); loadReplies(); }, [loadDetail, loadReplies]);

  // SEO — Open Graph + JSON-LD Article (Phase 3 B)
  useEffect(() => {
    if (!post || !landing?.config) return;
    const brand = landing.config.brand_name || "학원플러스";
    const plain = (post.content || "").replace(/<[^>]+>/g, "").trim().slice(0, 160);
    const title = `${post.title} — ${brand} 자유게시판`;
    document.title = title;
    setLandingMeta("description", plain);
    setLandingMeta("og:title", title);
    setLandingMeta("og:description", plain);
    setLandingMeta("og:type", "article");
    setLandingMeta("og:url", window.location.href);
    if (post.cover_image_url) setLandingMeta("og:image", post.cover_image_url);
    setLandingMeta("twitter:card", "summary_large_image");
    setLandingMeta("twitter:title", title);
    setLandingMeta("twitter:description", plain);
    // JSON-LD Article schema
    let script = document.getElementById("landing-jsonld") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "landing-jsonld";
      document.head.appendChild(script);
    }
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: plain,
      author: { "@type": "Person", name: post.display_name },
      datePublished: post.created_at,
      dateModified: post.updated_at,
      publisher: { "@type": "Organization", name: brand },
      image: post.cover_image_url || landing.config.hero_image_url || landing.config.logo_url,
    });
    return () => {
      document.title = brand;
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };
  }, [post, landing]);

  const onToggleLike = async () => {
    if (!isAuthenticated) { saveReturnPath(); navigate("/login"); return; }
    if (!post || liking) return;
    setLiking(true);
    try {
      const r = await toggleBoardLike(post.id);
      setLiked(r.liked);
      setPost({ ...post, like_count: r.like_count });
    } finally { setLiking(false); }
  };

  const onSubmitReply = async () => {
    if (!isAuthenticated) { saveReturnPath(); navigate("/login"); return; }
    const content = replyContent.trim();
    if (!content || submittingReply || !post) return;
    setSubmittingReply(true);
    try {
      await createReply({ target_kind: "board", target_id: post.id, content });
      setReplyContent("");
      loadReplies();
      setPost({ ...post, reply_count: post.reply_count + 1 });
    } catch {
      feedback.error("댓글 등록 실패. 잠시 후 다시 시도해주세요.");
    } finally { setSubmittingReply(false); }
  };

  const onDeleteReply = async (replyId: number) => {
    const ok = await confirm({
      title: "댓글 삭제",
      message: "댓글을 삭제하시겠어요?",
      confirmText: "삭제",
      cancelText: "취소",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteReply(replyId);
      loadReplies();
      if (post) setPost({ ...post, reply_count: Math.max(0, post.reply_count - 1) });
    } catch { feedback.error("삭제 실패"); }
  };

  const onLikeReply = async (replyId: number) => {
    if (!isAuthenticated) { saveReturnPath(); navigate("/login"); return; }
    try {
      const r = await toggleReplyLike(replyId);
      setReplies((prev) => prev?.map((x) => x.id === replyId ? { ...x, like_count: r.like_count } : x) ?? prev);
    } catch { /* noop */ }
  };

  const onModerate = async (patch: Parameters<typeof moderateBoardPost>[1]) => {
    if (!post || moderating) return;
    setModerating(true);
    try {
      const updated = await moderateBoardPost(post.id, patch);
      setPost(updated);
    } catch { feedback.error("모더레이션 실패"); }
    finally { setModerating(false); }
  };

  const onDeletePost = async () => {
    if (!post) return;
    const ok = await confirm({
      title: "게시글 삭제",
      message: "이 글을 삭제하시겠어요?",
      confirmText: "삭제",
      cancelText: "취소",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteBoardPost(post.id);
      navigate("/landing/board", { replace: true });
    } catch { feedback.error("삭제 실패"); }
  };

  if (!landing?.config) {
    return <CenterSpin />;
  }
  const cfg = landing.config;

  if (error === "not-found") {
    return (
      <Shell cfg={cfg}>
        <EmptyHero title="게시글을 찾을 수 없습니다" body="삭제되었거나 비공개로 전환된 글일 수 있습니다." action={{ label: "자유게시판으로 돌아가기", to: "/landing/board" }} />
      </Shell>
    );
  }

  if (!post) {
    return <Shell cfg={cfg}><CenterSpin /></Shell>;
  }

  // 톤
  const border = "rgba(255,255,255,0.08)";
  const cardBg = "rgba(255,255,255,0.03)";
  const textPrimary = "#F5F1E8";
  const textSecondary = "#9CA3AF";
  const textMuted = "#6B7280";
  const gold = "#D4A04C";

  const sanitized = DOMPurify.sanitize(post.content || "", { USE_PROFILES: { html: true } });

  return (
    <Shell cfg={cfg}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* 상단 nav */}
        <div style={{ marginBottom: 20 }}>
          <Link to="/landing/board" data-testid="board-detail-back"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: textSecondary, textDecoration: "none", fontSize: 13, fontWeight: 600 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="15,18 9,12 15,6" /></svg>
            자유게시판
          </Link>
        </div>

        {/* 본문 카드 */}
        <article data-testid="board-detail-article" style={{ padding: "32px 36px", background: cardBg, border: `1px solid ${border}`, borderRadius: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {post.is_pinned && <Chip color={gold} bg={`${gold}22`}>고정</Chip>}
            {post.is_hot && <Chip color="#ef4444" bg="rgba(239,68,68,0.12)">HOT</Chip>}
            <Chip color={textSecondary} bg="rgba(255,255,255,0.04)">{categoryLabel(post.category)}</Chip>
            {post.status !== "published" && <Chip color="#ef4444" bg="rgba(239,68,68,0.12)">{post.status === "hidden" ? "숨김" : "삭제"}</Chip>}
            {!post.external_visible && <Chip color={textSecondary} bg="rgba(148,163,184,0.18)">비공개</Chip>}
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 800, color: textPrimary, letterSpacing: "-0.025em", lineHeight: 1.3 }}>
            {post.title || "제목 없음"}
          </h1>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, color: textMuted, fontSize: 13 }}>
            <span style={{ color: textSecondary, fontWeight: 600 }}>{post.display_name}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{formatDateTime(post.created_at)}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>조회 {post.view_count}</span>
          </div>

          {post.cover_image_url && (
            <img src={post.cover_image_url} alt="" style={{ marginTop: 24, width: "100%", borderRadius: 14, border: `1px solid ${border}` }} />
          )}

          <div
            data-testid="board-detail-content"
            className={`public-board-content ${PUBLIC_RICH_CONTENT_CLASS} ${PUBLIC_RICH_CONTENT_PRESERVE_LINES_CLASS}`}
            style={{ marginTop: 28, fontSize: 16, lineHeight: 1.75, color: textPrimary }}
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />
          <PublicRichContentStyle />

          {/* 적중보고서 임베드 (Phase 3 cross-attach) */}
          {(() => {
            const ids = (post.meta as Record<string, unknown> | null)?.matchup_report_ids;
            if (!Array.isArray(ids) || ids.length === 0) return null;
            const numIds = ids.filter((v) => typeof v === "number") as number[];
            return numIds.length > 0 ? <EmbeddedHitReportCards reportIds={numIds} theme="dark" /> : null;
          })()}

          {/* 액션 row */}
          <div style={{ marginTop: 36, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingTop: 20, borderTop: `1px solid ${border}` }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" onClick={onToggleLike} disabled={liking} data-testid="board-detail-like"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 18px", borderRadius: 999,
                  border: `1px solid ${liked ? gold : border}`,
                  background: liked ? `${gold}22` : "transparent",
                  color: liked ? gold : textPrimary,
                  cursor: liking ? "wait" : "pointer", fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em",
                }}
              >
                <span style={{ fontSize: 14 }}>{liked ? "♥" : "♡"}</span>
                <span>좋아요 {post.like_count}</span>
              </button>
              {/* 작성자/staff가 아니면 신고 노출 */}
              {!post.is_owner_or_author && !isStaff && (
                <ReportButton targetKind="board" targetId={post.id} color={textMuted} />
              )}
            </div>

            {(post.is_owner_or_author || isStaff) && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {post.is_owner_or_author && (
                  <button type="button" onClick={() => navigate(`/landing/board/${post.id}/edit`)} data-testid="board-detail-edit"
                    style={modBtn(border, textSecondary)}
                  >수정</button>
                )}
                {(post.is_owner_or_author || isStaff) && (
                  <button type="button" onClick={onDeletePost} data-testid="board-detail-delete"
                    style={{ ...modBtn(border, "#ef4444"), borderColor: "rgba(239,68,68,0.4)" }}
                  >삭제</button>
                )}
                {isStaff && (
                  <>
                    <button type="button" onClick={() => onModerate({ is_pinned: !post.is_pinned })} disabled={moderating} data-testid="board-detail-pin"
                      style={modBtn(border, post.is_pinned ? gold : textSecondary)}
                    >{post.is_pinned ? "고정 해제" : "고정"}</button>
                    <button type="button" onClick={() => onModerate({ external_visible: !post.external_visible })} disabled={moderating} data-testid="board-detail-visible"
                      style={modBtn(border, post.external_visible ? gold : textSecondary)}
                    >{post.external_visible ? "외부 공개 중" : "외부 비공개"}</button>
                    {isOwner && (
                      <button type="button" onClick={() => onModerate({ status: post.status === "hidden" ? "published" : "hidden" })} disabled={moderating} data-testid="board-detail-hide"
                        style={modBtn(border, post.status === "hidden" ? "#ef4444" : textSecondary)}
                      >{post.status === "hidden" ? "숨김 해제" : "숨김"}</button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </article>

        {/* 댓글 */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: textPrimary, letterSpacing: "-0.02em" }}>
            댓글 {post.reply_count}
          </h2>

          {/* 댓글 입력 */}
          {isAuthenticated ? (
            <div style={{ padding: 16, background: cardBg, border: `1px solid ${border}`, borderRadius: 14, marginBottom: 18 }}>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="따뜻한 댓글을 남겨주세요"
                data-testid="board-detail-reply-input"
                rows={3}
                style={{
                  width: "100%", padding: 12, borderRadius: 10,
                  background: "rgba(255,255,255,0.02)", border: `1px solid ${border}`,
                  color: textPrimary, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical",
                }}
              />
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button type="button" onClick={onSubmitReply} disabled={!replyContent.trim() || submittingReply}
                  data-testid="board-detail-reply-submit"
                  style={{
                    padding: "9px 18px", borderRadius: 999, border: "none",
                    background: replyContent.trim() && !submittingReply ? gold : "rgba(255,255,255,0.08)",
                    color: replyContent.trim() && !submittingReply ? "#0A0E1A" : textMuted,
                    fontSize: 13, fontWeight: 700, cursor: replyContent.trim() && !submittingReply ? "pointer" : "not-allowed",
                    letterSpacing: "-0.01em",
                  }}
                >{submittingReply ? "등록 중…" : "댓글 등록"}</button>
              </div>
            </div>
          ) : (
            <LoginGuardInline accent={gold} border={border} cardBg={cardBg} textPrimary={textPrimary} textSecondary={textSecondary} message="댓글은 학원 가족만 작성할 수 있어요" />
          )}

          {/* 댓글 list */}
          {replies === null ? (
            <SkelReplies border={border} cardBg={cardBg} />
          ) : replies.length === 0 ? (
            <div style={{ padding: "40px 24px", borderRadius: 14, background: cardBg, border: `1px dashed ${border}`, textAlign: "center", fontSize: 14, color: textSecondary }}>
              아직 댓글이 없습니다. 첫 댓글을 남겨보세요.
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {replies.map((r) => (
                <li key={r.id} data-testid={`board-detail-reply-${r.id}`}
                  style={{ padding: "14px 18px", background: cardBg, border: `1px solid ${border}`, borderRadius: 12, opacity: r.is_hidden ? 0.5 : 1 }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <span style={{ color: textPrimary, fontWeight: 700 }}>{r.display_name}</span>
                      {r.is_owner_reply && <Chip color={gold} bg={`${gold}22`}>운영자</Chip>}
                      <span style={{ color: textMuted, fontSize: 12 }}>{formatDateTime(r.created_at)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => onLikeReply(r.id)}
                        style={{ background: "transparent", border: "none", color: r.like_count > 0 ? gold : textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >♥ {r.like_count}</button>
                      {(isStaff || r.is_mine) && (
                        <button type="button" onClick={() => onDeleteReply(r.id)}
                          style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >삭제</button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: textPrimary, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.is_hidden ? "(숨김 처리된 댓글)" : r.content}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
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

function Shell({ cfg, children }: { cfg: NonNullable<LandingPublicResponse["config"]>; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", color: "#F5F1E8", fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      <LandingNavBar config={cfg} sections={cfg.sections || []} tokens={NAV_TOKENS} brandMark={<BrandMark name={cfg.brand_name} />} />
      {children}
      <LandingFooter config={cfg} sections={cfg.sections || []} tokens={FOOTER_TOKENS_DARK} />
      <LandingRoleFab />
    </div>
  );
}

function EmptyHero({ title, body, action }: { title: string; body: string; action: { label: string; to: string } }) {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "120px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#F5F1E8", letterSpacing: "-0.02em" }}>{title}</h1>
      <p style={{ marginTop: 12, fontSize: 14, color: "#9CA3AF", lineHeight: 1.6 }}>{body}</p>
      <Link to={action.to} style={{ display: "inline-block", marginTop: 24, padding: "11px 22px", borderRadius: 999, background: "#D4A04C", color: "#0A0E1A", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>{action.label} →</Link>
    </div>
  );
}

function LoginGuardInline({ accent, border, cardBg, textPrimary, textSecondary, message }: { accent: string; border: string; cardBg: string; textPrimary: string; textSecondary: string; message: string }) {
  return (
    <div style={{ padding: "24px 20px", background: cardBg, border: `1px solid ${border}`, borderRadius: 14, marginBottom: 18, textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textPrimary }}>{message}</p>
      <p style={{ margin: "6px 0 14px", fontSize: 12, color: textSecondary }}>학원 등록된 계정으로 로그인하시면 댓글과 좋아요가 가능합니다.</p>
      <Link to="/login" onClick={() => saveReturnPath()} data-testid="board-detail-login-cta"
        style={{ display: "inline-block", padding: "8px 16px", borderRadius: 999, background: accent, color: "#0A0E1A", textDecoration: "none", fontSize: 12.5, fontWeight: 700 }}
      >로그인 →</Link>
    </div>
  );
}

function SkelReplies({ border, cardBg }: { border: string; cardBg: string }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} style={{ height: 64, background: cardBg, border: `1px solid ${border}`, borderRadius: 12 }} />
      ))}
    </ul>
  );
}

function modBtn(border: string, color: string): React.CSSProperties {
  return {
    padding: "8px 14px", borderRadius: 999,
    border: `1px solid ${border}`, background: "transparent",
    color, cursor: "pointer", fontSize: 12.5, fontWeight: 600, letterSpacing: "-0.01em",
  };
}

function Chip({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.05em", padding: "3px 8px", borderRadius: 999, background: bg, flexShrink: 0 }}>{children}</span>;
}

function categoryLabel(c: string): string {
  switch (c) {
    case "free": return "자유";
    case "tip": return "공부 팁";
    case "story": return "수강 이야기";
    case "question": return "질문";
    default: return "기타";
  }
}

function formatDateTime(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${y}.${m}.${dd} ${hh}:${mi}`;
  } catch { return ""; }
}
