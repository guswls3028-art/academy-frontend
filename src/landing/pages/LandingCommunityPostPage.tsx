// PATH: src/landing/pages/LandingCommunityPostPage.tsx
// 랜딩 커뮤니티 글 상세 — /landing/community/:boardType/posts/:postId
//
// 학원장 요청(2026-05-11): 별도 페이지 이동 없이 한 페이지에서 본문 → 액션 → 댓글까지 자연 스크롤.
//
// backend:
//   GET /community/posts/<id>/             — 단건 조회 (sanitized content 포함)
//   GET /community/posts/<id>/replies/     — 댓글 목록 (flat array)
//   POST /community/posts/<id>/replies/    — 댓글 작성 (자료실/qna 권한 분기는 backend)
//
// 좋아요는 backend 아직 미구현 — display-only 0 + disabled. #8 backend 보강 후 활성.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import api, { type ApiRequestConfig } from "@/shared/api/axios";
import useAuth from "@/auth/hooks/useAuth";
import { fetchLandingPublic } from "../api";
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

type BoardType = "board" | "qna" | "notice" | "materials";
const VALID: BoardType[] = ["board", "qna", "notice", "materials"];
const BOARD_LABEL: Record<BoardType, string> = {
  board: "자유게시판",
  qna: "질문게시판",
  notice: "공지사항",
  materials: "자료실",
};
const DOWNLOAD_ONLY: BoardType[] = ["materials"]; // backend SSOT 따라 자료실은 댓글 차단

interface PostDetail {
  id: number;
  post_type: string;
  title: string;
  content: string; // HTML, backend sanitized
  category_label?: string | null;
  created_by_display?: string | null;
  created_by_deleted?: boolean;
  author_role?: string | null;
  is_pinned?: boolean;
  is_urgent?: boolean;
  status?: string;
  published_at?: string | null;
  created_at?: string | null;
  replies_count?: number;
  like_count?: number;
  is_liked?: boolean;
}

interface Reply {
  id: number;
  post: number;
  content: string;
  created_by: number | null;
  created_by_display?: string | null;
  author_role?: string | null;
  created_at?: string | null;
  like_count?: number;
  is_liked?: boolean;
}

function BrandMark({ name }: { name: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #D4A04C 0%, #8B5E1F 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0E1A", fontSize: 18, fontWeight: 800 }}>{initial}</div>
  );
}

