// PATH: src/landing/pages/LandingBoardPage.tsx
// 자유게시판 list — 외부 비로그인 학부모 read OK.
// 학원장 모더레이션(pin/hot/hide/external_visible toggle) + 카테고리 + 정렬 + 검색.
/* eslint-disable no-restricted-syntax */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { fetchLandingPublic } from "../api";
import {
  fetchBoardList,
  toggleBoardLike,
  type BoardCategory,
  type Ordering,
  type PublicBoardPost,
} from "../api/publicCommunity";
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

const CATEGORIES: { key: BoardCategory | ""; label: string }[] = [
  { key: "", label: "전체" },
  { key: "free", label: "자유" },
  { key: "tip", label: "공부 팁" },
  { key: "story", label: "수강 이야기" },
  { key: "question", label: "질문" },
  { key: "other", label: "기타" },
];

const PAGE_SIZE = 12;

function BrandMark({ name }: { name: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 9,
      background: "linear-gradient(135deg, #D4A04C 0%, #8B5E1F 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#0A0E1A", fontSize: 18, fontWeight: 800,
    }}>{initial}</div>
  );
}

export default function LandingBoardPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();
  const canWrite = isAuthenticated && role !== "parent" && (
    !!u?.is_superuser || ["owner", "admin", "teacher", "assistant", "staff", "student"].includes(role)
  );

  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [category, setCategory] = useState<BoardCategory | "">("");
  const [ordering, setOrdering] = useState<Ordering>("latest");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<PublicBoardPost[] | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => { fetchLandingPublic().then(setLanding).catch(() => setLanding(null)); }, []);
  useEffect(() => { const t = setTimeout(() => setQuery(queryInput.trim()), 300); return () => clearTimeout(t); }, [queryInput]);
  useEffect(() => { setPage(1); }, [category, ordering, query]);

  useEffect(() => {
    setPosts(null);
    setError(false);
    fetchBoardList({ page, page_size: PAGE_SIZE, category: category || undefined, ordering, q: query || undefined })
      .then((r) => { setPosts(r.results); setCount(r.count); })
      .catch(() => { setError(true); setPosts([]); setCount(0); });
  }, [page, category, ordering, query]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  if (!landing?.config) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#D4A04C", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }
  const cfg = landing.config;

  // 톤
  const bg = "#0A0E1A";
  const bgAlt = "#0F1525";
  const border = "rgba(255,255,255,0.08)";
  const cardBg = "rgba(255,255,255,0.03)";
  const textPrimary = "#F5F1E8";
  const textSecondary = "#9CA3AF";
  const textMuted = "#6B7280";
  const gold = "#D4A04C";

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      <LandingNavBar config={cfg} sections={cfg.sections || []} tokens={NAV_TOKENS} brandMark={<BrandMark name={cfg.brand_name} />} />

      {/* 헤더 */}
      <section style={{ padding: "56px 24px 28px", borderBottom: `1px solid ${border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Public Board · 자유게시판
          </div>
          <h1 style={{ fontSize: "clamp(24px, 3vw, 34px)", fontWeight: 800, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.25 }}>
            학원 가족이 함께 쓰는 자유게시판
          </h1>
          <p style={{ marginTop: 12, fontSize: 14, color: textSecondary, maxWidth: 640, lineHeight: 1.6 }}>
            외부 학부모도 읽을 수 있는 공개 게시판입니다. 학원 등록된 가족만 글을 작성할 수 있으며, 학원장이 직접 모더레이션합니다.
          </p>
        </div>
      </section>

      {/* 카테고리 + 정렬 + 검색 */}
      <section style={{ background: bg, borderBottom: `1px solid ${border}`, position: "sticky", top: 64, zIndex: 30, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 24px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, overflowX: "auto", flex: 1, minWidth: 0, scrollbarWidth: "none" }}>
            {CATEGORIES.map((c) => {
              const on = c.key === category;
              return (
                <button
                  key={c.key || "all"}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  data-testid={`landing-board-cat-${c.key || "all"}`}
                  style={{
                    padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                    background: on ? gold : "transparent",
                    color: on ? "#0A0E1A" : textSecondary,
                    border: `1px solid ${on ? gold : border}`,
                    fontSize: 12.5, fontWeight: on ? 700 : 600, letterSpacing: "-0.01em",
                    whiteSpace: "nowrap", flexShrink: 0,
                  }}
                >{c.label}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            <select
              value={ordering}
              onChange={(e) => setOrdering(e.target.value as Ordering)}
              data-testid="landing-board-ordering"
              style={{
                padding: "7px 10px", borderRadius: 8, border: `1px solid ${border}`,
                background: cardBg, color: textPrimary, fontSize: 12.5, fontWeight: 600,
                outline: "none", cursor: "pointer",
              }}
            >
              <option value="latest">최신순</option>
              <option value="likes">좋아요순</option>
              <option value="replies">댓글순</option>
            </select>
          </div>
          <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 320 }}>
            <input
              type="search"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="제목·내용 검색"
              data-testid="landing-board-search"
              style={{
                width: "100%", padding: "8px 14px", borderRadius: 999,
                border: `1px solid ${border}`, background: cardBg,
                color: textPrimary, fontSize: 12.5, fontFamily: "inherit", outline: "none",
              }}
            />
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={() => navigate("/landing/board/write")}
              data-testid="landing-board-write-cta"
              style={{
                padding: "9px 16px", borderRadius: 999, border: "none",
                background: gold, color: "#0A0E1A",
                fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em",
                flexShrink: 0,
              }}
            >글쓰기</button>
          )}
        </div>
      </section>

      {/* 본문 */}
      <section style={{ padding: "32px 24px 64px", background: bgAlt, minHeight: "60vh" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {error ? (
            <EmptyBox border={border} cardBg={cardBg} color={textSecondary}>잠시 후 다시 시도해주세요.</EmptyBox>
          ) : posts === null ? (
            <SkeletonRows border={border} cardBg={cardBg} />
          ) : posts.length === 0 ? (
            <FirstPostInvite canWrite={canWrite} onWrite={() => navigate("/landing/board/write")} border={border} cardBg={cardBg} accent={gold} textPrimary={textPrimary} textSecondary={textSecondary} />
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {posts.map((p) => <BoardCard key={p.id} post={p} border={border} cardBg={cardBg} accent={gold} textPrimary={textPrimary} textSecondary={textSecondary} textMuted={textMuted} />)}
              </div>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} accent={gold} textPrimary={textPrimary} textSecondary={textSecondary} border={border} />
            </>
          )}
        </div>
      </section>

      <LandingFooter config={cfg} sections={cfg.sections || []} tokens={FOOTER_TOKENS_DARK} />
      <LandingRoleFab />
    </div>
  );
}

function BoardCard({ post, border, cardBg, accent, textPrimary, textSecondary, textMuted }: {
  post: PublicBoardPost; border: string; cardBg: string; accent: string;
  textPrimary: string; textSecondary: string; textMuted: string;
}) {
  return (
    <Link
      to={`/landing/board/${post.id}`}
      data-testid={`landing-board-card-${post.id}`}
      style={{
        display: "flex", flexDirection: "column", gap: 10, padding: 18,
        borderRadius: 14, border: `1px solid ${border}`, background: cardBg,
        textDecoration: "none", color: textPrimary,
        transition: "border-color 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${accent}66`; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {post.is_pinned && <Chip color={accent} bg={`${accent}22`}>고정</Chip>}
        {post.is_hot && <Chip color="#ef4444" bg="rgba(239,68,68,0.12)">HOT</Chip>}
        <Chip color={textSecondary} bg="rgba(255,255,255,0.04)">{categoryLabel(post.category)}</Chip>
      </div>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.4, letterSpacing: "-0.015em", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {post.title || "제목 없음"}
      </h3>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto", fontSize: 12, color: textMuted }}>
        <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.display_name}</span>
        <span style={{ display: "flex", gap: 10 }}>
          {post.like_count > 0 && <span style={{ color: accent, fontWeight: 700 }}>♥ {post.like_count}</span>}
          {post.reply_count > 0 && <span>💬 {post.reply_count}</span>}
          <span>{formatDate(post.created_at)}</span>
        </span>
      </div>
    </Link>
  );
}

