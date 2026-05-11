// PATH: src/landing/pages/LandingCommunityListPage.tsx
// 랜딩 커뮤니티 게시판 페이지 — /landing/community/:boardType
//
// nexon dnfm 스타일 — 탭(자유/질문/공지/자료) + 10개/page + 페이지네이션 (1 2 3 ... 10).
// 학원장 요청(2026-05-11): 무한스크롤 X, 10개씩 페이지 넘기는 방식.
//
// 비로그인 → 로그인 유도 안내 화면 (외부인은 학원 커뮤니티 안 보임 — tenant + 학생 사생활 보호).
// 로그인 → 권한대로 글 노출. backend 분기:
//   - board   → GET /community/posts/board/ (학생 권한 필터 + page)
//   - notice  → GET /community/posts/notices/
//   - materials → GET /community/posts/materials/
//   - qna     → GET /community/posts/?post_type=qna (학생은 본인 글만)
/* eslint-disable no-restricted-syntax */

import { useEffect, useMemo, useState } from "react";
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

const TABS: { key: BoardType; label: string }[] = [
  { key: "board", label: "자유게시판" },
  { key: "qna", label: "질문게시판" },
  { key: "notice", label: "공지사항" },
  { key: "materials", label: "자료실" },
];

interface CommunityPost {
  id: number;
  post_type: BoardType | string;
  title: string;
  created_by_display: string | null;
  author_role?: string | null;
  is_pinned?: boolean;
  is_urgent?: boolean;
  replies_count?: number;
  created_at?: string;
  published_at?: string | null;
}

const PAGE_SIZE = 10;
const PAGE_WINDOW = 10; // 한 번에 보이는 페이지 버튼 수 (1..10, 11..20, ...)

function endpointFor(t: BoardType): { url: string; params?: Record<string, string | number> } {
  if (t === "board") return { url: "/community/posts/board/" };
  if (t === "notice") return { url: "/community/posts/notices/" };
  if (t === "materials") return { url: "/community/posts/materials/" };
  return { url: "/community/posts/", params: { post_type: "qna" } };
}

function BrandMark({ name }: { name: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #D4A04C 0%, #8B5E1F 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0E1A", fontSize: 18, fontWeight: 800 }}>{initial}</div>
  );
}

