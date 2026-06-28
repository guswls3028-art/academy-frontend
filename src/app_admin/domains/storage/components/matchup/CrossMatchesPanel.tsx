// PATH: src/app_admin/domains/storage/components/matchup/CrossMatchesPanel.tsx
// "이 시험지 → 자료 매치 매트릭스" — 선택된 doc의 모든 문제별 cross-doc 최고 매치를
// 자료(document_title)별로 그룹핑해서 한눈에 보여주는 패널.

import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import { fetchDocumentCrossMatches, type CrossMatchProblem } from "../../api/matchup.api";
import { storageQueryKeys } from "../../queryKeys";
import styles from "./CrossMatchesPanel.module.css";

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

function similarityLevel(similarity: number): "high" | "medium" | "low" {
  if (similarity >= 0.8) return "high";
  if (similarity >= 0.6) return "medium";
  return "low";
}

function PanelMessage({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "danger" }) {
  return (
    <div className={styles.message} data-tone={tone}>
      {children}
    </div>
  );
}

type Props = {
  docId: number | null;
  enabled: boolean; // status === "done" 일 때만
  selectedDocIntent?: "reference" | "test";
  onSelectProblem?: (problemId: number) => void;
};

export default function CrossMatchesPanel({ docId, enabled, selectedDocIntent = "reference", onSelectProblem }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: storageQueryKeys.matchupCrossMatches(docId),
    queryFn: () => fetchDocumentCrossMatches(docId!, 1),
    enabled: enabled && !!docId,
    staleTime: 60_000,
  });

  const groups = useMemo(() => (data ? groupByDoc(data.matches) : []), [data]);

  if (!enabled || !docId) {
    const hint = selectedDocIntent === "reference"
      ? "시험지로 등록된 문서에만 표시됩니다. 좌측 헤더의 시험지/참고자료 토글로 변경할 수 있어요."
      : "분석이 끝나면 자료별 매치 결과가 여기에 표시됩니다.";
    return <PanelMessage>{hint}</PanelMessage>;
  }

  if (isLoading) {
    return <PanelMessage>자료별 매치 결과 불러오는 중…</PanelMessage>;
  }

  if (isError || !data) {
    return (
      <PanelMessage tone="danger">
        결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </PanelMessage>
    );
  }

  if (data.problem_count === 0) {
    return <PanelMessage>이 시험지에는 아직 분석된 문항이 없습니다.</PanelMessage>;
  }

  if (groups.length === 0) {
    return (
      <PanelMessage>
        다른 자료에서 비슷한 문제를 찾지 못했습니다. 참고자료를 더 등록하면 매치율이 올라갑니다.
      </PanelMessage>
    );
  }

  const totalPairs = groups.reduce((s, g) => s + g.pairs.length, 0);

  return (
    <div className={styles.panel}>
      <div className={styles.summary}>
        시험지 <strong>{data.problem_count}</strong>문항 → <strong>{groups.length}</strong>개 자료에서 <strong>{totalPairs}</strong>개 유사 매치
      </div>

      {groups.map((g) => {
        const avgPct = Math.round(
          (g.pairs.reduce((s, p) => s + p.similarity, 0) / g.pairs.length) * 100,
        );
        const topPct = Math.round(
          Math.max(...g.pairs.map((p) => p.similarity)) * 100,
        );
        const sortedPairs = [...g.pairs].sort((a, b) => b.similarity - a.similarity);
        return (
        <div
          key={g.documentId}
          className={styles.docCard}
          data-testid={`cross-match-doc-${g.documentId}`}
        >
          <div className={styles.docHeader}>
            <BookOpen size={ICON.sm} className={styles.docIcon} />
            <span
              className={styles.docTitle}
              title={g.documentTitle}
            >
              {g.documentTitle || `자료 #${g.documentId}`}
            </span>
            <span
              className={styles.docStats}
              title={`최고 ${topPct}% / 평균 ${avgPct}% 유사`}
            >
              <span>{g.pairs.length}건</span>
              <span className={styles.dot}>·</span>
              <span className={styles.topScore} data-level={topPct >= 80 ? "high" : "normal"}>
                최고 {topPct}%
              </span>
            </span>
          </div>
          <div className={styles.pairList}>
            {sortedPairs
              .map((p) => (
                <button
                  key={`${p.sourceProblemId}-${p.targetProblemNumber}`}
                  className={styles.pairButton}
                  type="button"
                  onClick={() => onSelectProblem?.(p.sourceProblemId)}
                  title={p.sourceTextPreview ? `Q${p.sourceProblemNumber}: ${p.sourceTextPreview}` : undefined}
                >
                  <span className={styles.sourceNumber}>
                    Q{p.sourceProblemNumber}
                  </span>
                  <ArrowRight size={ICON.xs} className={styles.arrowIcon} />
                  <span className={styles.targetNumber}>
                    Q{p.targetProblemNumber}
                  </span>
                  <span className={styles.preview}>
                    {p.sourceTextPreview || ""}
                  </span>
                  <span
                    className={styles.scoreBadge}
                    data-level={similarityLevel(p.similarity)}
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