function categoryLabel(c: BoardCategory): string {
  switch (c) {
    case "free": return "자유";
    case "tip": return "공부 팁";
    case "story": return "수강 이야기";
    case "question": return "질문";
    default: return "기타";
  }
}

function Chip({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color, letterSpacing: "0.05em",
      padding: "3px 8px", borderRadius: 999, background: bg,
    }}>{children}</span>
  );
}

function Pagination({ page, totalPages, onChange, accent, textPrimary, textSecondary, border }: {
  page: number; totalPages: number; onChange: (p: number) => void;
  accent: string; textPrimary: string; textSecondary: string; border: string;
}) {
  const windowSize = 10;
  const windowStart = Math.floor((page - 1) / windowSize) * windowSize + 1;
  const windowEnd = Math.min(windowStart + windowSize - 1, totalPages);
  const pages = useMemo(() => {
    const arr: number[] = [];
    for (let i = windowStart; i <= windowEnd; i++) arr.push(i);
    return arr;
  }, [windowStart, windowEnd]);
  if (totalPages <= 1) return null;
  const goto = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    onChange(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const btn: React.CSSProperties = {
    minWidth: 36, height: 36, borderRadius: 8, padding: "0 10px",
    border: `1px solid ${border}`, background: "transparent",
    cursor: "pointer", fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
  };
  return (
    <nav data-testid="landing-board-pagination" style={{ marginTop: 28, display: "flex", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button type="button" onClick={() => goto(windowStart - 1)} disabled={windowStart === 1}
        style={{ ...btn, color: textSecondary, opacity: windowStart === 1 ? 0.35 : 1 }}>‹</button>
      {pages.map((p) => {
        const on = p === page;
        return (
          <button key={p} type="button" onClick={() => goto(p)}
            data-testid={`landing-board-page-${p}`}
            style={{ ...btn, color: on ? "#0A0E1A" : textPrimary, background: on ? accent : "transparent", border: on ? `1px solid ${accent}` : `1px solid ${border}`, fontWeight: on ? 700 : 600 }}
          >{p}</button>
        );
      })}
      <button type="button" onClick={() => goto(windowEnd + 1)} disabled={windowEnd === totalPages}
        style={{ ...btn, color: textSecondary, opacity: windowEnd === totalPages ? 0.35 : 1 }}>›</button>
    </nav>
  );
}

function EmptyBox({ children, border, cardBg, color }: { children: React.ReactNode; border: string; cardBg: string; color: string }) {
  return <div style={{ padding: "56px 24px", borderRadius: 14, background: cardBg, border: `1px solid ${border}`, textAlign: "center", fontSize: 14, color }}>{children}</div>;
}

function FirstPostInvite({ canWrite, onWrite, border, cardBg, accent, textPrimary, textSecondary }: {
  canWrite: boolean; onWrite: () => void;
  border: string; cardBg: string; accent: string; textPrimary: string; textSecondary: string;
}) {
  return (
    <div style={{ padding: "72px 24px", borderRadius: 14, background: cardBg, border: `1px dashed ${border}`, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ fontSize: 42 }}>✍️</div>
      <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: textPrimary, letterSpacing: "-0.01em" }}>아직 글이 없습니다</p>
      <p style={{ margin: 0, fontSize: 13.5, color: textSecondary, lineHeight: 1.6, maxWidth: 460 }}>
        {canWrite
          ? "첫 글의 주인공이 되어 보세요. 학원 가족과 외부 학부모 모두 함께 읽습니다."
          : "학원 가족이 새 글을 올리면 여기에서 가장 먼저 만나실 수 있습니다."}
      </p>
      {canWrite && (
        <button type="button" onClick={onWrite} data-testid="landing-board-empty-write-cta"
          style={{ marginTop: 4, padding: "11px 22px", borderRadius: 999, border: "none", background: accent, color: "#0A0E1A", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em" }}
        >첫 글을 작성해 보세요 →</button>
      )}
    </div>
  );
}

function SkeletonRows({ border, cardBg }: { border: string; cardBg: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ padding: 18, borderRadius: 14, background: cardBg, border: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 10, height: 160 }}>
          <div style={{ height: 14, width: 70, borderRadius: 4, background: "rgba(255,255,255,0.06)" }} />
          <div style={{ height: 18, width: "85%", borderRadius: 4, background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.10), rgba(255,255,255,0.04))", backgroundSize: "200% 100%", animation: "lbSkel 1.4s ease-in-out infinite" }} />
          <div style={{ height: 14, width: "60%", borderRadius: 4, background: "rgba(255,255,255,0.04)" }} />
        </div>
      ))}
      <style>{`@keyframes lbSkel { 0% { background-position: 0% 50% } 100% { background-position: -200% 50% } }`}</style>
    </div>
  );
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    const now = new Date();
    const same = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (same) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch { return ""; }
}

// 의도하지 않은 lint warning(toggleBoardLike import 미사용)을 회피하기 위해
// 추후 detail/like UI에서 사용. 컴파일 keep-alive.
void toggleBoardLike;
