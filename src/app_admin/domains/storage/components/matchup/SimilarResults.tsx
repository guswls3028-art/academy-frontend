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
import styles from "./SimilarResults.module.css";

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

  // 강한+참고만 카운트 (노이즈는 빈 상태 판정에서 제외)
  const visibleCount = grouped.strong.length + grouped.weak.length;
  const visible = useMemo(() => [...grouped.strong, ...grouped.weak], [grouped]);
  const crossDoc = useMemo(
    () => (sourceDocumentId ? visible.filter((r) => r.document_id !== sourceDocumentId) : visible),
    [sourceDocumentId, visible],
  );
  const inDoc = useMemo(
    () => (sourceDocumentId ? visible.filter((r) => r.document_id === sourceDocumentId) : []),
    [sourceDocumentId, visible],
  );
  const pinnedHere = useMemo(
    () => (pinnedIds ? results.reduce((acc, r) => acc + (pinnedIds.has(r.id) ? 1 : 0), 0) : 0),
    [pinnedIds, results],
  );

  if (!problemId) {
    return (
      <div className={styles.pickState}>
        <Sparkles size={22} className={styles.fadedIcon} />
        <strong className={styles.pickTitle}>
          왼쪽에서 문제 카드를 골라보세요
        </strong>
        <span className={styles.pickDescription}>
          비슷한 문제를 등록된 자료에서 자동으로 찾아드립니다.
        </span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Loader2 size={ICON.md} className={`animate-spin ${styles.primaryIcon}`} />
        <span className={styles.loadingText}>유사 문제 검색 중...</span>
      </div>
    );
  }

  if (visibleCount === 0 && grouped.noise.length === 0) {
    const isFirstDoc = totalDocumentCount <= 1;
    return (
      <div className={styles.emptyState}>
        <Sparkles size={ICON.lg} className={styles.emptyIcon} />
        <div className={styles.emptyTitle}>
          유사한 문제를 찾지 못했습니다
        </div>
        {isFirstDoc ? (
          <div className={styles.emptyDescription}>
            문서가 아직 적어서 비교할 대상이 부족합니다.
            시험지를 더 업로드하거나 시험 문제 인덱싱을 실행하면 결과가 나오기 시작합니다.
          </div>
        ) : (
          <div className={styles.emptyDescription}>
            같은 단원·유형의 문제가 쌓일수록 정확해집니다.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* 점수 정의 안내 — "AI 유사 후보 점수"로 framing, 최종 적중은 선생님 확인.
          한 번 작은 글씨로 보여주고, 상세 신호(텍스트/그림/수작업/페이지통째)는 row마다 표시. */}
      <div data-testid="matchup-similar-policy-note" className={styles.policyNote}>
        AI가 추린 <strong>유사 후보 점수</strong>입니다.
        최종 적중 여부는 선생님이 확인해 주세요.
      </div>

      {/* Pin 컨텍스트 — 시험지 doc일 때 이 문항에 담은 후보 수 + 별표 사용법 안내 */}
      {onTogglePin && (
        <div data-testid="matchup-similar-pin-hint" className={styles.pinHint}>
          <Star size={ICON.sm} className={styles.pinHintIcon} />
          <span>
            마음에 드는 후보의 <strong>★ 별</strong>을 누르면 적중 보고서에 담깁니다.
            {pinnedHere ? (
              <> · 이 문항에 <strong>{pinnedHere}개 담음</strong></>
            ) : null}
          </span>
        </div>
      )}

      {/* 강한/참고 매칭이 0개일 때 — "뚜렷한 매칭 없음" 안내와 노이즈 토글이
          시각적으로 인접해야 자연스럽다. 학원장이 "그럼 뭐라도 보여줘" 라고 즉시
          행동할 수 있도록 토글을 안내 박스 *바로 아래*에 배치. */}
      {visibleCount === 0 && grouped.noise.length > 0 ? (
        <div className={styles.noiseBlock}>
          <div data-testid="matchup-similar-only-noise" className={styles.noiseOnly}>
            뚜렷하게 비슷한 문제가 없습니다.<br />
            관련성이 낮은 추천만 있어서 기본은 숨겼습니다.
          </div>
          <NoiseToggle
            count={grouped.noise.length}
            showNoise={showNoise}
            expandedText="숨기기"
            collapsedText="그래도 보기"
            onClick={() => setShowNoise((v) => !v)}
          />
          {showNoise && (
            <NoiseList>
              {grouped.noise.map((r) => (
                <SimilarRow key={r.id} item={r} onClick={() => onSelectSimilar?.(r)}
                  pinned={pinnedIds?.has(r.id) ?? false}
                  pending={pendingPinIds?.has(r.id) ?? false}
                  onTogglePin={onTogglePin ? () => onTogglePin(r.id, r) : undefined} />
              ))}
            </NoiseList>
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
            <div className={styles.noiseFooter}>
              <NoiseToggle
                count={grouped.noise.length}
                showNoise={showNoise}
                expandedText="숨기기"
                collapsedText="더 보기"
                onClick={() => setShowNoise((v) => !v)}
              />
              {showNoise && (
                <NoiseList indented>
                  {grouped.noise.map((r) => (
                    <SimilarRow key={r.id} item={r} onClick={() => onSelectSimilar?.(r)}
                      pinned={pinnedIds?.has(r.id) ?? false}
                      pending={pendingPinIds?.has(r.id) ?? false}
                      onTogglePin={onTogglePin ? () => onTogglePin(r.id, r) : undefined} />
                  ))}
                </NoiseList>
              )}
            </div>
          )}
        </>
      )}

      <p className={styles.footerHint}>
        항목을 클릭하면 원본 이미지와 상세 정보를 볼 수 있습니다
      </p>
    </div>
  );
}

function NoiseToggle({
  count,
  showNoise,
  expandedText,
  collapsedText,
  onClick,
}: {
  count: number;
  showNoise: boolean;
  expandedText: string;
  collapsedText: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid="matchup-similar-noise-toggle"
      onClick={onClick}
      className={styles.noiseToggle}
    >
      {showNoise ? <ChevronUp size={ICON.xs} /> : <ChevronDown size={ICON.xs} />}
      관련성 낮은 추천 {count}개 {showNoise ? expandedText : collapsedText}
    </button>
  );
}

function NoiseList({ children, indented = false }: { children: React.ReactNode; indented?: boolean }) {
  return (
    <div
      data-testid="matchup-similar-noise-list"
      className={`${styles.noiseList} ${indented ? styles.noiseListIndented : ""}`}
    >
      {children}
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
    <div className={styles.section}>
      <div className={`${styles.sectionHeader} ${accent === "primary" ? styles.sectionPrimary : styles.sectionMuted}`}>
        {icon}
        <span>{title}</span>
        <span className={styles.sectionCount}>{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div data-testid="matchup-similar-section-empty" className={styles.sectionEmpty}>
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

  // breakdown 표시 여부 — 백엔드가 필드를 함께 내려줄 때만 표시 (legacy 응답 호환)
  const hasTextSim = typeof item.text_similarity === "number";
  const hasImageSim = typeof item.image_similarity === "number";
  const hasBreakdown =
    hasTextSim || hasImageSim || item.is_manual_cut || item.is_page_fallback;

  return (
    <div
      data-testid="matchup-similar-row"
      data-tier={t}
      data-pinned={pinned ? "true" : "false"}
      onClick={onClick}
      className={styles.row}
    >
      {/* 매치% 큰 뱃지 — % 한눈 파악만 담당. 라벨("직접 적중 후보"/"참고")은 별도 chip으로
          타이틀 행에 노출 → 56px 박스 내 줄바꿈 없이 깔끔. */}
      <div className={styles.scoreBadge}>
        <span className={styles.scoreText}>
          {pct}%
        </span>
      </div>

      {item.image_url && (
        <div className={styles.thumb}>
          <img
            src={item.image_url}
            alt={`Q${item.number}`}
            className={styles.thumbImage}
          />
        </div>
      )}

      <div className={styles.rowContent}>
        <div className={styles.rowTitle}>
          <span className={styles.questionNumber}>
            Q{item.number}
          </span>
          {/* 티어 라벨 — "직접 적중 후보"는 학원장이 가장 먼저 인지해야 하는 신호. */}
          {isStrong && (
            <span data-testid="matchup-similar-tier-label" className={`${styles.tierLabel} ${styles.tierStrong}`}>
              직접 적중 후보
            </span>
          )}
          {isWeak && (
            <span data-testid="matchup-similar-tier-label" className={`${styles.tierLabel} ${styles.tierWeak}`}>
              참고
            </span>
          )}
          {pinned && (
            <span title="이미 적중 보고서에 담긴 자료" className={styles.pinnedLabel}>
              담음
            </span>
          )}
        </div>
        <div title={item.document_title} className={styles.documentTitle}>
          {item.document_title}
        </div>
        {item.text && (
          <p className={styles.textPreview}>
            {normalizeOcrTextPreview(item.text)}
          </p>
        )}
        {/* Breakdown — score(보정 후)와 분리해서 raw 텍스트/그림 유사도 + 보정 신호 표시.
            한 줄, 작고 차분한 muted 톤 → "난잡하지 않게 깔끔한 구조" 정책. */}
        {hasBreakdown && (
          <div data-testid="matchup-similar-breakdown" className={styles.breakdown}>
            {hasTextSim && (
              <span>텍스트 {Math.round((item.text_similarity ?? 0) * 100)}%</span>
            )}
            {hasImageSim && (
              <span>그림 {Math.round((item.image_similarity ?? 0) * 100)}%</span>
            )}
            {item.is_manual_cut && (
              <span className={`${styles.signalChip} ${styles.manualChip}`}>
                수작업 cut
              </span>
            )}
            {item.is_page_fallback && (
              <span
                title="페이지 통째 등록 — 정확한 problem 단위 비교 X. 직접 적중 후보로는 분류하지 않습니다."
                className={`${styles.signalChip} ${styles.pageFallbackChip}`}
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
          type="button"
          data-testid="matchup-similar-pin"
          aria-label={pinned ? "보고서에서 빼기" : "보고서에 담기"}
          title={pending
            ? "저장 중…"
            : pinned ? "보고서에 담겼습니다 (클릭하여 빼기)" : "적중 보고서에 담기"}
          disabled={pending}
          onClick={(e) => { e.stopPropagation(); if (!pending) onTogglePin(); }}
          className={`${styles.pinButton} ${pinned ? styles.pinButtonPinned : ""}`}
        >
          <Star size={ICON.md} />
        </button>
      )}
    </div>
  );
}
