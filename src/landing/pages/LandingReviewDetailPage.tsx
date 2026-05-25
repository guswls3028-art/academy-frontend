// PATH: src/landing/pages/LandingReviewDetailPage.tsx
// 수강후기 상세 — 평점★ + 학년/과목/수강기간 + 사진 + 본문 + 댓글.
/* eslint-disable no-restricted-syntax */

import DOMPurify from "dompurify";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { saveReturnPath } from "@/shared/api/axios";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import { fetchLandingPublic } from "../api";
import ReportButton from "../components/ReportButton";
import { setLandingMeta } from "../utils/seoMeta";
import {
  createReply,
  deleteReply,
  deleteReview,
  fetchReplies,
  fetchReviewDetail,
  moderateReview,
  toggleReplyLike,
  toggleReviewLike,
  type PublicReply,
  type PublicReviewDetail,
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

export default function LandingReviewDetailPage() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { isAuthenticated, user } = useAuth();
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();
  const isStaff = !!u?.is_superuser || ["owner", "admin", "staff", "teacher", "assistant"].includes(role);

  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [review, setReview] = useState<PublicReviewDetail | null>(null);
  const [replies, setReplies] = useState<PublicReply[] | null>(null);
  const [error, setError] = useState<"none" | "fetch" | "not-found">("none");
  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  const id = Number(reviewId);

  useEffect(() => { fetchLandingPublic().then(setLanding).catch(() => setLanding(null)); }, []);

  const loadDetail = useCallback(() => {
    if (!Number.isFinite(id)) { setError("not-found"); return; }
    setReview(null);
    fetchReviewDetail(id)
      .then((rv) => {
        setReview(rv);
        // P1 audit (2026-05-14): is_liked_by_me 로 ♥ 초기 상태 유지.
        setLiked(rv.is_liked_by_me);
      })
      .catch((e: unknown) => {
        const s = (e as { response?: { status?: number } })?.response?.status;
        setError(s === 404 ? "not-found" : "fetch");
      });
  }, [id]);

  const loadReplies = useCallback(() => {
    if (!Number.isFinite(id)) return;
    fetchReplies({ kind: "review", id })
      .then((r) => setReplies(r.results))
      .catch(() => setReplies([]));
  }, [id]);

  useEffect(() => { loadDetail(); loadReplies(); }, [loadDetail, loadReplies]);

  // SEO — JSON-LD Review schema (Phase 3 B). 외부 검색 엔진이 별점/리뷰어/날짜 인덱싱.
  useEffect(() => {
    if (!review || !landing?.config) return;
    const brand = landing.config.brand_name || "학원플러스";
    const plain = (review.content || "").replace(/<[^>]+>/g, "").trim().slice(0, 160);
    const titleStr = review.title ? `${review.title} — ${brand} 수강후기` : `${brand} 수강후기 (별점 ${review.rating}/5)`;
    document.title = titleStr;
    setLandingMeta("description", plain);
    setLandingMeta("og:title", titleStr);
    setLandingMeta("og:description", plain);
    setLandingMeta("og:type", "article");
    setLandingMeta("og:url", window.location.href);
    if (review.cover_image_url) setLandingMeta("og:image", review.cover_image_url);
    else if (review.photos && review.photos.length > 0) setLandingMeta("og:image", review.photos[0]);
    setLandingMeta("twitter:card", "summary_large_image");
    setLandingMeta("twitter:title", titleStr);
    setLandingMeta("twitter:description", plain);
    // JSON-LD Review schema — 검색 결과에 별점/리뷰어 표시 가능
    let script = document.getElementById("landing-jsonld") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "landing-jsonld";
      document.head.appendChild(script);
    }
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Review",
      itemReviewed: {
        "@type": "EducationalOrganization",
        name: brand,
      },
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { "@type": "Person", name: review.display_name },
      datePublished: review.created_at,
      reviewBody: plain,
      ...(review.photos && review.photos.length > 0 ? { image: review.photos[0] } : {}),
    });
    return () => {
      document.title = brand;
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };
  }, [review, landing]);

  const onToggleLike = async () => {
    if (!isAuthenticated) { saveReturnPath(); navigate("/login"); return; }
    if (!review || liking) return;
    setLiking(true);
    try {
      const r = await toggleReviewLike(review.id);
      setLiked(r.liked);
      setReview({ ...review, like_count: r.like_count });
    } finally { setLiking(false); }
  };

  const onSubmitReply = async () => {
    if (!isAuthenticated) { saveReturnPath(); navigate("/login"); return; }
    const content = replyContent.trim();
    if (!content || submittingReply || !review) return;
    setSubmittingReply(true);
    try {
      await createReply({ target_kind: "review", target_id: review.id, content });
      setReplyContent("");
      loadReplies();
      setReview({ ...review, reply_count: review.reply_count + 1 });
    } catch { feedback.error("댓글 등록 실패"); }
    finally { setSubmittingReply(false); }
  };

  const onModerate = async (patch: Parameters<typeof moderateReview>[1]) => {
    if (!review || moderating) return;
    setModerating(true);
    try {
      const updated = await moderateReview(review.id, patch);
      setReview(updated);
    } catch { feedback.error("모더레이션 실패"); }
    finally { setModerating(false); }
  };

  const onDeleteReview = async () => {
    if (!review) return;
    const ok = await confirm({
      title: "후기 삭제",
      message: "이 후기를 삭제하시겠어요?",
      confirmText: "삭제",
      cancelText: "취소",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteReview(review.id);
      navigate("/landing/reviews", { replace: true });
    } catch { feedback.error("삭제 실패"); }
  };

  const onLikeReply = async (replyId: number) => {
    if (!isAuthenticated) { saveReturnPath(); navigate("/login"); return; }
    try {
      const r = await toggleReplyLike(replyId);
      setReplies((prev) => prev?.map((x) => x.id === replyId ? { ...x, like_count: r.like_count } : x) ?? prev);
    } catch { /* noop */ }
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
      if (review) setReview({ ...review, reply_count: Math.max(0, review.reply_count - 1) });
    } catch { feedback.error("삭제 실패"); }
  };

  if (!landing?.config) return <CenterSpin />;
  const cfg = landing.config;

  if (error === "not-found") {
    return (
      <Shell cfg={cfg}>
        <EmptyHero title="후기를 찾을 수 없습니다" body="삭제되었거나 비공개로 전환된 후기일 수 있습니다." action={{ label: "수강후기로 돌아가기", to: "/landing/reviews" }} />
      </Shell>
    );
  }

  if (!review) return <Shell cfg={cfg}><CenterSpin /></Shell>;

  const border = "rgba(255,255,255,0.08)";
  const cardBg = "rgba(255,255,255,0.03)";
  const textPrimary = "#F5F1E8";
  const textSecondary = "#9CA3AF";
  const textMuted = "#6B7280";
  const gold = "#D4A04C";

  const sanitized = DOMPurify.sanitize(review.content || "", { USE_PROFILES: { html: true } });

  return (
    <Shell cfg={cfg}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ marginBottom: 20 }}>
          <Link to="/landing/reviews" data-testid="review-detail-back"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: textSecondary, textDecoration: "none", fontSize: 13, fontWeight: 600 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="15,18 9,12 15,6" /></svg>
            수강후기
          </Link>
        </div>

        <article data-testid="review-detail-article" style={{ padding: "32px 36px", background: cardBg, border: `1px solid ${border}`, borderRadius: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <Stars n={review.rating} gold={gold} />
            <div style={{ display: "flex", gap: 6 }}>
              {review.is_verified && <Chip color={gold} bg={`${gold}1F`}>✓ 수강 인증</Chip>}
              {review.is_pinned && <Chip color={gold} bg={`${gold}22`}>고정</Chip>}
              {review.status !== "approved" && <Chip color="#ef4444" bg="rgba(239,68,68,0.12)">{statusLabel(review.status)}</Chip>}
            </div>
          </div>
          {review.title && (
            <h1 style={{ margin: 0, fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 800, color: textPrimary, letterSpacing: "-0.025em", lineHeight: 1.3 }}>
              {review.title}
            </h1>
          )}
          <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {review.grade && <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.04)", fontSize: 12, color: textSecondary }}>{review.grade}</span>}
            {review.subject && <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.04)", fontSize: 12, color: textSecondary }}>{review.subject}</span>}
            {review.enrollment_months > 0 && <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.04)", fontSize: 12, color: textSecondary }}>수강 {review.enrollment_months}개월</span>}
          </div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, color: textMuted, fontSize: 13 }}>
            <span style={{ color: textSecondary, fontWeight: 600 }}>{review.display_name}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{formatDateTime(review.created_at)}</span>
          </div>

          {review.photos && review.photos.length > 0 && (
            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
              {review.photos.map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noreferrer" style={{ display: "block", borderRadius: 12, overflow: "hidden", border: `1px solid ${border}` }}>
                  <img src={src} alt={`review photo ${i + 1}`} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                </a>
              ))}
            </div>
          )}

          <div
            data-testid="review-detail-content"
            className={`${PUBLIC_RICH_CONTENT_CLASS} ${PUBLIC_RICH_CONTENT_PRESERVE_LINES_CLASS}`}
            style={{ marginTop: 28, fontSize: 16, lineHeight: 1.75, color: textPrimary }}
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />
          <PublicRichContentStyle />

          <div style={{ marginTop: 36, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingTop: 20, borderTop: `1px solid ${border}` }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" onClick={onToggleLike} disabled={liking} data-testid="review-detail-like"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 18px", borderRadius: 999,
                  border: `1px solid ${liked ? gold : border}`,
                  background: liked ? `${gold}22` : "transparent",
                  color: liked ? gold : textPrimary, cursor: liking ? "wait" : "pointer",
                  fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em",
                }}
              >
                <span style={{ fontSize: 14 }}>{liked ? "♥" : "♡"}</span>
                <span>좋아요 {review.like_count}</span>
              </button>
              {!isStaff && review.author_role && (
                <ReportButton targetKind="review" targetId={review.id} color={textMuted} />
              )}
            </div>

            {isStaff && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {review.status === "pending" && (
                  <>
                    <button type="button" onClick={() => onModerate({ status: "approved" })} disabled={moderating} data-testid="review-detail-approve"
                      style={{ ...modBtn(border, "#0A0E1A"), background: gold, borderColor: gold, fontWeight: 700 }}
                    >승인</button>
                    <button type="button" onClick={() => onModerate({ status: "rejected" })} disabled={moderating} data-testid="review-detail-reject"
                      style={modBtn(border, "#ef4444")}
                    >거절</button>
                  </>
                )}
                {review.status === "approved" && (
                  <>
                    <button type="button" onClick={() => onModerate({ is_pinned: !review.is_pinned })} disabled={moderating} data-testid="review-detail-pin"
                      style={modBtn(border, review.is_pinned ? gold : textSecondary)}
                    >{review.is_pinned ? "고정 해제" : "고정"}</button>
                    <button type="button" onClick={() => onModerate({ is_verified: !review.is_verified })} disabled={moderating} data-testid="review-detail-verify"
                      style={modBtn(border, review.is_verified ? gold : textSecondary)}
                    >{review.is_verified ? "인증 해제" : "수강 인증"}</button>
                    <button type="button" onClick={() => onModerate({ status: "hidden" })} disabled={moderating} data-testid="review-detail-hide"
                      style={modBtn(border, "#ef4444")}
                    >숨김</button>
                  </>
                )}
                {review.status === "hidden" && (
                  <button type="button" onClick={() => onModerate({ status: "approved" })} disabled={moderating} data-testid="review-detail-unhide"
                    style={modBtn(border, gold)}
                  >다시 공개</button>
                )}
                <button type="button" onClick={onDeleteReview} data-testid="review-detail-delete"
                  style={{ ...modBtn(border, "#ef4444"), borderColor: "rgba(239,68,68,0.4)" }}
                >삭제</button>
              </div>
            )}
          </div>
        </article>

        {/* 댓글 */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: textPrimary, letterSpacing: "-0.02em" }}>
            댓글 {review.reply_count}
          </h2>

          {isAuthenticated ? (
            <div style={{ padding: 16, background: cardBg, border: `1px solid ${border}`, borderRadius: 14, marginBottom: 18 }}>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="후기를 읽고 한 마디 남겨주세요"
                data-testid="review-detail-reply-input"
                rows={3}
                style={{
                  width: "100%", padding: 12, borderRadius: 10,
                  background: "rgba(255,255,255,0.02)", border: `1px solid ${border}`,
                  color: textPrimary, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical",
                }}
              />
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button type="button" onClick={onSubmitReply} disabled={!replyContent.trim() || submittingReply}
                  data-testid="review-detail-reply-submit"
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
            <div style={{ padding: "24px 20px", background: cardBg, border: `1px solid ${border}`, borderRadius: 14, marginBottom: 18, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textPrimary }}>댓글은 학원 가족만 작성할 수 있어요</p>
              <Link to="/login" onClick={() => saveReturnPath()} data-testid="review-detail-login-cta"
                style={{ display: "inline-block", marginTop: 12, padding: "8px 16px", borderRadius: 999, background: gold, color: "#0A0E1A", textDecoration: "none", fontSize: 12.5, fontWeight: 700 }}
              >로그인 →</Link>
            </div>
          )}

          {replies === null ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} style={{ height: 64, background: cardBg, border: `1px solid ${border}`, borderRadius: 12 }} />
              ))}
            </ul>
          ) : replies.length === 0 ? (
            <div style={{ padding: "40px 24px", borderRadius: 14, background: cardBg, border: `1px dashed ${border}`, textAlign: "center", fontSize: 14, color: textSecondary }}>
              아직 댓글이 없습니다. 첫 댓글을 남겨보세요.
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {replies.map((r) => (
                <li key={r.id} data-testid={`review-detail-reply-${r.id}`}
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
                      {isStaff && (
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

function Stars({ n, gold }: { n: number; gold: string }) {
  const stars = "★★★★★".slice(0, Math.max(0, Math.min(5, n)));
  const dim = "★★★★★".slice(0, 5 - Math.max(0, Math.min(5, n)));
  return (
    <span style={{ letterSpacing: 2, fontSize: 18 }}>
      <span style={{ color: gold }}>{stars}</span>
      <span style={{ color: "rgba(140,140,140,0.4)" }}>{dim}</span>
    </span>
  );
}

function Chip({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.05em", padding: "3px 8px", borderRadius: 999, background: bg, flexShrink: 0 }}>{children}</span>;
}

function modBtn(border: string, color: string): React.CSSProperties {
  return {
    padding: "8px 14px", borderRadius: 999,
    border: `1px solid ${border}`, background: "transparent",
    color, cursor: "pointer", fontSize: 12.5, fontWeight: 600, letterSpacing: "-0.01em",
  };
}

function statusLabel(s: string): string {
  switch (s) {
    case "pending": return "승인대기";
    case "rejected": return "거절";
    case "hidden": return "숨김";
    default: return s;
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
