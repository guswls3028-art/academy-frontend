// PATH: src/landing/components/LandingCommunityShowcase.tsx
// 메인 랜딩 footer 직전 외부 공개 커뮤니티 통합 미리보기 (2026-05-12 #L1).
//
// 본질: 랜딩 = 외부 공개 트랙. family-only(공지/QnA/자료실/상담)는 학생/선생/어드민앱.
// 두 축만 노출:
//   1) 수강 후기 (Reviews) — 평점 KPI band + 최근 후기 3장
//   2) 자유게시판 (Public Board) — 최근 글 3장
// 외부 비로그인 학부모도 read OK. tenant 격리는 backend에서 보장.
//
// 이전 CommunityPreviewSection(family-only 4탭) → 본 컴포넌트로 대체.
// theme=dark|light — 템플릿 톤에 맞춰 자동 분기.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchBoardList,
  fetchReviewsList,
  fetchReviewsSummary,
  type PublicBoardPost,
  type PublicReview,
  type ReviewsSummary,
} from "../api/publicCommunity";

interface Props {
  theme?: "dark" | "light";
}

export default function LandingCommunityShowcase({ theme = "dark" }: Props) {
  const [boardPosts, setBoardPosts] = useState<PublicBoardPost[] | null>(null);
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);
  const [summary, setSummary] = useState<ReviewsSummary | null>(null);

  useEffect(() => {
    fetchBoardList({ page: 1, page_size: 3, ordering: "latest" })
      .then((r) => setBoardPosts(r.results)).catch(() => setBoardPosts([]));
    fetchReviewsList({ page: 1, page_size: 3, ordering: "latest" })
      .then((r) => setReviews(r.results)).catch(() => setReviews([]));
    fetchReviewsSummary().then(setSummary).catch(() => setSummary(null));
  }, []);

  const dark = theme === "dark";
  const bg = dark ? "#0A0E1A" : "#FFFFFF";
  const bgAlt = dark ? "rgba(255,255,255,0.03)" : "#F8FAFC";
  const border = dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";
  const textPrimary = dark ? "#F5F1E8" : "#0F172A";
  const textSecondary = dark ? "#9CA3AF" : "#475569";
  const textMuted = dark ? "#6B7280" : "#94A3B8";
  const accent = dark ? "#D4A04C" : "#2563EB";
  const cardBg = dark ? "rgba(255,255,255,0.02)" : "#FFFFFF";

  // 두 트랙 모두 비어 있고 KPI도 없으면 섹션 숨김 (학원장 데이터 0 상태)
  const hasBoard = (boardPosts?.length ?? 0) > 0;
  const hasReviews = (reviews?.length ?? 0) > 0;
  const hasSummary = (summary?.count ?? 0) > 0;
  if (boardPosts !== null && reviews !== null && !hasBoard && !hasReviews && !hasSummary) {
    return null;
  }

  return (
    <section
      data-stype="community_preview"
      style={{ background: bg, borderTop: `1px solid ${border}`, padding: "72px 24px 64px" }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr", gap: 48 }}>

        {/* ─── Reviews 축 ─── */}
        <div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Reviews · 수강 후기
              </div>
              <h2 style={{ fontSize: "clamp(22px, 2.6vw, 30px)", fontWeight: 800, color: textPrimary, letterSpacing: "-0.025em", margin: 0, lineHeight: 1.25 }}>
                학원 가족의 진짜 수강 후기
              </h2>
              {summary && summary.count > 0 && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: textSecondary }}>
                  <Stars n={Math.round(summary.average)} gold={accent} />
                  <span style={{ color: textPrimary, fontWeight: 700 }}>{summary.average.toFixed(2)}</span>
                  <span>·</span>
                  <span>누적 후기 {summary.count}건</span>
                </div>
              )}
            </div>
            <Link to="/landing/reviews" data-testid="landing-reviews-more"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 16px", borderRadius: 999,
                background: "transparent", border: `1px solid ${border}`,
                color: textSecondary, textDecoration: "none",
                fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
              }}
            >
              후기 모두 보기
              <Chevron />
            </Link>
          </div>

          {reviews === null ? (
            <SkelGrid border={border} cardBg={cardBg} count={3} height={160} />
          ) : reviews.length === 0 ? (
            <Empty cardBg={cardBg} border={border} textSecondary={textSecondary}>아직 등록된 후기가 없습니다.</Empty>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {reviews.slice(0, 3).map((r) => (
                <Link key={r.id} to={`/landing/reviews/${r.id}`} data-testid={`landing-showcase-review-${r.id}`}
                  style={{
                    display: "flex", flexDirection: "column", gap: 10,
                    padding: 20, borderRadius: 16, background: cardBg, border: `1px solid ${border}`,
                    color: textPrimary, textDecoration: "none",
                    transition: "border-color 0.15s, transform 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${accent}66`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Stars n={r.rating} gold={accent} />
                    {r.is_verified && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: accent, padding: "3px 8px", borderRadius: 999, background: `${accent}1F`, letterSpacing: "0.05em" }}>✓ 수강 인증</span>
                    )}
                  </div>
                  {r.title && <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.4, letterSpacing: "-0.015em", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{r.title}</h3>}
                  {(r.grade || r.subject) && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11.5, color: textMuted }}>
                      {r.grade && <span style={{ padding: "2px 8px", borderRadius: 999, background: bgAlt }}>{r.grade}</span>}
                      {r.subject && <span style={{ padding: "2px 8px", borderRadius: 999, background: bgAlt }}>{r.subject}</span>}
                    </div>
                  )}
                  <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: textMuted, paddingTop: 4 }}>
                    <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.display_name}</span>
                    <span>{formatDate(r.created_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ─── Board 축 ─── */}
        <div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Public Board · 자유게시판
              </div>
              <h2 style={{ fontSize: "clamp(22px, 2.6vw, 30px)", fontWeight: 800, color: textPrimary, letterSpacing: "-0.025em", margin: 0, lineHeight: 1.25 }}>
                학원 가족이 함께 쓰는 자유게시판
              </h2>
            </div>
            <Link to="/landing/board" data-testid="landing-board-more"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 16px", borderRadius: 999,
                background: "transparent", border: `1px solid ${border}`,
                color: textSecondary, textDecoration: "none",
                fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
              }}
            >
              게시판 모두 보기
              <Chevron />
            </Link>
          </div>

          {boardPosts === null ? (
            <SkelRows border={border} cardBg={cardBg} count={3} />
          ) : boardPosts.length === 0 ? (
            <Empty cardBg={cardBg} border={border} textSecondary={textSecondary}>아직 등록된 글이 없습니다.</Empty>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 1, borderRadius: 12, overflow: "hidden", border: `1px solid ${border}`, background: cardBg }}>
              {boardPosts.slice(0, 3).map((p) => (
                <li key={p.id} style={{ background: cardBg }}>
                  <Link to={`/landing/board/${p.id}`} data-testid={`landing-showcase-board-${p.id}`}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                      padding: "16px 20px", textDecoration: "none", color: textPrimary,
                      borderBottom: `1px solid ${border}`, transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = bgAlt; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = cardBg; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                      {p.is_pinned && <Chip color={accent} bg={`${accent}22`}>고정</Chip>}
                      {p.is_hot && <Chip color="#ef4444" bg="rgba(239,68,68,0.12)">HOT</Chip>}
                      <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                        {p.title || "제목 없음"}
                      </span>
                      {p.reply_count > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: accent, flexShrink: 0 }}>[{p.reply_count}]</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: textMuted, flexShrink: 0 }}>
                      <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.display_name}</span>
                      <span style={{ opacity: 0.5 }}>·</span>
                      <span>{formatDate(p.created_at)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Stars({ n, gold }: { n: number; gold: string }) {
  const stars = "★★★★★".slice(0, Math.max(0, Math.min(5, n)));
  const dim = "★★★★★".slice(0, 5 - Math.max(0, Math.min(5, n)));
  return (
    <span style={{ letterSpacing: 2, fontSize: 14 }}>
      <span style={{ color: gold }}>{stars}</span>
      <span style={{ color: "rgba(140,140,140,0.4)" }}>{dim}</span>
    </span>
  );
}

function Chevron() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9,18 15,12 9,6" /></svg>;
}

function Chip({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.05em", padding: "2px 7px", borderRadius: 999, background: bg, flexShrink: 0 }}>{children}</span>
  );
}

function Empty({ children, cardBg, border, textSecondary }: { children: React.ReactNode; cardBg: string; border: string; textSecondary: string }) {
  return <div style={{ padding: "32px 24px", borderRadius: 14, background: cardBg, border: `1px dashed ${border}`, textAlign: "center", fontSize: 14, color: textSecondary }}>{children}</div>;
}

function SkelGrid({ border, cardBg, count, height }: { border: string; cardBg: string; count: number; height: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ height, borderRadius: 16, background: cardBg, border: `1px solid ${border}` }} />
      ))}
    </div>
  );
}

function SkelRows({ border, cardBg, count }: { border: string; cardBg: string; count: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, borderRadius: 12, overflow: "hidden", border: `1px solid ${border}` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ height: 52, background: cardBg }} />
      ))}
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
