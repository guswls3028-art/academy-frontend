// PATH: src/app_admin/domains/storage/components/matchup/SimilarResults.tsx
// 유사 문제 추천 결과 패널

import { useState, useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { feedback } from "@/shared/ui/feedback/feedback";
import { findSimilarProblems } from "../../api/matchup.api";
import type { SimilarProblem } from "../../api/matchup.api";

type Props = {
  problemId: number | null;
  onSelectSimilar?: (problem: SimilarProblem) => void;
  totalDocumentCount?: number;
};

export default function SimilarResults({ problemId, onSelectSimilar, totalDocumentCount = 0 }: Props) {
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
      .catch(() => {
        feedback.error("유사 문제 검색에 실패했습니다.");
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [problemId]);

  if (!problemId) {
    return (
      <div style={{
        padding: "var(--space-6)", textAlign: "center",
        color: "var(--color-text-muted)", fontSize: 13,
        display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)",
      }}>
        <Sparkles size={20} style={{ opacity: 0.3 }} />
        <span>좌측에서 문제를 클릭하면</span>
        <span>유사한 문제를 자동으로 찾아줍니다.</span>
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
    // 인덱스가 실질적으로 비어있는 상황(문서 1개)에서는 기능이 고장난 것처럼 느낄 수 있음
    const isFirstDoc = totalDocumentCount <= 1;
    return (
      <div style={{
        padding: "var(--space-5) var(--space-4)", textAlign: "center",
        color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.6,
        display: "flex", flexDirection: "column", gap: "var(--space-2)",
        alignItems: "center",
      }}>
        <Sparkles size={20} style={{ opacity: 0.3 }} />
        <div style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>
          유사한 문제를 찾지 못했습니다
        </div>
        {isFirstDoc ? (
          <div style={{ maxWidth: 260 }}>
            문서가 아직 적어서 비교할 대상이 부족합니다.
            시험지를 더 업로드하거나 시험 문제 인덱싱을 실행하면 결과가 나오기 시작합니다.
          </div>
        ) : (
          <div style={{ maxWidth: 260 }}>
            같은 단원·유형의 문제가 쌓일수록 정확해집니다.
          </div>
        )}
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
            onClick={() => onSelectSimilar?.(r)}
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-3)",
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-divider)",
              background: "var(--color-bg-surface)",
              cursor: "pointer",
              transition: "box-shadow 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
              e.currentTarget.style.borderColor = "color-mix(in srgb, var(--color-brand-primary) 30%, var(--color-border-divider))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "var(--color-border-divider)";
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
      {results.length > 0 && (
        <p style={{
          fontSize: 11, color: "var(--color-text-muted)", textAlign: "center",
          margin: "var(--space-2) 0 0", opacity: 0.7,
        }}>
          항목을 클릭하면 원본 이미지와 상세 정보를 볼 수 있습니다
        </p>
      )}
    </div>
  );
}
