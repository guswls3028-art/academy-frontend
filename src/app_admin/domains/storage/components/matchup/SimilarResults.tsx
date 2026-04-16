// PATH: src/app_admin/domains/storage/components/matchup/SimilarResults.tsx
// 유사 문제 추천 결과 패널

import { useState, useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { findSimilarProblems } from "../../api/matchup.api";
import type { SimilarProblem } from "../../api/matchup.api";

type Props = {
  problemId: number | null;
};

export default function SimilarResults({ problemId }: Props) {
  const [results, setResults] = useState<SimilarProblem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!problemId) {
      setResults([]);
      return;
    }

    setLoading(true);
    findSimilarProblems(problemId, 10)
      .then((r) => setResults(r.results))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [problemId]);

  if (!problemId) {
    return (
      <div style={{
        padding: "var(--space-6)", textAlign: "center",
        color: "var(--color-text-muted)", fontSize: 13,
      }}>
        문제를 선택하면 유사한 문제를 추천합니다.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "var(--space-6)", gap: "var(--space-2)",
      }}>
        <Loader2 size={16} className="animate-spin" style={{ color: "var(--color-brand-primary)" }} />
        <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>유사 문제 검색 중...</span>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div style={{
        padding: "var(--space-6)", textAlign: "center",
        color: "var(--color-text-muted)", fontSize: 13,
      }}>
        유사한 문제를 찾지 못했습니다.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {results.map((r) => {
        const pct = Math.round(r.similarity * 100);
        return (
          <div
            key={r.id}
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-3)",
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-divider)",
              background: "var(--color-bg-surface)",
              transition: "box-shadow 0.15s",
            }}
          >
            {/* 유사도 뱃지 */}
            <div style={{
              flexShrink: 0, width: 44, height: 44,
              borderRadius: "var(--radius-md)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: pct >= 80
                ? "color-mix(in srgb, var(--color-success) 10%, var(--color-bg-surface))"
                : pct >= 60
                  ? "color-mix(in srgb, var(--color-warning) 10%, var(--color-bg-surface))"
                  : "var(--color-bg-surface-soft)",
              border: "1px solid var(--color-border-divider)",
            }}>
              <span style={{
                fontSize: 14, fontWeight: 700,
                color: pct >= 80 ? "var(--color-success)" : pct >= 60 ? "var(--color-warning)" : "var(--color-text-muted)",
              }}>
                {pct}%
              </span>
            </div>

            {/* 이미지 썸네일 */}
            {r.image_url && (
              <div style={{
                width: 48, height: 48, flexShrink: 0,
                borderRadius: "var(--radius-sm)", overflow: "hidden",
                background: "var(--color-bg-surface-soft)",
              }}>
                <img
                  src={r.image_url}
                  alt={`Q${r.number}`}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
            )}

            {/* 텍스트 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)" }}>
                  Q{r.number}
                </span>
                <span style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 4,
                  background: "var(--color-bg-surface-soft)", color: "var(--color-text-muted)",
                }}>
                  {r.document_title}
                </span>
              </div>
              {r.text && (
                <p style={{
                  fontSize: 12, color: "var(--color-text-secondary)",
                  margin: "2px 0 0", lineHeight: 1.4,
                  overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {r.text}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
