// PATH: src/landing/components/EmbeddedHitReportCards.tsx
// 자유게시판/후기 본문에 임베드되는 적중보고서 카드 표시 (Phase 3 read-side).
//
// meta.matchup_report_ids 있는 게시글 상세에서 본문 아래에 띠로 노출.
// 외부 비로그인 학부모도 카드 메타 + landing/reports/:id 진입 가능.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { HitReportPublicCard } from "../types";
import { fetchPublicHitReportsCached, normalizeHitReportIds } from "../api/hitReports";

interface Props {
  reportIds: number[];
  theme?: "dark" | "light";
}

type EmbeddedHitReportCard = HitReportPublicCard & {
  title?: string;
  author_name?: string;
};

export default function EmbeddedHitReportCards({ reportIds, theme = "dark" }: Props) {
  const [reports, setReports] = useState<EmbeddedHitReportCard[] | null>(null);
  const idsKey = normalizeHitReportIds(reportIds || []).join(",");

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",").map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [];
    if (!ids.length) { setReports([]); return; }
    fetchPublicHitReportsCached(ids)
      .then((list) => setReports(list))
      .catch(() => setReports([]));
  }, [idsKey]);

  if (!reportIds || reportIds.length === 0) return null;

  const dark = theme === "dark";
  const accent = dark ? "#D4A04C" : "#2563EB";
  const border = dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";
  const bg = dark ? "rgba(255,255,255,0.03)" : "#fff";
  const textPrimary = dark ? "#F5F1E8" : "#0F172A";
  const textSecondary = dark ? "#9CA3AF" : "#475569";

  return (
    <div data-testid="embedded-hit-reports" style={{ marginTop: 28, padding: 18, borderRadius: 14, border: `1px solid ${border}`, background: bg }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
        Linked Reports · 관련 적중 사례
      </div>
      {reports === null ? (
        <div style={{ padding: 12, color: textSecondary, fontSize: 13 }}>불러오는 중…</div>
      ) : reports.length === 0 ? (
        <div style={{ padding: 12, color: textSecondary, fontSize: 13 }}>표시할 적중보고서가 없습니다.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {reports.map((r) => (
            <Link key={r.id} to={`/landing/reports/${r.id}`} data-testid={`embedded-hit-report-${r.id}`}
              style={{
                display: "flex", flexDirection: "column", gap: 6,
                padding: 14, borderRadius: 12,
                background: dark ? "rgba(255,255,255,0.02)" : "#fafbfc",
                border: `1px solid ${border}`,
                color: textPrimary, textDecoration: "none",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${accent}66`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = border; }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>적중률 {Math.round(r.hit_rate_pct ?? 0)}%</span>
                <span style={{ fontSize: 11, color: textSecondary }}>{r.hit_count ?? 0}/{r.total_problems ?? 0}</span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {r.title || r.doc_title || `적중보고서 #${r.id}`}
              </div>
              {r.author_name && <div style={{ fontSize: 11, color: textSecondary }}>{r.author_name}</div>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
