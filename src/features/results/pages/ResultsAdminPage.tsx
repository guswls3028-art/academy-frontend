/**
 * 성적 (사이드바) — 아이콘 카드 그리드 · 강의별 성적 진입점
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchLectures } from "@/features/lectures/api/sessions";
import { DomainLayout } from "@/shared/ui/layout";
import { EmptyState, Button } from "@/shared/ui/ds";

/* ── 아이콘 SVG ── */
const ScoreIcon = ({ size = 40, color = "var(--color-primary)" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect x="4" y="32" width="6" height="0" rx="1" fill="none" />
    <rect x="6" y="18" width="6" height="16" rx="2" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.4" />
    <rect x="17" y="10" width="6" height="24" rx="2" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="1.4" />
    <rect x="28" y="6" width="6" height="28" rx="2" fill={color} fillOpacity="0.55" stroke={color} strokeWidth="1.4" />
    <path d="M4 36h32" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const cardBase: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "24px 16px",
  borderRadius: "var(--radius-lg, 12px)",
  border: "1px solid var(--color-border-divider)",
  background: "var(--color-bg-surface)",
  cursor: "pointer",
  transition: "all 0.15s ease",
  minHeight: 160,
  textAlign: "center" as const,
};

export default function ResultsAdminPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data: lectures = [], isLoading } = useQuery({
    queryKey: ["admin-results-lectures"],
    queryFn: () => fetchLectures({ is_active: undefined }),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return lectures;
    const k = search.trim().toLowerCase();
    return lectures.filter(
      (l) =>
        (l.title && l.title.toLowerCase().includes(k)) ||
        (l.name && l.name.toLowerCase().includes(k)) ||
        (l.subject && l.subject.toLowerCase().includes(k))
    );
  }, [lectures, search]);

  return (
    <DomainLayout title="성적" description="강의별 시험 · 과제 성적을 통합 조회합니다.">
      <style>{`
        .score-domain-card:hover {
          border-color: var(--color-primary) !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          transform: translateY(-2px);
        }
      `}</style>

      <div style={{ marginBottom: 16 }}>
        <input
          className="ds-input"
          placeholder="강의명 · 과목 검색"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onBlur={() => setSearch(searchInput)}
          onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중..." />
      ) : !filtered.length ? (
        <EmptyState
          scope="panel"
          tone="empty"
          title="강의가 없습니다"
          description="강의를 추가하면 시험 · 과제 성적을 여기서 확인할 수 있습니다."
          actions={
            <Button intent="primary" onClick={() => navigate("/admin/lectures")}>
              강의 목록
            </Button>
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((l) => (
            <div
              key={l.id}
              className="score-domain-card"
              style={cardBase}
              onClick={() => navigate(`/admin/lectures/${l.id}`)}
              title={`${l.title || l.name} — 성적 보기`}
            >
              <ScoreIcon
                color={l.is_active ? "var(--color-primary)" : "var(--color-text-muted)"}
              />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.3, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {l.title || l.name || "강의"}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.2 }}>
                {l.subject || "—"}
              </div>
              <span
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: l.is_active
                    ? "color-mix(in srgb, var(--color-success, #22c55e) 12%, transparent)"
                    : "var(--color-bg-surface-soft)",
                  color: l.is_active ? "var(--color-success, #16a34a)" : "var(--color-text-muted)",
                }}
              >
                {l.is_active ? "활성" : "비활성"}
              </span>
            </div>
          ))}
        </div>
      )}
    </DomainLayout>
  );
}
