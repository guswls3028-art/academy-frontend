// PATH: src/app_admin/domains/storage/components/matchup/CrossMatchesPanel.tsx
// "이 시험지 → 자료 매치 매트릭스" — 선택된 doc의 모든 문제별 cross-doc 최고 매치를
// 자료(document_title)별로 그룹핑해서 한눈에 보여주는 패널.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import { fetchDocumentCrossMatches, type CrossMatchProblem } from "../../api/matchup.api";

type DocGroup = {
  documentId: number;
  documentTitle: string;
  pairs: Array<{
    sourceProblemNumber: number;
    sourceProblemId: number;
    sourceTextPreview: string;
    targetProblemNumber: number;
    similarity: number;
  }>;
};

function groupByDoc(matches: CrossMatchProblem[]): DocGroup[] {
  const map = new Map<number, DocGroup>();
  for (const m of matches) {
    for (const best of m.best_matches) {
      if (!map.has(best.document_id)) {
        map.set(best.document_id, {
          documentId: best.document_id,
          documentTitle: best.document_title,
          pairs: [],
        });
      }
      map.get(best.document_id)!.pairs.push({
        sourceProblemNumber: m.problem_number,
        sourceProblemId: m.problem_id,
        sourceTextPreview: m.problem_text_preview,
        targetProblemNumber: best.problem_number,
        similarity: best.similarity,
      });
    }
  }
  // 매치 수 많은 자료 순 + 같으면 평균 유사도 높은 순
  return Array.from(map.values()).sort((a, b) => {
    if (a.pairs.length !== b.pairs.length) return b.pairs.length - a.pairs.length;
    const avgA = a.pairs.reduce((s, p) => s + p.similarity, 0) / a.pairs.length;
    const avgB = b.pairs.reduce((s, p) => s + p.similarity, 0) / b.pairs.length;
    return avgB - avgA;
  });
}

type Props = {
  docId: number | null;
  enabled: boolean; // status === "done" 일 때만
  selectedDocIntent?: "reference" | "test";
  onSelectProblem?: (problemId: number) => void;
};

export default function CrossMatchesPanel({ docId, enabled, selectedDocIntent = "reference", onSelectProblem }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["matchup-cross-matches", docId],
    queryFn: () => fetchDocumentCrossMatches(docId!, 1),
    enabled: enabled && !!docId,
    staleTime: 60_000,
  });

  const groups = useMemo(() => (data ? groupByDoc(data.matches) : []), [data]);

  if (!enabled || !docId) {
    const hint = selectedDocIntent === "reference"
      ? "시험지로 등록된 문서에만 표시됩니다. 좌측 헤더의 시험지/참고자료 토글로 변경할 수 있어요."
      : "분석이 끝나면 자료별 매치 결과가 여기에 표시됩니다.";
    return (
      <div style={{ padding: "var(--space-3)", color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.6 }}>
        {hint}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: "var(--space-3)", color: "var(--color-text-muted)", fontSize: 12 }}>
        자료별 매치 결과 불러오는 중…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding: "var(--space-3)", color: "var(--color-danger)", fontSize: 12, lineHeight: 1.6 }}>
        결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </div>
    );
  }

  if (data.problem_count === 0) {
    return (
      <div style={{ padding: "var(--space-3)", color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.6 }}>
        이 시험지에는 아직 분석된 문항이 없습니다.
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div style={{ padding: "var(--space-3)", color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.6 }}>
        다른 자료에서 비슷한 문제를 찾지 못했습니다. 참고자료를 더 등록하면 매치율이 올라갑니다.
      </div>
    );
  }

  const totalPairs = groups.reduce((s, g) => s + g.pairs.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-4)" }}>
      <div style={{
        fontSize: 11, color: "var(--color-text-muted)",
        padding: "6px var(--space-3)",
        background: "var(--color-bg-surface-soft)",
        borderRadius: "var(--radius-sm)",
      }}>
        시험지 <strong>{data.problem_count}</strong>문항 → <strong>{groups.length}</strong>개 자료에서 <strong>{totalPairs}</strong>개 유사 매치
      </div>

      {groups.map((g) => {
        const avgPct = Math.round(
          (g.pairs.reduce((s, p) => s + p.similarity, 0) / g.pairs.length) * 100,
        );
        const topPct = Math.round(
          Math.max(...g.pairs.map((p) => p.similarity)) * 100,
        );
        return (
        <div
          key={g.documentId}
          data-testid={`cross-match-doc-${g.documentId}`}
          style={{
            border: "1px solid var(--color-border-divider)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            background: "var(--color-bg-surface)",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px var(--space-3)",
            background: "color-mix(in srgb, var(--color-brand-primary) 5%, transparent)",
            borderBottom: "1px solid var(--color-border-divider)",
          }}>
            <BookOpen size={ICON.sm} style={{ color: "var(--color-brand-primary)", flexShrink: 0 }} />
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--color-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
              title={g.documentTitle}
            >
              {g.documentTitle || `자료 #${g.documentId}`}
            </span>
            <span
              title={`최고 ${topPct}% / 평균 ${avgPct}% 유사`}
              style={{
                fontSize: 11, fontWeight: 700,
                color: "var(--color-brand-primary)",
                flexShrink: 0,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <span>{g.pairs.length}건</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span style={{ color: topPct >= 80 ? "var(--color-success)" : "var(--color-brand-primary)" }}>
                최고 {topPct}%
              </span>
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {g.pairs
              .sort((a, b) => b.similarity - a.similarity)
              .map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectProblem?.(p.sourceProblemId)}
                  title={p.sourceTextPreview ? `Q${p.sourceProblemNumber}: ${p.sourceTextPreview}` : undefined}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto auto auto 1fr auto",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px var(--space-3)",
                    border: "none",
                    background: idx % 2 === 0 ? "transparent" : "var(--color-bg-surface-soft)",
                    fontSize: 12,
                    cursor: "pointer",
                    textAlign: "left",
                    color: "var(--color-text-primary)",
                  }}
                >
                  <span style={{ fontWeight: 800, color: "var(--color-warning)", minWidth: 32 }}>
                    Q{p.sourceProblemNumber}
                  </span>
                  <ArrowRight size={ICON.xs} style={{ color: "var(--color-text-muted)" }} />
                  <span style={{ fontWeight: 700, color: "var(--color-brand-primary)", minWidth: 32 }}>
                    Q{p.targetProblemNumber}
                  </span>
                  <span
                    style={{
                      color: "var(--color-text-secondary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      fontSize: 11, lineHeight: 1.4,
                    }}
                  >
                    {p.sourceTextPreview || ""}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 999,
                      background: p.similarity >= 0.8
                        ? "color-mix(in srgb, var(--color-success) 12%, transparent)"
                        : p.similarity >= 0.6
                          ? "color-mix(in srgb, var(--color-brand-primary) 10%, transparent)"
                          : "var(--color-bg-surface-soft)",
                      color: p.similarity >= 0.8
                        ? "var(--color-success)"
                        : p.similarity >= 0.6
                          ? "var(--color-brand-primary)"
                          : "var(--color-text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    {(p.similarity * 100).toFixed(0)}%
                  </span>
                </button>
              ))}
          </div>
        </div>
        );
      })}
    </div>
  );
}
