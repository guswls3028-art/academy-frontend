// PATH: src/app_admin/domains/storage/components/matchup/SimilarResults.tsx
// 유사 문제 추천 결과 패널
//
// 결과 그루핑:
//  1) 유사도(sim) 임계값 그룹 — 노이즈 자동 컷
//     - sim >= 0.85 : 강한 매칭 (그대로 표시)
//     - sim 0.80~0.85 : "참고" 라벨로 회색 톤 표시
//     - sim < 0.80 : 기본 숨김. 토글로 펼침
//  2) 출처 분리 — "다른 시험지에서" 우선, "이 시험지 안에서"는 보조
//
// 직접 텍스트 검증(2026-04-25): sim 0.85+는 18/18 같은 단원 매칭, 0.80 이하부터
// 단원 다른 결과가 섞이기 시작. 이 임계값으로 약한 매칭 노이즈를 자동 컷.

import { useState, useEffect, useMemo } from "react";
import { Loader2, Sparkles, FileText, Layers, ChevronDown, ChevronUp, Star } from "lucide-react";
import { feedback } from "@/shared/ui/feedback/feedback";
import { findSimilarProblems } from "../../api/matchup.api";
import type { SimilarProblem } from "../../api/matchup.api";

type Props = {
  problemId: number | null;
  onSelectSimilar?: (problem: SimilarProblem) => void;
  totalDocumentCount?: number;
  /** 현재 선택 중인 문서 id — in-doc / cross-doc 분리에 사용 */
  sourceDocumentId?: number | null;
  /** 적중 보고서 찜 — 시험지(test) doc일 때만 활성. 후보별 별표 토글 */
  pinnedIds?: Set<number>;
  onTogglePin?: (problemId: number, candidate: SimilarProblem) => void;
};

const SIM_STRONG = 0.85;  // 이상: 강한 매칭
const SIM_WEAK = 0.80;    // 미만: 노이즈 — 기본 숨김

type Tier = "strong" | "weak" | "noise";
function tierOf(sim: number): Tier {
  if (sim >= SIM_STRONG) return "strong";
  if (sim >= SIM_WEAK) return "weak";
  return "noise";
}

