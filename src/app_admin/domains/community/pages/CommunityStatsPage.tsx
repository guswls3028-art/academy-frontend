// PATH: src/app_admin/domains/community/pages/CommunityStatsPage.tsx
// 학원장 커뮤니티 통계 — /admin/community/stats
//
// 최근 N일 게시판별 글/댓글/좋아요/신고 카운트 + top posts.
// 사용자 spec(2026-05-11 추가 cycle #10).
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { type ApiRequestConfig } from "@/shared/api/axios";

interface StatsResponse {
  days: number;
  posts: { total: number; by_type: Record<string, number> };
  replies_total: number;
  likes: { post: number; reply: number; total: number };
  reports: { total: number; by_status: Record<string, number> };
  top_posts: { id: number; title: string; post_type: string; period_likes: number; period_replies: number }[];
}

const POST_TYPE_LABEL: Record<string, string> = {
  notice: "공지사항",
  board: "자유게시판",
  qna: "질문게시판",
  materials: "자료실",
  counsel: "상담",
};

const DAYS_OPTIONS = [7, 30, 90];

export default function CommunityStatsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setData(null); setError(false);
    api.get("/community/admin/stats/", { params: { days } } as ApiRequestConfig)
      .then((r) => setData(r.data as StatsResponse))
      .catch(() => setError(true));
  }, [days]);

  return (
    <div style={{ padding: "24px 28px 80px", fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      <header style={{ marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            Community · 활동 통계
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>커뮤니티 활동 통계</h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>최근 {days}일 게시판 활동 카운트 + 인기 게시글.</p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {DAYS_OPTIONS.map((d) => {
            const on = d === days;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                style={{
                  padding: "8px 14px", borderRadius: 999, border: "none",
                  background: on ? "rgba(37,99,235,0.10)" : "transparent",
                  color: on ? "#1E40AF" : "#475569",
                  fontSize: 13, fontWeight: on ? 700 : 600, cursor: "pointer",
                }}
              >최근 {d}일</button>
            );
          })}
        </div>
      </header>

      {error ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", background: "#F8FAFC", borderRadius: 12 }}>잠시 후 다시 시도해 주세요.</div>
      ) : data === null ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>불러오는 중…</div>
      ) : (
        <>
          {/* KPI summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 22 }}>
            <Kpi label="신규 글" value={data.posts.total} accent="#2563EB" />
            <Kpi label="새 댓글" value={data.replies_total} accent="#7C3AED" />
            <Kpi label="좋아요" value={data.likes.total} accent="#D4A04C" subtitle={`글 ${data.likes.post} · 댓글 ${data.likes.reply}`} />
            <Kpi
              label="신고"
              value={data.reports.total}
              accent={data.reports.by_status?.pending ? "#DC2626" : "#94A3B8"}
              subtitle={data.reports.by_status?.pending ? `대기 ${data.reports.by_status.pending}건` : "대기 0건"}
            />
          </div>

          {/* 게시판별 글 카운트 bar */}
          <section style={{ marginBottom: 30, padding: 20, borderRadius: 14, background: "#fff", border: "1px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: "0 0 14px" }}>게시판별 신규 글</h2>
            <BarChart data={data.posts.by_type} labelMap={POST_TYPE_LABEL} />
          </section>

          {/* top posts */}
          <section style={{ padding: 20, borderRadius: 14, background: "#fff", border: "1px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: "0 0 14px" }}>인기 게시글 (좋아요 + 댓글)</h2>
            {data.top_posts.length === 0 ? (
              <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>이번 기간 활동이 없습니다.</p>
            ) : (
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {data.top_posts.map((p, i) => (
                  <li key={p.id} style={{ padding: "10px 14px", borderRadius: 10, background: "#F8FAFC", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "#94A3B8", minWidth: 24 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.title || "(제목 없음)"}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>
                        {POST_TYPE_LABEL[p.post_type] || p.post_type} · ♥ {p.period_likes} · 💬 {p.period_replies}
                      </div>
                    </div>
                    <Link to={`/landing/community/${p.post_type}/posts/${p.id}`} target="_blank" rel="noopener noreferrer"
                      style={{ padding: "6px 12px", borderRadius: 8, background: "#fff", border: "1px solid #CBD5E1", color: "#475569", fontSize: 11.5, fontWeight: 600, textDecoration: "none" }}
                    >보기 ↗</Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, accent, subtitle }: { label: string; value: number; accent: string; subtitle?: string }) {
  return (
    <div style={{ padding: "18px 20px", borderRadius: 14, background: "#fff", border: `1px solid #E2E8F0`, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{value.toLocaleString()}</div>
      {subtitle && <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

function BarChart({ data, labelMap }: { data: Record<string, number>; labelMap: Record<string, string> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>데이터 없음.</p>;
  const max = Math.max(...entries.map(([_, v]) => v), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {entries.map(([k, v]) => {
        const pct = Math.max(2, Math.round((v / max) * 100));
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", minWidth: 90 }}>{labelMap[k] || k}</span>
            <div style={{ flex: 1, height: 14, borderRadius: 999, background: "#F1F5F9", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #2563EB 0%, #6366F1 100%)", borderRadius: 999, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", minWidth: 36, textAlign: "right" }}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}
