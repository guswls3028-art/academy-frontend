// PATH: src/landing/components/HitReportPicker.tsx
// 자유게시판 글쓰기에서 staff가 자기 학원 적중보고서를 첨부하는 picker (Phase 3).
//
// 본질:
//   - 학원장(owner/admin/teacher/assistant)이 자기 학원에 published된 적중보고서를 글에 cross-attach
//   - 보고서 카드 메타가 글 본문에 임베드되어 외부 학부모도 시각적으로 확인
//   - 학생/학부모는 picker 노출 X — 저작권/사생활 위험
//   - 학원 immutable 정책 위배 X (단순 read + 참조 ID 저장)
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import api, { type ApiRequestConfig } from "@/shared/api/axios";

interface PublishedReport {
  id: number;
  doc_title: string;
  doc_category: string;
  hit_count: number;
  total_problems: number;
  hit_rate_pct: number;
  author_name: string;
  title: string;
  submitted_at: string | null;
  created_at: string | null;
  landing_url: string;
}

interface Props {
  selected: number[];
  onChange: (ids: number[]) => void;
  max?: number;
}

export default function HitReportPicker({ selected, onChange, max = 3 }: Props) {
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState<PublishedReport[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || reports !== null) return;
    api.get("/matchup/hit-reports/board-preview/", { params: { limit: 12 } } as ApiRequestConfig)
      .then((r) => {
        const list = Array.isArray(r?.data?.reports) ? r.data.reports as PublishedReport[] : [];
        setReports(list);
      })
      .catch(() => { setError(true); setReports([]); });
  }, [open, reports]);

  const toggle = (id: number) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      if (selected.length >= max) {
        window.alert(`적중보고서는 최대 ${max}개까지 첨부할 수 있습니다.`);
        return;
      }
      onChange([...selected, id]);
    }
  };

  const border = "rgba(0,0,0,0.1)";
  const accent = "#D4A04C";

  return (
    <div data-testid="hit-report-picker" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>
            적중보고서 첨부 (선택)
          </label>
          <p style={{ margin: 0, fontSize: 11, color: "#6B7280" }}>본인 학원 게시판에 올라간 적중 사례를 글에 임베드합니다 (최대 {max}개)</p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} data-testid="hit-report-picker-toggle"
          style={{ padding: "7px 14px", borderRadius: 999, border: `1px solid ${accent}66`, background: open ? `${accent}22` : "transparent", color: accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em" }}
        >{open ? "닫기" : "선택"}</button>
      </div>

      {/* 선택된 카드 */}
      {selected.length > 0 && (
        <div data-testid="hit-report-picker-selected" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {selected.map((id) => {
            const r = reports?.find((x) => x.id === id);
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 10, background: "#fff7ec", border: `1px solid ${accent}55`, color: "#333" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>#{id}</span>
                <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r?.title || r?.doc_title || `적중보고서 #${id}`}
                </span>
                <button type="button" onClick={() => toggle(id)} aria-label="제거"
                  style={{ background: "transparent", border: "none", color: "#b91c1c", fontSize: 16, cursor: "pointer", lineHeight: 1 }}
                >×</button>
              </div>
            );
          })}
        </div>
      )}

      {/* picker dialog */}
      {open && (
        <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: "#fff", border: `1px solid ${border}` }}>
          {reports === null ? (
            <div style={{ padding: 20, textAlign: "center", color: "#6B7280", fontSize: 13 }}>불러오는 중…</div>
          ) : error ? (
            <div style={{ padding: 20, textAlign: "center", color: "#b91c1c", fontSize: 13 }}>잠시 후 다시 시도해주세요.</div>
          ) : reports.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#6B7280", fontSize: 13 }}>
              학원 홈페이지 hit_reports 섹션에 등록된 적중보고서가 없습니다.<br />
              먼저 어드민에서 보고서를 게시판에 게시해 주세요.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {reports.map((r) => {
                const on = selected.includes(r.id);
                return (
                  <button key={r.id} type="button" onClick={() => toggle(r.id)}
                    data-testid={`hit-report-picker-item-${r.id}`}
                    style={{
                      display: "flex", flexDirection: "column", gap: 6,
                      padding: 12, borderRadius: 10, textAlign: "left", cursor: "pointer",
                      background: on ? `${accent}22` : "#fff",
                      border: `1px solid ${on ? accent : border}`,
                      color: "#333", letterSpacing: "-0.01em",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>적중률 {r.hit_rate_pct}%</span>
                      <span style={{ fontSize: 11, color: "#6B7280" }}>{r.hit_count}/{r.total_problems}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {r.title || r.doc_title || `적중보고서 #${r.id}`}
                    </div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{r.author_name || "—"}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