export default function LandingCommunityPostPage() {
  const { boardType, postId } = useParams<{ boardType: string; postId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const isValidBoard = VALID.includes(boardType as BoardType);
  const board = (isValidBoard ? (boardType as BoardType) : "board");
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();
  const isStaff = !!u?.is_superuser || ["owner", "admin", "teacher", "assistant"].includes(role);
  const isStudent = role === "student";
  const isParent = role === "parent";

  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [post, setPost] = useState<PostDetail | null>(null);
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [error, setError] = useState<"none" | "not-found" | "fetch">("none");
  const [replyText, setReplyText] = useState("");
  const [replyPending, setReplyPending] = useState(false);
  const [replyErr, setReplyErr] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  useEffect(() => { fetchLandingPublic().then(setLanding).catch(() => setLanding(null)); }, []);

  useEffect(() => {
    if (!isAuthenticated || !postId) return;
    setPost(null); setReplies(null); setError("none");
    api.get(`/community/posts/${postId}/`, { } as ApiRequestConfig)
      .then((r) => setPost(r.data as PostDetail))
      .catch((e) => {
        const status = (e as { response?: { status?: number } })?.response?.status;
        setError(status === 404 ? "not-found" : "fetch");
      });
    api.get(`/community/posts/${postId}/replies/`, { } as ApiRequestConfig)
      .then((r) => setReplies(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setReplies([]));
  }, [postId, isAuthenticated]);

  if (boardType && !isValidBoard) return <Navigate to="/landing/community/board" replace />;

  if (!landing) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#D4A04C", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const cfg = landing.config!;
  const bg = "#0A0E1A";
  const bgAlt = "#0F1525";
  const border = "rgba(255,255,255,0.08)";
  const cardBg = "rgba(255,255,255,0.03)";
  const textPrimary = "#F5F1E8";
  const textSecondary = "#9CA3AF";
  const textMuted = "#6B7280";
  const gold = "#D4A04C";
  const danger = "#ef4444";

  const downloadOnly = DOWNLOAD_ONLY.includes(board);
  // QnA: 학생/학부모 답변 차단(backend 정책). board/notice는 학생 댓글 가능. 학부모는 항상 read-only.
  const canReply = isAuthenticated && !downloadOnly && !isParent && !(board === "qna" && isStudent);

  const onShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      // fallback — alert
      alert(window.location.href);
    }
  };

  // 좋아요 토글 — optimistic update + 실패 시 revert.
  const onToggleLike = async () => {
    if (!post) return;
    const wasLiked = !!post.is_liked;
    const prevCount = post.like_count ?? 0;
    // optimistic
    setPost({ ...post, is_liked: !wasLiked, like_count: prevCount + (wasLiked ? -1 : 1) });
    try {
      const method = wasLiked ? "delete" : "post";
      const r = await api.request({ url: `/community/posts/${post.id}/like/`, method, data: {} });
      const data = r.data as { liked?: boolean; count?: number };
      setPost((cur) => cur ? { ...cur, is_liked: !!data.liked, like_count: typeof data.count === "number" ? data.count : cur.like_count } : cur);
    } catch {
      // revert
      setPost((cur) => cur ? { ...cur, is_liked: wasLiked, like_count: prevCount } : cur);
    }
  };

  // 댓글 좋아요 토글
  const onToggleReplyLike = async (rid: number) => {
    if (!post || !replies) return;
    const reply = replies.find((r) => r.id === rid);
    if (!reply) return;
    const wasLiked = !!reply.is_liked;
    const prevCount = reply.like_count ?? 0;
    setReplies((prev) => prev?.map((r) => r.id === rid ? { ...r, is_liked: !wasLiked, like_count: prevCount + (wasLiked ? -1 : 1) } : r) ?? prev);
    try {
      const method = wasLiked ? "delete" : "post";
      const r = await api.request({ url: `/community/posts/${post.id}/replies/${rid}/like/`, method, data: {} });
      const data = r.data as { liked?: boolean; count?: number };
      setReplies((prev) => prev?.map((rp) => rp.id === rid ? { ...rp, is_liked: !!data.liked, like_count: typeof data.count === "number" ? data.count : rp.like_count } : rp) ?? prev);
    } catch {
      setReplies((prev) => prev?.map((rp) => rp.id === rid ? { ...rp, is_liked: wasLiked, like_count: prevCount } : rp) ?? prev);
    }
  };

  const onSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || replyPending) return;
    setReplyErr(null);
    setReplyPending(true);
    try {
      const r = await api.post(`/community/posts/${postId}/replies/`, { content: replyText.trim() } as object);
      const newReply = r.data as Reply;
      setReplies((prev) => (prev ? [...prev, newReply] : [newReply]));
      setReplyText("");
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string | string[] } } })?.response?.data?.detail;
      setReplyErr(Array.isArray(detail) ? detail[0] : (typeof detail === "string" ? detail : "댓글 등록 실패."));
    }
    setReplyPending(false);
  };

  // 비로그인 — 로그인 유도
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
        <LandingNavBar config={cfg} sections={cfg.sections || []} tokens={NAV_TOKENS} brandMark={<BrandMark name={cfg.brand_name} />} />
        <section style={{ padding: "80px 24px", background: bgAlt, minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ maxWidth: 460, textAlign: "center", padding: "48px 24px", background: cardBg, border: `1px solid ${border}`, borderRadius: 16 }}>
            <div style={{ fontSize: 40, opacity: 0.9, marginBottom: 12 }}>🔒</div>
            <p style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.01em" }}>학원 가족만 볼 수 있는 글이에요</p>
            <p style={{ fontSize: 14, color: textSecondary, margin: "0 0 18px", lineHeight: 1.6 }}>
              학생·학부모·강사 계정으로 로그인하시면 본문과 댓글까지 모두 확인하실 수 있습니다.
            </p>
            <Link to="/login" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 24px", borderRadius: 999, background: gold, color: "#0A0E1A", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
              로그인하고 보기 →
            </Link>
            <div style={{ marginTop: 18 }}>
              <Link to={`/landing/community/${board}`} style={{ fontSize: 13, color: textSecondary, textDecoration: "none" }}>← 게시판 목록으로</Link>
            </div>
          </div>
        </section>
        <LandingFooter config={cfg} sections={cfg.sections || []} tokens={FOOTER_TOKENS_DARK} />
        <LandingRoleFab />
      </div>
    );
  }

  if (error === "not-found") {
    return (
      <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif" }}>
        <LandingNavBar config={cfg} sections={cfg.sections || []} tokens={NAV_TOKENS} brandMark={<BrandMark name={cfg.brand_name} />} />
        <section style={{ padding: "80px 24px", background: bgAlt, minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>글을 찾을 수 없습니다</p>
            <p style={{ fontSize: 13, color: textSecondary, margin: "0 0 20px" }}>이미 삭제되었거나 비공개 상태일 수 있어요.</p>
            <Link to={`/landing/community/${board}`} style={{ padding: "10px 20px", borderRadius: 999, background: gold, color: "#0A0E1A", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>게시판 목록으로</Link>
          </div>
        </section>
        <LandingFooter config={cfg} sections={cfg.sections || []} tokens={FOOTER_TOKENS_DARK} />
        <LandingRoleFab />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      <LandingNavBar config={cfg} sections={cfg.sections || []} tokens={NAV_TOKENS} brandMark={<BrandMark name={cfg.brand_name} />} />

      {/* 헤더 — 카테고리/제목/메타 */}
      <section style={{ padding: "40px 24px 24px", borderBottom: `1px solid ${border}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Link to={`/landing/community/${board}`} style={{ fontSize: 12, fontWeight: 700, color: gold, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none" }}>
              {BOARD_LABEL[board]}
            </Link>
            {post?.is_pinned && <Chip color={gold} bg="rgba(212,160,76,0.12)">고정</Chip>}
            {post?.is_urgent && <Chip color={danger} bg="rgba(239,68,68,0.1)">중요</Chip>}
          </div>
          <h1 style={{ fontSize: "clamp(22px, 2.6vw, 30px)", fontWeight: 800, margin: "0 0 14px", letterSpacing: "-0.025em", lineHeight: 1.3 }}>
            {post?.title || (error === "none" ? "" : "제목 없음")}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: textSecondary, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, color: textPrimary }}>{post?.created_by_display || "—"}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{formatDateTime(post?.published_at || post?.created_at)}</span>
            {post && (post.replies_count ?? 0) > 0 && (
              <>
                <span style={{ opacity: 0.5 }}>·</span>
                <span>댓글 {post.replies_count}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 본문 */}
      <section style={{ padding: "32px 24px", background: bgAlt }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {error === "fetch" ? (
            <p style={{ textAlign: "center", fontSize: 14, color: textSecondary, padding: 40 }}>본문을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
          ) : !post ? (
            <BodySkeleton border={border} cardBg={cardBg} />
          ) : (
            <article
              data-testid="landing-community-post-body"
              style={{
                fontSize: 15.5, lineHeight: 1.8, color: textPrimary,
                wordBreak: "break-word", overflowWrap: "anywhere",
              }}
              dangerouslySetInnerHTML={{ __html: post.content || "<p style='color:#6B7280'>본문이 없습니다.</p>" }}
            />
          )}
        </div>
      </section>

      {/* 액션 row — 좋아요(disabled), 주소복사 */}
      {post && (
        <section style={{ padding: "24px 24px 0", background: bgAlt }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onToggleLike}
              data-testid="landing-community-like"
              aria-pressed={!!post.is_liked}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 10,
                background: post.is_liked ? "rgba(212,160,76,0.12)" : "transparent",
                border: `1px solid ${post.is_liked ? gold : border}`,
                color: post.is_liked ? gold : textPrimary,
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                transition: "background 0.15s, border-color 0.15s, color 0.15s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={post.is_liked ? gold : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
              좋아요 {post.like_count ?? 0}
            </button>
            <button
              type="button"
              onClick={onShare}
              data-testid="landing-community-share"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 10, background: "transparent", border: `1px solid ${border}`, color: textPrimary, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
              {copyDone ? "복사됨 ✓" : "주소복사"}
            </button>
          </div>
        </section>
      )}

      {/* 작성자 카드 */}
      {post && post.created_by_display && !post.created_by_deleted && (
        <section style={{ padding: "32px 24px 12px", background: bgAlt }}>
          <div style={{ maxWidth: 900, margin: "0 auto", padding: 20, borderRadius: 14, background: cardBg, border: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${gold} 0%, #8B5E1F 100%)`, color: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, flexShrink: 0 }}>
              {(post.created_by_display || "•").trim().charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary, letterSpacing: "-0.01em" }}>
                {post.created_by_display}<span style={{ fontWeight: 500, color: textMuted, marginLeft: 4 }}>님</span>
              </div>
              <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>{formatDateTime(post.published_at || post.created_at)}</div>
            </div>
            {post.author_role && (
              <span style={{ fontSize: 11, fontWeight: 700, color: gold, padding: "4px 10px", borderRadius: 999, background: "rgba(212,160,76,0.12)", letterSpacing: "0.04em" }}>
                {roleLabel(post.author_role)}
              </span>
            )}
          </div>
        </section>
      )}

      {/* 액션 row 2 — 목록/글쓰기/위로가기 */}
      {post && (
        <section style={{ padding: "20px 24px 0", background: bgAlt }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => navigate(`/landing/community/${board}`)} style={smallBtn(border, textPrimary)}>목록</button>
            {canReply && (
              <button type="button" onClick={() => document.getElementById("reply-input")?.focus()} style={smallBtn(border, textPrimary)}>댓글 쓰기</button>
            )}
            {isStaff && (
              <button type="button" onClick={() => navigate(`/landing/community/${board}/write`)} data-testid="landing-community-write-cta" style={{ ...smallBtn(border, "#0A0E1A"), background: gold, border: "none" }}>글쓰기</button>
            )}
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} style={smallBtn(border, textSecondary)}>↑</button>
          </div>
        </section>
      )}

      {/* 댓글 섹션 */}
      <section style={{ padding: "32px 24px 64px", background: bgAlt, borderTop: `1px solid ${border}`, marginTop: 28 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: textPrimary, letterSpacing: "-0.01em" }}>
            💬 댓글 {replies?.length ?? 0}
          </h2>

          {downloadOnly ? (
            <div style={{ padding: 24, borderRadius: 12, border: `1px dashed ${border}`, color: textSecondary, fontSize: 13.5, textAlign: "center" }}>
              자료실 게시글에는 댓글을 등록할 수 없습니다.
            </div>
          ) : canReply ? (
            <form onSubmit={onSubmitReply} style={{ marginBottom: 24 }}>
              <textarea
                id="reply-input"
                data-testid="landing-community-reply-input"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={isStudent ? "다른 친구에게 도움이 되는 댓글을 남겨주세요." : "댓글을 입력하세요."}
                disabled={replyPending}
                rows={3}
                maxLength={2000}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10,
                  border: `1px solid ${border}`, background: cardBg,
                  color: textPrimary, fontSize: 14, fontFamily: "inherit",
                  resize: "vertical", outline: "none",
                }}
              />
              {replyErr && (
                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: "#fca5a5", fontSize: 12, fontWeight: 500 }}>{replyErr}</div>
              )}
              <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="submit" disabled={!replyText.trim() || replyPending} style={{
                  padding: "10px 22px", borderRadius: 10, border: "none",
                  background: (!replyText.trim() || replyPending) ? "rgba(255,255,255,0.08)" : gold,
                  color: (!replyText.trim() || replyPending) ? textMuted : "#0A0E1A",
                  fontSize: 13.5, fontWeight: 700, cursor: (!replyText.trim() || replyPending) ? "not-allowed" : "pointer",
                  letterSpacing: "-0.01em",
                }}>{replyPending ? "등록 중..." : "댓글 등록"}</button>
              </div>
            </form>
          ) : (
            <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 10, border: `1px dashed ${border}`, color: textSecondary, fontSize: 13 }}>
              {isParent ? "학부모 계정은 댓글 등록이 제한됩니다." : "이 게시판에는 댓글을 등록할 수 없습니다."}
            </div>
          )}

          {replies === null ? (
            <ReplySkeleton border={border} cardBg={cardBg} />
          ) : replies.length === 0 ? (
            <div style={{ padding: 32, color: textMuted, textAlign: "center", fontSize: 13 }}>아직 등록된 댓글이 없습니다. 가장 먼저 의견을 남겨주세요.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 1, borderRadius: 12, overflow: "hidden", border: `1px solid ${border}`, background: cardBg }}>
              {replies.map((rp) => (
                <li key={rp.id} style={{ padding: "16px 18px", background: cardBg, borderBottom: `1px solid ${border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: textPrimary }}>{rp.created_by_display || "—"}</span>
                    {rp.author_role && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: gold, padding: "2px 7px", borderRadius: 999, background: "rgba(212,160,76,0.12)", letterSpacing: "0.06em" }}>
                        {roleLabel(rp.author_role)}
                      </span>
                    )}
                    <span style={{ marginLeft: "auto", fontSize: 11, color: textMuted }}>{formatDateTime(rp.created_at)}</span>
                  </div>
                  <div
                    style={{ fontSize: 14, lineHeight: 1.65, color: textPrimary, wordBreak: "break-word", whiteSpace: "pre-wrap" }}
                    dangerouslySetInnerHTML={{ __html: rp.content || "" }}
                  />
                  <div style={{ marginTop: 8, display: "flex", gap: 14, fontSize: 12, color: textMuted }}>
                    <button
                      type="button"
                      onClick={() => onToggleReplyLike(rp.id)}
                      aria-pressed={!!rp.is_liked}
                      data-testid={`landing-community-reply-like-${rp.id}`}
                      style={{
                        background: "transparent", border: "none", padding: 0,
                        color: rp.is_liked ? gold : textMuted,
                        cursor: "pointer", fontSize: 12, fontWeight: rp.is_liked ? 700 : 500,
                      }}
                    >{rp.is_liked ? "♥" : "♡"} 좋아요 {rp.like_count ?? 0}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <LandingFooter config={cfg} sections={cfg.sections || []} tokens={FOOTER_TOKENS_DARK} />
      <LandingRoleFab />
    </div>
  );
}

function smallBtn(border: string, color: string): React.CSSProperties {
  return {
    padding: "8px 16px", borderRadius: 999,
    background: "transparent", border: `1px solid ${border}`,
    color, fontSize: 13, fontWeight: 600, cursor: "pointer",
    letterSpacing: "-0.01em",
  };
}

function Chip({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 999, background: bg, flexShrink: 0 }}>{children}</span>;
}

function BodySkeleton({ border, cardBg }: { border: string; cardBg: string }) {
  return (
    <div style={{ padding: 24, borderRadius: 12, background: cardBg, border: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 10 }}>
      {[60, 80, 70, 90, 50].map((w, i) => (
        <div key={i} style={{ height: 14, width: `${w}%`, borderRadius: 4, background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.1), rgba(255,255,255,0.04))", backgroundSize: "200% 100%", animation: "lpb 1.4s ease-in-out infinite" }} />
      ))}
      <style>{`@keyframes lpb { 0% { background-position: 0% 50% } 100% { background-position: -200% 50% } }`}</style>
    </div>
  );
}

function ReplySkeleton({ border, cardBg }: { border: string; cardBg: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, borderRadius: 12, overflow: "hidden", border: `1px solid ${border}`, background: cardBg }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ padding: 16, background: cardBg, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ height: 12, width: "30%", borderRadius: 4, background: "rgba(255,255,255,0.06)" }} />
          <div style={{ height: 14, width: "80%", borderRadius: 4, background: "rgba(255,255,255,0.08)" }} />
        </div>
      ))}
    </div>
  );
}

function roleLabel(role: string): string {
  const r = role.toLowerCase();
  if (r === "student") return "학생";
  if (r === "teacher") return "강사";
  if (r === "admin" || r === "owner") return "운영진";
  if (r === "parent") return "학부모";
  if (r === "staff") return "운영진";
  return role;
}

function formatDateTime(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}.${m}.${day} ${hh}:${mm}`;
  } catch { return ""; }
}
