// PATH: src/app_admin/domains/storage/components/matchup/SimilarResults.tsx
// 유사 문제 추천 결과 패널
//
// 결과를 두 섹션으로 분리:
//  - "다른 시험지에서" (cross-doc) — 추천 의도와 일치하는 결과를 우선 노출
//  - "이 시험지 안에서" (in-doc)  — 같은 시험지 내 비슷한 유형 (보조)
//
// 분리 기준은 source problem의 document_id (= 현재 선택한 문서 id).
// top_k 충분히 받아서(예: 12) 두 섹션에 적절히 분배.

import { useState, useEffect } from "react";
import { Loader2, Sparkles, FileText, Layers } from "lucide-react";
import { feedback } from "@/shared/ui/feedback/feedback";
import { findSimilarProblems } from "../../api/matchup.api";
import type { SimilarProblem } from "../../api/matchup.api";

type Props = {
  problemId: number | null;
  onSelectSimilar?: (problem: SimilarProblem) => void;
  totalDocumentCount?: number;
  /** 현재 선택 중인 문서 id — in-doc / cross-doc 분리에 사용 */
  sourceDocumentId?: number | null;
};

export default function SimilarResults({
  problemId, onSelectSimilar, totalDocumentCount = 0, sourceDocumentId = null,
}: Props) {
  const [results, setResults] = useState<SimilarProblem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!problemId) {
      setResults([]);
      return;
    }

    setLoading(true);
    // top_k 12 — cross-doc/in-doc 두 섹션에 충분히 보여주기 위해
    findSimilarProblems(problemId, 12)
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

  // 두 섹션 분배 (cross-doc 우선)
  const crossDoc = sourceDocumentId
    ? results.filter((r) => r.document_id !== sourceDocumentId)
    : results;
  const inDoc = sourceDocumentId
    ? results.filter((r) => r.document_id === sourceDocumentId)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {/* 다른 시험지 (우선) */}
      <Section
        title="다른 시험지에서"
        icon={<FileText size={12} />}
        items={crossDoc}
        emptyText="다른 시험지에서 비슷한 문제를 찾지 못했습니다"
        onSelect={onSelectSimilar}
        accent="primary"
      />

      {/* 이 시험지 안 (보조 — sourceDocumentId 있을 때만) */}
      {sourceDocumentId !== null && inDoc.length > 0 && (
        <Section
          title="이 시험지 안에서"
          icon={<Layers size={12} />}
          items={inDoc}
          emptyText=""
          onSelect={onSelectSimilar}
          accent="muted"
        />
      )}

      <p style={{
        fontSize: 11, color: "var(--color-text-muted)", textAlign: "center",
        margin: "var(--space-1) 0 0", opacity: 0.7,
      }}>
        항목을 클릭하면 원본 이미지와 상세 정보를 볼 수 있습니다
      </p>
    </div>
  );
}

/* ── Section ── */

type SectionProps = {
  title: string;
  icon: React.ReactNode;
  items: SimilarProblem[];
  emptyText: string;
  onSelect?: (p: SimilarProblem) => void;
  accent: "primary" | "muted";
};

function Section({ title, icon, items, emptyText, onSelect, accent }: SectionProps) {
  if (items.length === 0 && !emptyText) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 11, fontWeight: 700,
        color: accent === "primary" ? "var(--color-brand-primary)" : "var(--color-text-muted)",
        textTransform: "uppercase", letterSpacing: "0.04em",
        padding: "0 2px",
      }}>
        {icon}
        <span>{title}</span>
        <span style={{
          fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)",
          background: "var(--color-bg-surface-soft)",
          padding: "1px 6px", borderRadius: 4, textTransform: "none",
        }}>{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div data-testid="matchup-similar-section-empty" style={{
          fontSize: 11, color: "var(--color-text-muted)",
          padding: "var(--space-3)", textAlign: "center",
          background: "var(--color-bg-surface-soft)",
          borderRadius: "var(--radius-sm)",
        }}>
          {emptyText}
        </div>
      ) : (
        items.map((r) => <SimilarRow key={r.id} item={r} onClick={() => onSelect?.(r)} />)
      )}
    </div>
  );
}

/* ── Row ── */

function SimilarRow({ item, onClick }: { item: SimilarProblem; onClick: () => void }) {
  const pct = Math.round(item.similarity * 100);
  return (
    <div
      data-testid="matchup-similar-row"
      onClick={onClick}
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

      {item.image_url && (
        <div style={{
          width: 48, height: 48, flexShrink: 0,
          borderRadius: "var(--radius-sm)", overflow: "hidden",
          background: "var(--color-bg-surface-soft)",
        }}>
          <img
            src={item.image_url}
            alt={`Q${item.number}`}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)" }}>
            Q{item.number}
          </span>
          <span style={{
            fontSize: 10, padding: "1px 6px", borderRadius: 4,
            background: "var(--color-bg-surface-soft)", color: "var(--color-text-muted)",
          }}>
            {item.document_title}
          </span>
        </div>
        {item.text && (
          <p style={{
            fontSize: 12, color: "var(--color-text-secondary)",
            margin: "2px 0 0", lineHeight: 1.4,
            overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {item.text}
          </p>
        )}
      </div>
    </div>
  );
}
