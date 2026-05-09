// PATH: src/app_admin/domains/storage/components/matchup/PageStateGrid.tsx
//
// Phase B (2026-05-09) — page-level state (auto/skip/manual) UI 그리드.
//
// basic_definition_2026_05_09 SSOT MVP 1단계: 학원장이 페이지별로 자동/제외/수동
// 결정 → 자동분리 결과 + manual cut = 최종 problem set.
//
// UI 핵심:
//   1) 썸네일 그리드 (페이지 미리보기 + 현재 state)
//   2) 페이지별 auto/skip/manual radio chip
//   3) 다중 선택 + 일괄 작업 (선택→일괄 skip / auto)
//   4) "이 페이지부터 끝까지 skip" CTA
//   5) 자동 추천 banner (paper_type_summary 기반 cover/explanation/answer_key)
//      → 학원장 1-tap apply 또는 reject
//
// backward compat:
//   meta.excluded_pages 가 worker SSOT 그대로. PageState 변경 시 자동 동기화 (backend).
//   기존 LowConfPageReviewer 는 그대로 유지 — 본 그리드가 1차 진입, 그 안에서 detail
//   검수 모달 호출 (onRequestDetail).

import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wand2, X, Layers, ArrowRight, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { ICON, Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import {
  fetchDocumentPages,
  getMatchupPageStates,
  bulkSetMatchupPageStates,
  reanalyzeMatchupDocument,
  type MatchupDocument,
  type PageStateEntry,
  type PageStateValue,
  type PageStateRecommendation,
} from "../../api/matchup.api";

const STATE_LABEL: Record<PageStateValue, string> = {
  auto: "자동",
  skip: "건너뛰기",
  manual: "직접",
};

const STATE_DESCRIPTION: Record<PageStateValue, string> = {
  auto: "자동분리 실행. 결과를 검수 후 사용.",
  skip: "이 페이지는 매치업에 사용하지 않음 (표지/해설/답안지 등).",
  manual: "자동분리 X. 직접 자른 문항만 사용.",
};

const STATE_COLOR: Record<PageStateValue, string> = {
  auto: "var(--color-primary)",
  skip: "var(--color-text-muted)",
  manual: "var(--color-warning)",
};

const AUTO_REASON_LABEL: Record<string, string> = {
  paper_type_cover: "표지 자동 감지",
  paper_type_explanation: "해설 자동 감지",
  paper_type_answer_key: "정답지 자동 감지",
  paper_type_index: "목차 자동 감지",
  paper_type_non_question: "비문항 자동 감지",
  no_problem_detected: "문항 없음",
  legacy_excluded_pages: "이전에 제외함",
};

function autoReasonLabel(key: string): string {
  return AUTO_REASON_LABEL[key] || key;
}

type Props = {
  document: MatchupDocument;
  onRequestDetail?: (pageIndex: number) => void;  // LowConfPageReviewer 등 detail 모달 호출
  onClose?: () => void;
};

export default function PageStateGrid({ document: doc, onRequestDetail, onClose }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showRecommendations, setShowRecommendations] = useState(true);

  const pagesQuery = useQuery({
    queryKey: ["matchup-doc-pages", doc.id],
    queryFn: () => fetchDocumentPages(doc.id),
    staleTime: 5 * 60 * 1000,
  });

  const statesQuery = useQuery({
    queryKey: ["matchup-page-states", doc.id],
    queryFn: () => getMatchupPageStates(doc.id),
  });

  const allPages = pagesQuery.data?.pages ?? [];
  const states = statesQuery.data?.states ?? [];
  const recommendations = statesQuery.data?.recommendations ?? [];

  // page_index → PageStateEntry 매핑
  const stateByIndex = useMemo(() => {
    const m = new Map<number, PageStateEntry>();
    for (const s of states) m.set(s.page_index, s);
    return m;
  }, [states]);

  // 잔존 결함 3 fix (2026-05-09): recommendations 의 reason 을 카드 헤더 badge 로 노출.
  // PageStateEntry 의 auto_reason 은 DB 저장된 PageState 만 가짐. 미적용 추천은 별도 매핑.
  const recommendationByIndex = useMemo(() => {
    const m = new Map<number, PageStateRecommendation>();
    for (const r of recommendations) m.set(r.page_index, r);
    return m;
  }, [recommendations]);

  // 잔존 결함 1 fix: auto_reason 분포 기반 정확한 banner copy.
  // no_problem_detected 휴리스틱과 paper_type_* (실제 표지/해설 감지) 구분.
  const recommendationCopy = useMemo(() => {
    if (recommendations.length === 0) return null;
    let noProblem = 0;
    let paperType = 0;
    for (const r of recommendations) {
      if (r.auto_reason === "no_problem_detected") noProblem += 1;
      else if (r.auto_reason.startsWith("paper_type_")) paperType += 1;
    }
    const total = recommendations.length;
    if (paperType > 0 && noProblem === 0) {
      return `${total}개 페이지가 표지·해설·정답지로 감지되었습니다.`;
    }
    if (noProblem > 0 && paperType === 0) {
      return `${total}개 페이지에서 문항이 검출되지 않았습니다.`;
    }
    return `${total}개 페이지가 매치업 인덱싱에서 제외 가능한 것으로 감지되었습니다 (표지·해설 ${paperType}건 / 문항 없음 ${noProblem}건).`;
  }, [recommendations]);

  // 통계
  const statsByState = useMemo(() => {
    const counts: Record<PageStateValue, number> = { auto: 0, skip: 0, manual: 0 };
    for (const s of states) counts[s.state] += 1;
    return counts;
  }, [states]);

  const bulkMutation = useMutation({
    mutationFn: (items: Array<{ page_index: number; state: PageStateValue }>) =>
      bulkSetMatchupPageStates(doc.id, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matchup-page-states", doc.id] });
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
    },
  });

  const reanalyzeMutation = useMutation({
    mutationFn: () => reanalyzeMatchupDocument(doc.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      qc.invalidateQueries({ queryKey: ["matchup-problems", doc.id] });
    },
  });

  // ESC 닫기
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const togglePage = useCallback((pageIndex: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageIndex)) next.delete(pageIndex); else next.add(pageIndex);
      return next;
    });
  }, []);

  const setSinglePageState = useCallback(async (pageIndex: number, state: PageStateValue) => {
    try {
      await bulkMutation.mutateAsync([{ page_index: pageIndex, state }]);
      feedback.success(`p${pageIndex + 1} → ${STATE_LABEL[state]}`);
    } catch {
      feedback.error("저장 실패");
    }
  }, [bulkMutation]);

  const applyBulk = useCallback(async (state: PageStateValue) => {
    if (selected.size === 0) {
      feedback.error("선택된 페이지가 없습니다.");
      return;
    }
    const items = Array.from(selected).map((page_index) => ({ page_index, state }));
    try {
      await bulkMutation.mutateAsync(items);
      feedback.success(`${selected.size}페이지 → ${STATE_LABEL[state]}`);
      setSelected(new Set());
    } catch {
      feedback.error("일괄 저장 실패");
    }
  }, [selected, bulkMutation]);

  const skipFromHere = useCallback(async (fromIndex: number) => {
    const total = allPages.length;
    if (total === 0) return;
    const ok = await confirm({
      title: `p${fromIndex + 1} 부터 끝까지 건너뛰기`,
      message: `${total - fromIndex}개 페이지를 매치업 인덱싱에서 제외합니다. 계속하시겠어요?`,
      confirmText: "건너뛰기",
      danger: false,
    });
    if (!ok) return;
    const items = Array.from({ length: total - fromIndex }, (_, i) => ({
      page_index: fromIndex + i,
      state: "skip" as const,
    }));
    try {
      await bulkMutation.mutateAsync(items);
      feedback.success(`${items.length}페이지 건너뛰기 적용`);
    } catch {
      feedback.error("일괄 저장 실패");
    }
  }, [allPages.length, bulkMutation, confirm]);

  const applyAllRecommendations = useCallback(async () => {
    if (recommendations.length === 0) return;
    const items = recommendations.map((r: PageStateRecommendation) => ({
      page_index: r.page_index,
      state: r.state,
    }));
    try {
      await bulkMutation.mutateAsync(items);
      feedback.success(`자동 추천 ${items.length}건 적용`);
    } catch {
      feedback.error("저장 실패");
    }
  }, [recommendations, bulkMutation]);

  const triggerReanalyze = useCallback(async () => {
    const ok = await confirm({
      title: "이 자료 재분석",
      message: "현재 페이지 설정을 반영해 자동분리를 다시 실행합니다. 학원장이 직접 자른 문항(manual cut)은 보존됩니다. 계속하시겠어요?",
      confirmText: "재분석",
      danger: false,
    });
    if (!ok) return;
    try {
      await reanalyzeMutation.mutateAsync();
      feedback.success("재분석을 시작했습니다. 결과는 잠시 후 반영됩니다.");
    } catch {
      feedback.error("재분석 실패");
    }
  }, [confirm, reanalyzeMutation]);

  const isLoading = pagesQuery.isLoading || statesQuery.isLoading;

  return (
    <div data-testid="matchup-page-state-grid" style={/* eslint-disable-line no-restricted-syntax */ {
      display: "flex", flexDirection: "column", gap: "var(--space-3)",
      padding: "var(--space-3)",
    }}>
      {/* 헤더 — 통계 + 일괄 액션 */}
      <div style={/* eslint-disable-line no-restricted-syntax */ {
        display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap",
        padding: "var(--space-2) var(--space-3)",
        background: "var(--color-bg-surface-soft)",
        borderRadius: "var(--radius-md)",
      }}>
        <Layers size={ICON.md} style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-text-secondary)" }} />
        <div style={/* eslint-disable-line no-restricted-syntax */ { fontSize: 13, fontWeight: 700 }}>
          페이지 설정
        </div>
        <div style={/* eslint-disable-line no-restricted-syntax */ { display: "flex", gap: "var(--space-2)", fontSize: 12, color: "var(--color-text-secondary)" }}>
          <span>자동 <strong style={/* eslint-disable-line no-restricted-syntax */ { color: STATE_COLOR.auto }}>{statsByState.auto}</strong></span>
          <span>건너뛰기 <strong style={/* eslint-disable-line no-restricted-syntax */ { color: STATE_COLOR.skip }}>{statsByState.skip}</strong></span>
          <span>직접 <strong style={/* eslint-disable-line no-restricted-syntax */ { color: STATE_COLOR.manual }}>{statsByState.manual}</strong></span>
          {selected.size > 0 && (
            <span>· 선택 <strong style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-primary)" }}>{selected.size}</strong></span>
          )}
        </div>
        <div style={/* eslint-disable-line no-restricted-syntax */ { marginLeft: "auto", display: "flex", gap: "var(--space-2)" }}>
          {selected.size > 0 && (
            <>
              <Button size="sm" intent="ghost" onClick={() => applyBulk("auto")} disabled={bulkMutation.isPending}>
                선택 자동
              </Button>
              <Button size="sm" intent="ghost" onClick={() => applyBulk("skip")} disabled={bulkMutation.isPending}>
                선택 건너뛰기
              </Button>
              <Button size="sm" intent="ghost" onClick={() => applyBulk("manual")} disabled={bulkMutation.isPending}>
                선택 직접
              </Button>
              <Button size="sm" intent="ghost" onClick={() => setSelected(new Set())}>
                선택 해제
              </Button>
            </>
          )}
          <Button size="sm" intent="primary" onClick={triggerReanalyze} disabled={reanalyzeMutation.isPending}>
            {reanalyzeMutation.isPending ? <Loader2 size={ICON.sm} className="animate-spin" /> : <ArrowRight size={ICON.sm} />}
            재분석
          </Button>
          {onClose && (
            <Button size="sm" intent="ghost" onClick={onClose}>
              <X size={ICON.sm} />
            </Button>
          )}
        </div>
      </div>

      {/* 자동 추천 banner — auto_reason 분포 기반 정확한 copy (잔존 결함 1 fix) */}
      {showRecommendations && recommendations.length > 0 && (
        <div style={/* eslint-disable-line no-restricted-syntax */ {
          display: "flex", alignItems: "center", gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-3)",
          background: "color-mix(in srgb, var(--color-info) 8%, var(--color-bg-surface))",
          borderRadius: "var(--radius-md)",
          border: "1px solid color-mix(in srgb, var(--color-info) 30%, transparent)",
        }}>
          <Wand2 size={ICON.sm} style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-info)" }} />
          <div style={/* eslint-disable-line no-restricted-syntax */ { fontSize: 12, color: "var(--color-text-primary)" }}>
            {recommendationCopy} 한 번에 건너뛰기로 설정할까요?
          </div>
          <div style={/* eslint-disable-line no-restricted-syntax */ { marginLeft: "auto", display: "flex", gap: "var(--space-2)" }}>
            <Button size="sm" intent="primary" onClick={applyAllRecommendations} disabled={bulkMutation.isPending}>
              <CheckCircle2 size={ICON.sm} /> 모두 적용
            </Button>
            <Button size="sm" intent="ghost" onClick={() => setShowRecommendations(false)}>
              나중에
            </Button>
          </div>
        </div>
      )}

      {/* 그리드 */}
      {isLoading && allPages.length === 0 ? (
        // skeleton 렌더 (UX P1, 2026-05-09): 무한 spinner 인상 X. 12개 placeholder card.
        <div style={/* eslint-disable-line no-restricted-syntax */ {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "var(--space-2)",
        }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={/* eslint-disable-line no-restricted-syntax */ {
              border: "1px solid var(--color-border-divider)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-2)",
              background: "var(--color-bg-surface-soft)",
              display: "flex", flexDirection: "column", gap: 6,
              opacity: 0.6,
            }}>
              <div style={/* eslint-disable-line no-restricted-syntax */ { width: 30, height: 14, background: "var(--color-bg-surface)", borderRadius: 4 }} />
              <div style={/* eslint-disable-line no-restricted-syntax */ { width: "100%", aspectRatio: "1 / 1.41", background: "var(--color-bg-surface)", borderRadius: 4 }} />
              <div style={/* eslint-disable-line no-restricted-syntax */ { width: "100%", height: 26, background: "var(--color-bg-surface)", borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : allPages.length === 0 ? (
        <div style={/* eslint-disable-line no-restricted-syntax */ { padding: "var(--space-5)", textAlign: "center", color: "var(--color-text-muted)" }}>
          <AlertCircle size={ICON.md} /> 페이지 정보를 불러올 수 없습니다.
        </div>
      ) : (
        <div style={/* eslint-disable-line no-restricted-syntax */ {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "var(--space-2)",
        }}>
          {allPages.map((page) => {
            const idx = page.index;
            const stateEntry = stateByIndex.get(idx);
            const recommendation = recommendationByIndex.get(idx);
            const state: PageStateValue = stateEntry?.state ?? "auto";
            // 잔존 결함 3 fix: 카드 헤더 reason badge — DB 저장 reason 우선,
            // 추천만 있는 경우 recommendation.auto_reason fallback.
            const reason = stateEntry?.auto_reason || recommendation?.auto_reason || "";
            const isSelected = selected.has(idx);
            // 잔존 결함 2 fix: 추천된 페이지 (DB state 미적용) 카드 wrapper 시각 hint.
            const isRecommendedPending = !!recommendation && state === "auto";
            return (
              <div
                key={idx}
                data-testid="matchup-page-card"
                data-page={idx}
                style={/* eslint-disable-line no-restricted-syntax */ {
                  border: isSelected
                    ? `2px solid var(--color-primary)`
                    : isRecommendedPending
                    ? `2px dashed color-mix(in srgb, var(--color-info) 55%, transparent)`
                    : `1px solid var(--color-border-divider)`,
                  borderRadius: "var(--radius-md)",
                  background: isRecommendedPending
                    ? "color-mix(in srgb, var(--color-info) 4%, var(--color-bg-surface))"
                    : "var(--color-bg-surface)",
                  padding: "var(--space-2)",
                  display: "flex", flexDirection: "column", gap: 6,
                  position: "relative",
                  opacity: state === "skip" ? 0.55 : 1,
                }}
              >
                {/* 헤더: 체크박스 + 페이지 번호 + 자동 추천 라벨 + skip-from-here */}
                <div style={/* eslint-disable-line no-restricted-syntax */ { display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => togglePage(idx)}
                    aria-label={`${idx + 1}페이지 선택`}
                    style={/* eslint-disable-line no-restricted-syntax */ { cursor: "pointer", width: 14, height: 14 }}
                  />
                  <span style={/* eslint-disable-line no-restricted-syntax */ {
                    fontWeight: 800, fontSize: 14,
                    color: STATE_COLOR[state],
                  }}>
                    {idx + 1}
                  </span>
                  {reason && (
                    <span style={/* eslint-disable-line no-restricted-syntax */ {
                      fontSize: 10, fontWeight: 700,
                      padding: "1px 6px", borderRadius: 999,
                      background: state === "skip"
                        ? "color-mix(in srgb, var(--color-text-muted) 18%, transparent)"
                        : "color-mix(in srgb, var(--color-info) 12%, transparent)",
                      color: state === "skip"
                        ? "var(--color-text-muted)"
                        : "var(--color-info)",
                    }}>
                      {autoReasonLabel(reason)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => skipFromHere(idx)}
                    title="이 페이지부터 끝까지 매치업에서 제외"
                    style={/* eslint-disable-line no-restricted-syntax */ {
                      marginLeft: "auto",
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 600,
                      padding: "2px 4px", borderRadius: 4,
                    }}
                  >
                    여기부터 끝까지 ⏭
                  </button>
                </div>

                {/* 썸네일 */}
                {page.url && (
                  <button
                    type="button"
                    onClick={() => onRequestDetail?.(idx)}
                    title={onRequestDetail ? "검수 화면 열기" : ""}
                    style={/* eslint-disable-line no-restricted-syntax */ {
                      width: "100%", aspectRatio: "1 / 1.41",
                      background: "var(--color-bg-surface-soft)",
                      backgroundImage: `url(${page.url})`,
                      backgroundSize: "contain",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                      border: "none",
                      cursor: onRequestDetail ? "pointer" : "default",
                      borderRadius: 4,
                    }}
                  />
                )}

                {/* state radio chip — selected 시 진한 fill bg + 흰 텍스트 (UX P1, 2026-05-09) */}
                <div style={/* eslint-disable-line no-restricted-syntax */ { display: "flex", gap: 4 }}>
                  {(["auto", "skip", "manual"] as PageStateValue[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      data-testid={`page-state-chip-${s}`}
                      onClick={() => setSinglePageState(idx, s)}
                      disabled={bulkMutation.isPending}
                      title={STATE_DESCRIPTION[s]}
                      style={/* eslint-disable-line no-restricted-syntax */ {
                        flex: 1,
                        padding: "5px 0",
                        fontSize: 12, fontWeight: 700,
                        border: state === s
                          ? `1px solid ${STATE_COLOR[s]}`
                          : `1px solid var(--color-border-divider)`,
                        borderRadius: 4,
                        background: state === s ? STATE_COLOR[s] : "var(--color-bg-surface)",
                        color: state === s ? "#fff" : "var(--color-text-secondary)",
                        cursor: bulkMutation.isPending ? "not-allowed" : "pointer",
                        boxShadow: state === s
                          ? `0 1px 3px color-mix(in srgb, ${STATE_COLOR[s]} 30%, transparent)`
                          : "none",
                      }}
                    >
                      {STATE_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
