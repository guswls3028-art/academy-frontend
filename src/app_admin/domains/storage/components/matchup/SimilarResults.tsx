// PATH: src/app_admin/domains/storage/components/matchup/SimilarResults.tsx
// 유사 문제 추천 결과 패널
//
// 점수 정의 (2026-05-06 정책):
//  - 화면에 보이는 % = "AI 유사 후보 점수" — "적중 확률" 아님.
//  - 최종 적중 판정은 선생님이 직접 확인.
//  - 텍스트 유사도, 이미지 유사도, 수작업 cut, 페이지 통째 후보 신호를 row마다 함께 표시.
//
// 결과 그루핑:
//  1) 유사도(sim) 임계값 그룹 — 노이즈 자동 컷
//     - sim >= 0.85 (단, 페이지 통째 X): "직접 적중 후보" 라벨
//     - sim 0.80~0.85 또는 페이지 통째 후보: "참고" 라벨
//     - sim < 0.80 : 기본 숨김. 토글로 펼침
//  2) 출처 분리 — "다른 시험지에서" 우선, "이 시험지 안에서"는 보조
//
// 임계값 (SIM_STRONG=0.85, SIM_WEAK=0.80)은 잠정값.
// TODO: 정답쌍/오답쌍 라벨 데이터를 학원 실자료 기준으로 모아 검증 후 재튜닝.
// 직접 텍스트 검증(2026-04-25): sim 0.85+는 18/18 같은 단원 매칭, 0.80 이하부터
// 단원 다른 결과가 섞이기 시작. 이 임계값으로 약한 매칭 노이즈를 자동 컷 — 추후 재검증.

import { useState, useEffect, useMemo } from "react";
import { Loader2, Sparkles, FileText, Layers, ChevronDown, ChevronUp, Star } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { findSimilarProblems } from "../../api/matchup.api";
import type { SimilarProblem } from "../../api/matchup.api";
import { normalizeOcrTextPreview } from "../../utils/normalizeOcrText";

type Props = {
  problemId: number | null;
  onSelectSimilar?: (problem: SimilarProblem) => void;
  totalDocumentCount?: number;
  /** 현재 선택 중인 문서 id — in-doc / cross-doc 분리에 사용 */
  sourceDocumentId?: number | null;
  /** 적중 보고서 찜 — 시험지(test) doc일 때만 활성. 후보별 별표 토글 */
  pinnedIds?: Set<number>;
  onTogglePin?: (problemId: number, candidate: SimilarProblem) => void;
  /** P2-δ — 진행 중인 별표 토글 candidateId. 진행 중인 별은 disable + 살짝 dim. */
  pendingPinIds?: Set<number>;
};

const SIM_STRONG = 0.85;  // 이상: "직접 적중 후보" (단, 페이지 통째 후보는 제외)
const SIM_WEAK = 0.80;    // 미만: 노이즈 — 기본 숨김

type Tier = "strong" | "weak" | "noise";

/**
 * 후보를 시각 그룹으로 분류한다.
 *
 * 페이지 통째 후보는 sim≥0.85여도 "직접 적중 후보" 승격 X — 자동분리가 anchor 없이
 * 페이지 통째를 problem으로 등록한 케이스라 정확한 problem-단위 비교가 아님.
 * (백엔드도 score를 0.89로 cap하지만 UI에서도 안전망으로 라벨 차단.)
 */
function tierOf(item: SimilarProblem): Tier {
  if (item.is_page_fallback) {
    return item.similarity >= SIM_WEAK ? "weak" : "noise";
  }
  if (item.similarity >= SIM_STRONG) return "strong";
  if (item.similarity >= SIM_WEAK) return "weak";
  return "noise";
}