export default function LandingCommunityListPage() {
  const { boardType } = useParams<{ boardType: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const isValid = VALID.includes(boardType as BoardType);
  const active = (isValid ? (boardType as BoardType) : "board");

  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);

  // 정렬 + 검색 (사용자 요청 — backend 미지원 칼럼은 client-side fallback)
  const [sort, setSort] = useState<"latest" | "replies">("latest");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState(""); // debounced 적용된 실제 query

  // query input → 300ms 디바운스 후 실제 query 반영
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(queryInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [queryInput]);

  useEffect(() => { fetchLandingPublic().then(setLanding).catch(() => setLanding(null)); }, []);
  useEffect(() => { setPage(1); }, [active, sort, query]);

  useEffect(() => {
    if (!isAuthenticated) { setPosts([]); setCount(0); return; }
    setPosts(null);
    setError(false);
    const { url, params } = endpointFor(active);
    const fetchParams: Record<string, string | number> = { ...(params || {}), page, page_size: PAGE_SIZE };
    if (query) fetchParams.q = query;
    api.get(url, { params: fetchParams } as ApiRequestConfig)
      .then((r) => {
        const data = r?.data;
        const results: CommunityPost[] = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
        const total = typeof data?.count === "number" ? data.count : results.length;
        // client-side 정렬: backend ordering 미지원 시 페이지 안에서만 재정렬
        const sorted = sort === "replies"
          ? results.slice().sort((a, b) => (b.replies_count ?? 0) - (a.replies_count ?? 0))
          : results;
        setPosts(sorted);
        setCount(total);
      })
      .catch(() => { setError(true); setPosts([]); setCount(0); });
  }, [active, page, isAuthenticated, sort, query]);

  // 잘못된 board_type → 자유게시판으로 redirect
  if (boardType && !isValid) return <Navigate to="/landing/community/board" replace />;

  if (!landing) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#D4A04C", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const cfg = landing.config!;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const tabLabel = TABS.find((t) => t.key === active)?.label || "게시판";

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
      <LandingNavBar
        config={cfg}
        sections={cfg.sections || []}
        tokens={NAV_TOKENS}
        brandMark={<BrandMark name={cfg.brand_name} />}
      />

      {/* 헤더 — 카테고리 라벨 + 페이지 타이틀 */}
      <section style={{ padding: "48px 24px 24px", borderBottom: `1px solid ${border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Community · 커뮤니티
          </div>
          <h1 style={{ fontSize: "clamp(24px, 3vw, 34px)", fontWeight: 800, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.25 }}>
            {tabLabel}
          </h1>
        </div>
      </section>

      {/* 탭 */}
      <section style={{ padding: "0 24px", background: bg, borderBottom: `1px solid ${border}`, position: "sticky", top: 64, zIndex: 30, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 0, overflowX: "auto" }}>
          {TABS.map((t) => {
            const on = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => navigate(`/landing/community/${t.key}`)}
                data-testid={`landing-community-list-tab-${t.key}`}
                style={{
                  padding: "14px 18px", border: "none", background: "transparent",
                  color: on ? textPrimary : textSecondary,
                  fontSize: 14.5, fontWeight: on ? 700 : 600, cursor: "pointer",
                  letterSpacing: "-0.01em", whiteSpace: "nowrap",
                  borderBottom: `2px solid ${on ? gold : "transparent"}`,
                  marginBottom: -1,
                }}
              >{t.label}</button>
            );
          })}
        </div>
      </section>

      {/* 본문 */}
      <section style={{ padding: "32px 24px 64px", background: bgAlt, minHeight: "60vh" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* 정렬 + 검색 — 로그인 시에만 노출 */}
          {isAuthenticated && (
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <SortChip on={sort === "latest"} onClick={() => setSort("latest")} accent={gold} textPrimary={textPrimary} textSecondary={textSecondary}>최신순</SortChip>
                <SortChip on={sort === "replies"} onClick={() => setSort("replies")} accent={gold} textPrimary={textPrimary} textSecondary={textSecondary}>댓글순</SortChip>
              </div>
              <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="2"
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                ><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input
                  type="search"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="제목·내용 검색"
                  data-testid="landing-community-search"
                  style={{
                    width: "100%", padding: "9px 12px 9px 34px", borderRadius: 999,
                    border: `1px solid ${border}`, background: cardBg,
                    color: textPrimary, fontSize: 13, fontFamily: "inherit", outline: "none",
                  }}
                />
              </div>
            </div>
          )}
          {!isAuthenticated ? (
            <LoginGuard textPrimary={textPrimary} textSecondary={textSecondary} accent={gold} cardBg={cardBg} border={border} />
          ) : error ? (
            <EmptyBox textSecondary={textSecondary} cardBg={cardBg} border={border}>잠시 후 다시 시도해주세요.</EmptyBox>
          ) : posts === null ? (
            <SkeletonRows cardBg={cardBg} border={border} />
          ) : posts.length === 0 ? (
            <EmptyBox textSecondary={textSecondary} cardBg={cardBg} border={border}>아직 등록된 글이 없습니다.</EmptyBox>
          ) : (
            <>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 1, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden", background: cardBg }}>
                {posts.map((p) => (
                  <li key={p.id} style={{ background: cardBg }}>
                    <Link
                      to={`/landing/community/${active}/posts/${p.id}`}
                      data-testid={`landing-community-row-${p.id}`}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", textDecoration: "none", color: textPrimary, borderBottom: `1px solid ${border}`, transition: "background 0.12s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = cardBg; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                        {p.is_pinned && <Chip color={gold} bg="rgba(212,160,76,0.12)">고정</Chip>}
                        {p.is_urgent && <Chip color="#ef4444" bg="rgba(239,68,68,0.1)">중요</Chip>}
                        <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                          {p.title || "제목 없음"}
                        </span>
                        {(p.replies_count ?? 0) > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: gold, flexShrink: 0 }}>[{p.replies_count}]</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: textMuted, flexShrink: 0 }}>
                        <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.created_by_display || "관리자"}</span>
                        <span style={{ opacity: 0.5 }}>·</span>
                        <span>{formatDate(p.published_at || p.created_at)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
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

function Chip({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 999, background: bg, flexShrink: 0 }}>{children}</span>
  );
}

function SortChip({ on, onClick, accent, textPrimary, textSecondary, children }: { on: boolean; onClick: () => void; accent: string; textPrimary: string; textSecondary: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px", borderRadius: 999, border: "none",
        background: on ? `${accent}26` : "transparent",
        color: on ? textPrimary : textSecondary,
        fontSize: 12.5, fontWeight: on ? 700 : 600, cursor: "pointer", letterSpacing: "-0.01em",
      }}
    >{children}</button>
  );
}

function Pagination({ page, totalPages, onChange, accent, textPrimary, textSecondary, border }: {
  page: number; totalPages: number; onChange: (p: number) => void;
  accent: string; textPrimary: string; textSecondary: string; border: string;
}) {
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1;
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages);
  const pages = useMemo(() => {
    const arr: number[] = [];
    for (let i = windowStart; i <= windowEnd; i++) arr.push(i);
    return arr;
  }, [windowStart, windowEnd]);

  const goto = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    onChange(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (totalPages <= 1) return null;

  const btnBase: React.CSSProperties = {
    minWidth: 36, height: 36, borderRadius: 8, padding: "0 10px",
    border: `1px solid ${border}`, background: "transparent",
    cursor: "pointer", fontSize: 13, fontWeight: 600,
    letterSpacing: "-0.01em",
  };

  return (
    <nav data-testid="landing-community-pagination" style={{ marginTop: 28, display: "flex", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button type="button" onClick={() => goto(windowStart - 1)} disabled={windowStart === 1} title="이전 10페이지"
        style={{ ...btnBase, color: textSecondary, opacity: windowStart === 1 ? 0.35 : 1, cursor: windowStart === 1 ? "not-allowed" : "pointer" }}
      >‹</button>
      {pages.map((p) => {
        const on = p === page;
        return (
          <button key={p} type="button" onClick={() => goto(p)}
            data-testid={`landing-community-page-${p}`}
            style={{
              ...btnBase,
              color: on ? "#0A0E1A" : textPrimary,
              background: on ? accent : "transparent",
              border: on ? `1px solid ${accent}` : `1px solid ${border}`,
              fontWeight: on ? 700 : 600,
            }}
          >{p}</button>
        );
      })}
      <button type="button" onClick={() => goto(windowEnd + 1)} disabled={windowEnd === totalPages} title="다음 10페이지"
        style={{ ...btnBase, color: textSecondary, opacity: windowEnd === totalPages ? 0.35 : 1, cursor: windowEnd === totalPages ? "not-allowed" : "pointer" }}
      >›</button>
    </nav>
  );
}

function LoginGuard({ textPrimary, textSecondary, accent, cardBg, border }: { textPrimary: string; textSecondary: string; accent: string; cardBg: string; border: string }) {
  return (
    <div style={{ padding: "56px 24px", borderRadius: 14, background: cardBg, border: `1px solid ${border}`, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ fontSize: 36, opacity: 0.9 }}>🔒</div>
      <p style={{ fontSize: 17, fontWeight: 700, color: textPrimary, margin: 0, letterSpacing: "-0.01em" }}>
        커뮤니티는 학원 가족만 볼 수 있어요
      </p>
      <p style={{ fontSize: 14, color: textSecondary, margin: 0, lineHeight: 1.6, maxWidth: 460 }}>
        학원 등록된 학생·학부모·강사 계정으로 로그인하시면
        <br />게시글과 댓글, 좋아요까지 모두 확인하실 수 있습니다.
      </p>
      <Link
        to="/login"
        data-testid="landing-community-list-login-cta"
        style={{ marginTop: 8, padding: "11px 24px", borderRadius: 999, background: accent, color: "#0A0E1A", textDecoration: "none", fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}
      >로그인하고 커뮤니티 보기 →</Link>
    </div>
  );
}

function EmptyBox({ children, textSecondary, cardBg, border }: { children: React.ReactNode; textSecondary: string; cardBg: string; border: string }) {
  return (
    <div style={{ padding: "56px 24px", borderRadius: 14, background: cardBg, border: `1px solid ${border}`, textAlign: "center", fontSize: 14, color: textSecondary }}>
      {children}
    </div>
  );
}

function SkeletonRows({ cardBg, border }: { cardBg: string; border: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden", background: cardBg }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} style={{ padding: "14px 18px", background: cardBg, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ height: 16, flex: 1, maxWidth: 540, borderRadius: 4, background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.1), rgba(255,255,255,0.04))", backgroundSize: "200% 100%", animation: "landingSkelRow 1.4s ease-in-out infinite" }} />
          <div style={{ height: 12, width: 60, borderRadius: 4, background: "rgba(255,255,255,0.06)" }} />
        </div>
      ))}
      <style>{`@keyframes landingSkelRow { 0% { background-position: 0% 50% } 100% { background-position: -200% 50% } }`}</style>
    </div>
  );
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    const now = new Date();
    const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (sameDay) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch { return ""; }
}
