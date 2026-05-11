// PATH: src/landing/components/CommunityPreviewSection.tsx
// 랜딩 메인 footer 직전에 노출되는 커뮤니티 미리보기 섹션.
// nexon dnfm 4번째 스크린샷 — "커뮤니티 +" + 탭 (자유/질문/공지/자료) + 최근 5개 글 카드.
//
// 비로그인 외부 학부모 → 로그인 유도 안내(실제 글 노출 X — tenant 격리 + 학생 사생활)
// 로그인 → 기존 backend community endpoint(/api/v1/community/posts/)에서 권한대로 글 fetch.
//
// theme="dark" / "light" — template 톤에 맞춰 자동 분기.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { type ApiRequestConfig } from "@/shared/api/axios";
import useAuth from "@/auth/hooks/useAuth";

type BoardType = "board" | "qna" | "notice" | "materials";

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

const TABS: { key: BoardType; label: string }[] = [
  { key: "board", label: "자유게시판" },
  { key: "qna", label: "질문게시판" },
  { key: "notice", label: "공지사항" },
  { key: "materials", label: "자료실" },
];

export default function CommunityPreviewSection({ theme = "dark" }: { theme?: "dark" | "light" }) {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<BoardType>("board");
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [error, setError] = useState(false);

  // 톤 토큰 — template 다크/라이트에 맞춤
  const dark = theme === "dark";
  const bg = dark ? "#0A0E1A" : "#FFFFFF";
  const bgAlt = dark ? "rgba(255,255,255,0.03)" : "#F8FAFC";
  const border = dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";
  const textPrimary = dark ? "#F5F1E8" : "#0F172A";
  const textSecondary = dark ? "#9CA3AF" : "#475569";
  const textMuted = dark ? "#6B7280" : "#94A3B8";
  const accent = dark ? "#D4A04C" : "#2563EB";
  const cardBg = dark ? "rgba(255,255,255,0.02)" : "#FFFFFF";

  useEffect(() => {
    if (!isAuthenticated) { setPosts([]); return; }
    setPosts(null); // loading
    setError(false);
    api.get("/community/posts/", { params: { post_type: activeTab, page_size: 5 } } as ApiRequestConfig)
      .then((r) => {
        const raw = Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.results) ? r.data.results : [];
        // 일부 backend는 published_at 또는 created_at 정렬. 클라이언트에서 한번 더 정렬 안전.
        const sorted = (raw as CommunityPost[])
          .filter((p) => p && (p.title || p.id))
          .slice()
          .sort((a, b) => {
            const ka = a.published_at || a.created_at || "";
            const kb = b.published_at || b.created_at || "";
            return kb.localeCompare(ka);
          })
          .slice(0, 5);
        setPosts(sorted);
      })
      .catch(() => { setError(true); setPosts([]); });
  }, [activeTab, isAuthenticated]);

  return (
    <section
      data-stype="community_preview"
      style={{
        background: bg,
        borderTop: `1px solid ${border}`,
        padding: "64px 24px",
        fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* 헤더: 카테고리 라벨 + 타이틀 + 우측 액션 */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{
              fontSize: 12, fontWeight: 700, color: accent,
              letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8,
            }}>Community · 커뮤니티</div>
            <h2 style={{
              fontSize: "clamp(22px, 2.6vw, 30px)", fontWeight: 800,
              color: textPrimary, letterSpacing: "-0.025em", margin: 0, lineHeight: 1.25,
            }}>학원장과 학생이 함께 쓰는 커뮤니티</h2>
          </div>
          <Link
            to={`/landing/community/${activeTab}`}
            data-testid="landing-community-more"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 999,
              background: "transparent", border: `1px solid ${border}`,
              color: textSecondary, textDecoration: "none",
              fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
            }}
          >
            전체 보기
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9,18 15,12 9,6" /></svg>
          </Link>
        </div>

        {/* 탭 */}
        <div style={{
          display: "flex", gap: 0, overflowX: "auto",
          borderBottom: `1px solid ${border}`, marginBottom: 16,
        }}>
          {TABS.map((t) => {
            const active = t.key === activeTab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                data-testid={`landing-community-tab-${t.key}`}
                style={{
                  padding: "12px 18px", border: "none", background: "transparent",
                  color: active ? textPrimary : textSecondary,
                  fontSize: 14.5, fontWeight: active ? 700 : 600,
                  cursor: "pointer", letterSpacing: "-0.01em",
                  borderBottom: `2px solid ${active ? accent : "transparent"}`,
                  marginBottom: -1,
                  whiteSpace: "nowrap",
                }}
              >{t.label}</button>
            );
          })}
        </div>

        {/* 본문 */}
        {!isAuthenticated ? (
          <LoginGuard textPrimary={textPrimary} textSecondary={textSecondary} accent={accent} cardBg={cardBg} border={border} />
        ) : posts === null ? (
          <SkeletonList border={border} bgAlt={bgAlt} />
        ) : error ? (
          <EmptyState text="잠시 후 다시 시도해주세요." textSecondary={textSecondary} cardBg={cardBg} border={border} />
        ) : posts.length === 0 ? (
          <EmptyState text="아직 등록된 글이 없습니다." textSecondary={textSecondary} cardBg={cardBg} border={border} />
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 1, borderRadius: 12, overflow: "hidden", border: `1px solid ${border}`, background: cardBg }}>
            {posts.map((p) => (
              <li key={p.id} style={{ background: cardBg }}>
                <Link
                  to={`/landing/community/${activeTab}/posts/${p.id}`}
                  data-testid={`landing-community-post-${p.id}`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    padding: "14px 18px",
                    textDecoration: "none", color: textPrimary,
                    borderBottom: `1px solid ${border}`,
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = bgAlt; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = cardBg; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    {p.is_pinned && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 999, background: dark ? "rgba(212,160,76,0.12)" : "rgba(37,99,235,0.08)", flexShrink: 0 }}>고정</span>
                    )}
                    {p.is_urgent && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 999, background: "rgba(239,68,68,0.1)", flexShrink: 0 }}>중요</span>
                    )}
                    <span style={{
                      fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.01em",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      flex: 1, minWidth: 0,
                    }}>{p.title || "제목 없음"}</span>
                    {(p.replies_count ?? 0) > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: accent, flexShrink: 0 }}>
                        [{p.replies_count}]
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: textMuted, flexShrink: 0 }}>
                    <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.created_by_display || "관리자"}</span>
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span>{formatDate(p.published_at || p.created_at)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function LoginGuard({ textPrimary, textSecondary, accent, cardBg, border }: { textPrimary: string; textSecondary: string; accent: string; cardBg: string; border: string }) {
  return (
    <div style={{
      padding: "40px 24px", borderRadius: 14,
      background: cardBg, border: `1px solid ${border}`,
      textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
    }}>
      <div style={{ fontSize: 28, opacity: 0.9 }}>💬</div>
      <p style={{ fontSize: 15.5, fontWeight: 700, color: textPrimary, margin: 0, letterSpacing: "-0.01em" }}>
        커뮤니티는 로그인한 학원 가족만 볼 수 있어요
      </p>
      <p style={{ fontSize: 13.5, color: textSecondary, margin: 0, lineHeight: 1.6, maxWidth: 420 }}>
        학원 등록된 학생·학부모·강사 계정으로 로그인하시면
        <br />최근 게시글과 질문, 공지사항을 모두 확인할 수 있습니다.
      </p>
      <Link
        to="/login"
        data-testid="landing-community-login-cta"
        style={{
          marginTop: 6,
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "10px 22px", borderRadius: 999,
          background: accent, color: "#0A0E1A",
          textDecoration: "none", fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em",
        }}
      >
        로그인하고 커뮤니티 보기
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12,5 19,12 12,19" /></svg>
      </Link>
    </div>
  );
}

function SkeletonList({ border, bgAlt }: { border: string; bgAlt: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, borderRadius: 12, overflow: "hidden", border: `1px solid ${border}` }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{
          padding: "14px 18px", background: bgAlt,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{
            height: 16, flex: 1, maxWidth: 480, borderRadius: 4,
            background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.1), rgba(255,255,255,0.04))",
            backgroundSize: "200% 100%",
            animation: "landingSkel 1.4s ease-in-out infinite",
          }} />
          <div style={{ height: 12, width: 60, borderRadius: 4, background: "rgba(255,255,255,0.06)" }} />
        </div>
      ))}
      <style>{`@keyframes landingSkel { 0% { background-position: 0% 50% } 100% { background-position: -200% 50% } }`}</style>
    </div>
  );
}

function EmptyState({ text, textSecondary, cardBg, border }: { text: string; textSecondary: string; cardBg: string; border: string }) {
  return (
    <div style={{
      padding: "40px 24px", borderRadius: 14, background: cardBg, border: `1px solid ${border}`,
      textAlign: "center", fontSize: 14, color: textSecondary,
    }}>{text}</div>
  );
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    const now = new Date();
    const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (sameDay) {
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch { return ""; }
}