export default function SimilarResults({
  problemId, onSelectSimilar, totalDocumentCount = 0, sourceDocumentId = null,
  pinnedIds, onTogglePin, pendingPinIds,
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

    let cancelled = false;
    setLoading(true);
    setShowNoise(false);
    // top_k 20 — 더 많이 한눈에. 강(≥85%) / 참고(80~85%) / 관련성 낮음(<80%)
    // 모두 sim % 라벨과 함께 노출. 사용자가 직접 비교/선택.
    // cancelled 가드 — 사용자가 빠르게 다음 문항 클릭하면 이전 응답이 새 결과를
    // 덮어씌우는 race 차단 (잘못된 후보가 표시되는 결함 + 에러 토스트 폭주 방지).
    findSimilarProblems(problemId, 20)
      .then((r) => {
        if (cancelled) return;
        setResults(r.results);
      })
      .catch(() => {
        if (cancelled) return;
        feedback.error("유사 문제를 찾는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
        setResults([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [problemId]);

  // tier 그루핑은 results 변경 시 1회만
  const grouped = useMemo(() => {
    const g: Record<Tier, SimilarProblem[]> = { strong: [], weak: [], noise: [] };
    for (const r of results) g[tierOf(r)].push(r);
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
        <Loader2 size={ICON.md} className="animate-spin" style={{ color: "var(--color-brand-primary)" }} />
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
        <Sparkles size={ICON.lg} style={{ opacity: 0.3 }} />
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
      {/* 점수 정의 안내 — "AI 유사 후보 점수"로 framing, 최종 적중은 선생님 확인.
          한 번 작은 글씨로 보여주고, 상세 신호(텍스트/그림/수작업/페이지통째)는 row마다 표시. */}
      <div
        data-testid="matchup-similar-policy-note"
        style={{
          padding: "8px var(--space-3)",
          background: "var(--color-bg-surface-soft)",
          border: "1px solid var(--color-border-divider)",
          borderRadius: "var(--radius-sm)",
          fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.5,
        }}
      >
        AI가 추린 <strong style={{ color: "var(--color-text-secondary)" }}>유사 후보 점수</strong>입니다.
        최종 적중 여부는 선생님이 확인해 주세요.
      </div>

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
          <Star size={ICON.sm} fill="var(--color-warning)" stroke="var(--color-warning)" style={{ flexShrink: 0 }} />
          <span>
            마음에 드는 후보의 <strong style={{ color: "var(--color-warning)" }}>★ 별</strong>을 누르면 적중 보고서에 담깁니다.
            {pinnedHere ? (
              <> · 이 문항에 <strong style={{ color: "var(--color-warning)" }}>{pinnedHere}개 담음</strong></>
            ) : null}
          </span>
        </div>
      )}

      {/* 강한/참고 매칭이 0개일 때 — "뚜렷한 매칭 없음" 안내와 노이즈 토글이
          시각적으로 인접해야 자연스럽다. 학원장이 "그럼 뭐라도 보여줘" 라고 즉시
          행동할 수 있도록 토글을 안내 박스 *바로 아래*에 배치. */}
      {visibleCount === 0 && grouped.noise.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
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
            {showNoise ? <ChevronUp size={ICON.xs} /> : <ChevronDown size={ICON.xs} />}
            관련성 낮은 추천 {grouped.noise.length}개 {showNoise ? "숨기기" : "그래도 보기"}
          </button>
          {showNoise && (
            <div data-testid="matchup-similar-noise-list" style={{
              display: "flex", flexDirection: "column", gap: "var(--space-2)",
              opacity: 0.7,
            }}>
              {grouped.noise.map((r) => (
                <SimilarRow key={r.id} item={r} onClick={() => onSelectSimilar?.(r)}
                  pinned={pinnedIds?.has(r.id) ?? false}
                  pending={pendingPinIds?.has(r.id) ?? false}
                  onTogglePin={onTogglePin ? () => onTogglePin(r.id, r) : undefined} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <Section
            title="다른 시험지에서"
            icon={<FileText size={ICON.xs} />}
            items={crossDoc}
            emptyText="다른 시험지에서 비슷한 문제를 찾지 못했습니다"
            onSelect={onSelectSimilar}
            accent="primary"
            pinnedIds={pinnedIds}
            pendingPinIds={pendingPinIds}
            onTogglePin={onTogglePin}
          />

          {sourceDocumentId !== null && totalDocumentCount > 1 && inDoc.length > 0 && (
            <Section
              title="이 시험지 안에서"
              icon={<Layers size={ICON.xs} />}
              items={inDoc}
              emptyText=""
              onSelect={onSelectSimilar}
              accent="muted"
              pinnedIds={pinnedIds}
              pendingPinIds={pendingPinIds}
              onTogglePin={onTogglePin}
            />
          )}

          {/* 노이즈(<0.80) 펼침 토글 — 강/참고가 있는 일반 케이스에서는 결과 *아래쪽*에 배치 */}
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
                {showNoise ? <ChevronUp size={ICON.xs} /> : <ChevronDown size={ICON.xs} />}
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
                      pending={pendingPinIds?.has(r.id) ?? false}
                      onTogglePin={onTogglePin ? () => onTogglePin(r.id, r) : undefined} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
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
  pendingPinIds?: Set<number>;
  onTogglePin?: (problemId: number, candidate: SimilarProblem) => void;
};

function Section({ title, icon, items, emptyText, onSelect, accent, pinnedIds, pendingPinIds, onTogglePin }: SectionProps) {
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
            pending={pendingPinIds?.has(r.id) ?? false}
            onTogglePin={onTogglePin ? () => onTogglePin(r.id, r) : undefined}
          />
        ))
      )}
    </div>
  );
}

/* ── Row ── */

function SimilarRow({ item, onClick, pinned, pending, onTogglePin }: {
  item: SimilarProblem; onClick: () => void;
  pinned?: boolean; pending?: boolean; onTogglePin?: () => void;
}) {
  const pct = Math.round(item.similarity * 100);
  const t = tierOf(item);
  const isStrong = t === "strong";
  const isWeak = t === "weak";

  // 색상/배경: strong=success, weak=warning, noise=muted
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

  // breakdown 표시 여부 — 백엔드가 필드를 함께 내려줄 때만 표시 (legacy 응답 호환)
  const hasTextSim = typeof item.text_similarity === "number";
  const hasImageSim = typeof item.image_similarity === "number";
  const hasBreakdown =
    hasTextSim || hasImageSim || item.is_manual_cut || item.is_page_fallback;

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
      {/* 매치% 큰 뱃지 — % 한눈 파악만 담당. 라벨("직접 적중 후보"/"참고")은 별도 chip으로
          타이틀 행에 노출 → 56px 박스 내 줄바꿈 없이 깔끔. */}
      <div style={{
        flexShrink: 0, width: 56, minHeight: 56,
        borderRadius: "var(--radius-md)",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: badgeBg,
        border: `1px solid ${isStrong ? "color-mix(in srgb, var(--color-success) 35%, transparent)" : "var(--color-border-divider)"}`,
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: badgeColor, lineHeight: 1 }}>
          {pct}%
        </span>
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
          {/* 티어 라벨 — "직접 적중 후보"는 학원장이 가장 먼저 인지해야 하는 신호. */}
          {isStrong && (
            <span
              data-testid="matchup-similar-tier-label"
              style={{
                fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
                background: "color-mix(in srgb, var(--color-success) 14%, var(--color-bg-surface))",
                color: "var(--color-success)",
                border: "1px solid color-mix(in srgb, var(--color-success) 35%, transparent)",
                lineHeight: 1.5,
              }}
            >
              직접 적중 후보
            </span>
          )}
          {isWeak && (
            <span
              data-testid="matchup-similar-tier-label"
              style={{
                fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
                background: "color-mix(in srgb, var(--color-warning) 12%, var(--color-bg-surface))",
                color: "var(--color-warning)",
                border: "1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)",
                lineHeight: 1.5,
              }}
            >
              참고
            </span>
          )}
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
            {normalizeOcrTextPreview(item.text)}
          </p>
        )}
        {/* Breakdown — score(보정 후)와 분리해서 raw 텍스트/그림 유사도 + 보정 신호 표시.
            한 줄, 작고 차분한 muted 톤 → "난잡하지 않게 깔끔한 구조" 정책. */}
        {hasBreakdown && (
          <div
            data-testid="matchup-similar-breakdown"
            style={{
              display: "flex", alignItems: "center", flexWrap: "wrap",
              columnGap: 8, rowGap: 3, marginTop: 4,
              fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.5,
            }}
          >
            {hasTextSim && (
              <span>텍스트 {Math.round((item.text_similarity ?? 0) * 100)}%</span>
            )}
            {hasImageSim && (
              <span>그림 {Math.round((item.image_similarity ?? 0) * 100)}%</span>
            )}
            {item.is_manual_cut && (
              <span style={{
                padding: "1px 6px", borderRadius: 999,
                background: "color-mix(in srgb, var(--color-success) 12%, transparent)",
                color: "var(--color-success)", fontWeight: 700, letterSpacing: "0.02em",
              }}>
                수작업 cut
              </span>
            )}
            {item.is_page_fallback && (
              <span
                title="페이지 통째 등록 — 정확한 problem 단위 비교 X. 직접 적중 후보로는 분류하지 않습니다."
                style={{
                  padding: "1px 6px", borderRadius: 999,
                  background: "color-mix(in srgb, var(--color-warning) 12%, transparent)",
                  color: "var(--color-warning)", fontWeight: 700, letterSpacing: "0.02em",
                }}
              >
                페이지 통째
              </span>
            )}
          </div>
        )}
      </div>

      {/* 찜 별표 — 시험지(test) doc 컨텍스트일 때만 onTogglePin이 있으니 노출됨.
          행 클릭(상세 모달)과 분리하기 위해 stopPropagation.
          P2-δ — pending 동안 disable + dim 으로 race 방지. */}
      {onTogglePin && (
        <button
          data-testid="matchup-similar-pin"
          aria-label={pinned ? "보고서에서 빼기" : "보고서에 담기"}
          title={pending
            ? "저장 중…"
            : pinned ? "보고서에 담겼습니다 (클릭하여 빼기)" : "적중 보고서에 담기"}
          disabled={pending}
          onClick={(e) => { e.stopPropagation(); if (!pending) onTogglePin(); }}
          style={{
            flexShrink: 0, alignSelf: "center",
            width: 36, height: 36,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: pinned
              ? "var(--color-warning)"
              : "transparent",
            border: `1px solid ${pinned ? "var(--color-warning)" : "var(--color-border-divider)"}`,
            borderRadius: "var(--radius-sm)",
            cursor: pending ? "wait" : "pointer",
            color: pinned ? "white" : "var(--color-text-muted)",
            opacity: pending ? 0.55 : 1,
            transition: "background 0.12s, color 0.12s, opacity 0.12s",
          }}
        >
          <Star size={ICON.md} fill={pinned ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}
