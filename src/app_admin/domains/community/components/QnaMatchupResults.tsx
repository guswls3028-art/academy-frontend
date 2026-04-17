// PATH: src/app_admin/domains/community/components/QnaMatchupResults.tsx
// Q&A 상세에서 AI 매치업 결과 표시 — 선생님 전용

import { Sparkles } from "lucide-react";

type MatchupResult = {
  problem_id: number;
  similarity: number;
  text: string;
  number: number;
  source_type: string;
  source_lecture_title: string;
  source_session_title: string;
  source_exam_title: string;
  document_id?: number;
  image_key?: string;
};

type Props = {
  results: MatchupResult[];
};

export default function QnaMatchupResults({ results }: Props) {
  if (!results || results.length === 0) return null;

  return (
    <div style={{
      marginTop: "var(--space-4)",
      padding: "var(--space-4)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid color-mix(in srgb, var(--color-brand-primary) 20%, var(--color-border-divider))",
      background: "color-mix(in srgb, var(--color-brand-primary) 3%, var(--color-bg-surface))",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "var(--space-2)",
        marginBottom: "var(--space-3)",
      }}>
        <Sparkles size={14} style={{ color: "var(--color-brand-primary)" }} />
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: "var(--color-brand-primary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          AI 매치업 결과
        </span>
        <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginLeft: "auto" }}>
          학생 첨부 이미지에서 자동 분석
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {results.map((r, i) => {
          const pct = Math.round(r.similarity * 100);
          const source = [
            r.source_lecture_title,
            r.source_session_title,
            r.source_exam_title,
          ].filter(Boolean).join(" > ");

          return (
            <div
              key={r.problem_id || i}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-3)",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-divider)",
              }}
            >
              {/* 유사도 */}
              <span style={{
                fontSize: 13, fontWeight: 700, flexShrink: 0, width: 40, textAlign: "center",
                color: pct >= 80 ? "var(--color-success)" : "var(--color-text-muted)",
              }}>
                {pct}%
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 출처 */}
                {source ? (
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)",
                    marginBottom: 2,
                  }}>
                    Q{r.number} &middot; {source}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>
                    Q{r.number}
                  </div>
                )}

                {/* 텍스트 미리보기 */}
                {r.text && (
                  <div style={{
                    fontSize: 11, color: "var(--color-text-muted)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {r.text}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