export default function SimilarResults({
  problemId, onSelectSimilar, totalDocumentCount = 0, sourceDocumentId = null,
  pinnedIds, onTogglePin,
}: Props) {
  const [results, setResults] = useState<SimilarProblem[]>([]);
  const [loading, setLoading] = useState(false);
  // 노이즈(<0.80)는 기본 숨김.
  // 특히 문서가 적은 테넌트에서 저품질 추천이 먼저 보여 "추천이 이상해 보이는" 체감을 줄인다.
  const [showNoise, setShowNoise] = useState(false);

  useEffect(() => {
    if (!problemId) {
      setResults([]);
      setShowNoise(false);
      return;
    }

    setLoading(true);
    setShowNoise(false);
    // top_k 20 — 더 많이 한눈에. 강(≥85%) / 참고(80~85%) / 관련성 낮음(<80%)
    // 모두 sim % 라벨과 함께 노출. 사용자가 직접 비교/선택.
    findSimilarProblems(problemId, 20)
      .then((r) => setResults(r.results))
      .catch(() => {
        feedback.error("유사 문제를 찾는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [problemId]);

  // tier 그루핑은 results 변경 시 1회만
  const grouped = useMemo(() => {
    const g: Record<Tier, SimilarProblem[]> = { strong: [], weak: [], noise: [] };
    for (const r of results) g[tierOf(r.similarity)].push(r);
    return g;
  }, [results]);

  if (!problemId) {
    return (
      <div style={{
        padding: "var(--space-6)", textAlign: "center",
        color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.6,
        display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)",
      }}>
        <Sparkles size={22} style={{ opacity: 0.4 }} />
        <strong style={{ color: "var(--color-text-secondary)", fontWeight: 700 }}>
          왼쪽에서 문제 카드를 골라보세요
        </strong>
        <span style={{ maxWidth: 240 }}>
          비슷한 문제를 등록된 자료에서 자동으로 찾아드립니다.
        </span>
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

  // 강한+참고만 카운트 (노이즈는 빈 상태 판정에서 제외)
  const visibleCount = grouped.strong.length + grouped.weak.length;

  if (visibleCount === 0 && grouped.noise.length === 0) {
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

  // 강한+참고만 출처 분리 (노이즈는 분리 없이 한 줄로)
  const visible = [...grouped.strong, ...grouped.weak];
  const crossDoc = sourceDocumentId
    ? visible.filter((r) => r.document_id !== sourceDocumentId)
    : visible;
  const inDoc = sourceDocumentId
    ? visible.filter((r) => r.document_id === sourceDocumentId)
    : [];

  // 강한 vs 참고 시각 분기는 SimilarRow 내부에서 자체 처리
  const pinnedHere = pinnedIds && results.filter((r) => pinnedIds.has(r.id)).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {/* Pin 컨텍스트 — 시험지 doc일 때 이 문항에 담은 후보 수 + 별표 사용법 안내 */}
      {onTogglePin && (
        <div
          data-testid="matchup-similar-pin-hint"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px var(--space-3)",
            background: "color-mix(in srgb, var(--color-warning) 6%, var(--color-bg-surface))",
            border: "1px dashed color-mix(in srgb, var(--color-warning) 35%, transparent)",
            borderRadius: "var(--radius-sm)",
            fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.5,
          }}
        >
          <Star size={14} fill="var(--color-warning)" stroke="var(--color-warning)" style={{ flexShrink: 0 }} />
          <span>
            마음에 드는 후보의 <strong style={{ color: "var(--color-warning)" }}>★ 별</strong>을 누르면 적중 보고서에 담깁니다.
            {pinnedHere ? (
              <> · 이 문항에 <strong style={{ color: "var(--color-warning)" }}>{pinnedHere}개 담음</strong></>
            ) : null}
          </span>
        </div>
      )}

      {visibleCount === 0 && grouped.noise.length > 0 && (
        <div data-testid="matchup-similar-only-noise" style={{
          padding: "var(--space-4)", textAlign: "center",
          background: "var(--color-bg-surface-soft)",
          border: "1px dashed var(--color-border-divider)",
          borderRadius: "var(--radius-md)",
          fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5,
        }}>
          뚜렷하게 비슷한 문제가 없습니다.<br />
          관련성이 낮은 추천만 있어서 기본은 숨겼습니다.
        </div>
      )}

      <Section
        title="다른 시험지에서"
        icon={<FileText size={12} />}
        items={crossDoc}
        emptyText="다른 시험지에서 비슷한 문제를 찾지 못했습니다"
        onSelect={onSelectSimilar}
        accent="primary"
        pinnedIds={pinnedIds}
        onTogglePin={onTogglePin}
      />

      {sourceDocumentId !== null && totalDocumentCount > 1 && inDoc.length > 0 && (
        <Section
          title="이 시험지 안에서"
          icon={<Layers size={12} />}
          items={inDoc}
          emptyText=""
          onSelect={onSelectSimilar}
          accent="muted"
          pinnedIds={pinnedIds}
          onTogglePin={onTogglePin}
        />
      )}

      {/* 노이즈(<0.80) 펼침 토글 */}
      {grouped.noise.length > 0 && (
        <div style={{ marginTop: "var(--space-1)" }}>
          <button
            data-testid="matchup-similar-noise-toggle"
            onClick={() => setShowNoise((v) => !v)}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              background: "transparent", border: "1px dashed var(--color-border-divider)",
              borderRadius: "var(--radius-sm)",
              padding: "6px 10px",
              fontSize: 11, color: "var(--color-text-muted)", cursor: "pointer",
            }}
          >
            {showNoise ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            관련성 낮은 추천 {grouped.noise.length}개 {showNoise ? "숨기기" : "더 보기"}
          </button>
          {showNoise && (
            <div data-testid="matchup-similar-noise-list" style={{
              display: "flex", flexDirection: "column", gap: "var(--space-2)",
              marginTop: "var(--space-2)",
              opacity: 0.7,
            }}>
              {grouped.noise.map((r) => (
                <SimilarRow key={r.id} item={r} onClick={() => onSelectSimilar?.(r)}
                  pinned={pinnedIds?.has(r.id) ?? false}
                  onTogglePin={onTogglePin ? () => onTogglePin(r.id, r) : undefined} />
              ))}
            </div>
          )}
        </div>
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
  pinnedIds?: Set<number>;
  onTogglePin?: (problemId: number, candidate: SimilarProblem) => void;
};

function Section({ title, icon, items, emptyText, onSelect, accent, pinnedIds, onTogglePin }: SectionProps) {
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
        items.map((r) => (
          <SimilarRow key={r.id} item={r}
            onClick={() => onSelect?.(r)}
            pinned={pinnedIds?.has(r.id) ?? false}
            onTogglePin={onTogglePin ? () => onTogglePin(r.id, r) : undefined}
          />
        ))
      )}
    </div>
  );
}

/* ── Row ── */

function SimilarRow({ item, onClick, pinned, onTogglePin }: {
  item: SimilarProblem; onClick: () => void;
  pinned?: boolean; onTogglePin?: () => void;
}) {
  const pct = Math.round(item.similarity * 100);
  const t = tierOf(item.similarity);
  const isStrong = t === "strong";
  const isWeak = t === "weak";

  // 색상/배경: strong=success, weak=muted, noise=더 muted
  const badgeBg = isStrong
    ? "color-mix(in srgb, var(--color-success) 10%, var(--color-bg-surface))"
    : isWeak
      ? "color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-surface))"
      : "var(--color-bg-surface-soft)";
  const badgeColor = isStrong
    ? "var(--color-success)"
    : isWeak
      ? "var(--color-warning)"
      : "var(--color-text-muted)";

  return (
    <div
      data-testid="matchup-similar-row"
      data-tier={t}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "stretch", gap: "var(--space-3)",
        padding: "var(--space-3)",
        borderRadius: "var(--radius-md)",
        border: pinned
          ? "1px solid var(--color-warning)"
          : "1px solid var(--color-border-divider)",
        background: pinned
          ? "color-mix(in srgb, var(--color-warning) 5%, var(--color-bg-surface))"
          : "var(--color-bg-surface)",
        cursor: "pointer",
        transition: "box-shadow 0.15s, border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
        e.currentTarget.style.borderColor = "color-mix(in srgb, var(--color-brand-primary) 30%, var(--color-border-divider))";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = pinned ? "var(--color-warning)" : "var(--color-border-divider)";
      }}
    >
      {/* 매치% 큰 뱃지 — 한눈에 파악 */}
      <div style={{
        flexShrink: 0, width: 56, minHeight: 56,
        borderRadius: "var(--radius-md)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: badgeBg,
        border: `1px solid ${isStrong ? "color-mix(in srgb, var(--color-success) 35%, transparent)" : "var(--color-border-divider)"}`,
      }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: badgeColor, lineHeight: 1 }}>
          {pct}%
        </span>
        {isStrong && (
          <span style={{ fontSize: 9, fontWeight: 700, color: badgeColor, marginTop: 3, opacity: 0.85 }}>
            강한 매칭
          </span>
        )}
        {isWeak && (
          <span style={{ fontSize: 9, fontWeight: 700, color: badgeColor, marginTop: 3, opacity: 0.85 }}>
            참고
          </span>
        )}
      </div>

      {item.image_url && (
        <div style={{
          width: 64, height: 64, flexShrink: 0,
          borderRadius: "var(--radius-sm)", overflow: "hidden",
          background: "var(--color-bg-surface-soft)",
          border: "1px solid var(--color-border-divider)",
        }}>
          <img
            src={item.image_url}
            alt={`Q${item.number}`}
            style={{ width: "100%", height: "100%", objectFit: "contain", background: "white" }}
          />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>
            Q{item.number}
          </span>
          {pinned && (
            <span
              title="이미 적중 보고서에 담긴 자료"
              style={{
                fontSize: 10, padding: "1px 6px", borderRadius: 999,
                background: "var(--color-warning)", color: "white", fontWeight: 700,
              }}
            >
              담음
            </span>
          )}
        </div>
        <div
          title={item.document_title}
          style={{
            fontSize: 11, color: "var(--color-text-muted)", fontWeight: 600,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {item.document_title}
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

      {/* 찜 별표 — 시험지(test) doc 컨텍스트일 때만 onTogglePin이 있으니 노출됨.
          행 클릭(상세 모달)과 분리하기 위해 stopPropagation. */}
      {onTogglePin && (
        <button
          data-testid="matchup-similar-pin"
          aria-label={pinned ? "보고서에서 빼기" : "보고서에 담기"}
          title={pinned ? "보고서에 담겼습니다 (클릭하여 빼기)" : "적중 보고서에 담기"}
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          style={{
            flexShrink: 0, alignSelf: "center",
            width: 36, height: 36,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: pinned
              ? "var(--color-warning)"
              : "transparent",
            border: `1px solid ${pinned ? "var(--color-warning)" : "var(--color-border-divider)"}`,
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            color: pinned ? "white" : "var(--color-text-muted)",
            transition: "background 0.12s, color 0.12s",
          }}
        >
          <Star size={16} fill={pinned ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}
