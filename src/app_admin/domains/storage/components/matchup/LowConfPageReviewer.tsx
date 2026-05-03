// PATH: src/app_admin/domains/storage/components/matchup/LowConfPageReviewer.tsx
//
// Phase 5-deep — 저신뢰 페이지 검수 모달.
//
// 매치업 자동분리 결과 신뢰도가 낮은 페이지(<55%)를 학원장이 한곳에서 빠르게
// 처리하기 위한 워크플로우. 좌측 사이드바에 검수 페이지 리스트, 우측에 페이지
// 이미지 + 기존 problems의 bbox overlay. 1-tap CTA로 즉시 처리.
//
// CTA 4종:
//   1) "이 페이지 제외" → 매치업 인덱싱에서 영구 제외 (problems 즉시 삭제)
//   2) "직접 자르기"   → ManualCropModal 호출 (해당 페이지로 점프)
//   3) "재분석 트리거" → status 무관 doc 전체 재처리 (excluded_pages 적용 후)
//   4) (Phase 후속) "VLM 정밀 분석" — 별도 task에서 추가
//
// UX 핵심:
//   - 사이드바 페이지 클릭 시 메인 캔버스에 page image + 기존 bbox overlay
//   - 페이지 메타 (신뢰도/이유/paper_type/n_boxes) 한눈에
//   - 액션 후 즉시 reload (excluded_pages 갱신/problems 삭제 반영)
//   - ESC = 닫기

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X, AlertCircle, Loader2, Crop, Ban, RefreshCw, Eye, Sparkles,
} from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import {
  fetchDocumentPages,
  fetchMatchupProblems,
  excludeMatchupPage,
  reanalyzeMatchupDocument,
  vlmClassifyMatchupPage,
} from "../../api/matchup.api";
import type { MatchupDocument, LowConfPage, VlmClassifyResult } from "../../api/matchup.api";

const PAPER_TYPE_LABEL: Record<string, string> = {
  clean_pdf_single: "PDF (1단)",
  clean_pdf_dual: "PDF (2단)",
  quadrant: "4분할 시험지",
  scan_single: "스캔본 (1단)",
  scan_dual: "스캔본 (2단)",
  student_answer_photo: "학생 답안지 폰사진",
  side_notes: "학습자료 본문",
  non_question: "표지/정답지/해설지",
  unknown: "분류 불명",
};

const REASON_LABEL: Record<string, string> = {
  paper_type_unknown: "유형 분류 실패",
  paper_type_low_confidence: "유형 신뢰도 낮음",
  no_boxes_detected: "문항 박스 검출 실패",
  too_few_boxes: "박스 수 부족",
  too_many_boxes: "박스 과다",
  ocr_anchor_missing: "문항 번호 anchor 없음",
  layout_mismatch: "레이아웃 불일치",
  small_bboxes: "박스 크기 비정상",
};

function reasonLabel(key: string): string {
  return REASON_LABEL[key] ?? key;
}

function paperTypeLabel(key: string): string {
  return PAPER_TYPE_LABEL[key] ?? key;
}

type Props = {
  document: MatchupDocument;
  lowConfPages: LowConfPage[];
  onClose: () => void;
  onRequestManualCrop: (pageIndex: number) => void;  // ManualCropModal로 인계 (해당 페이지)
};

export default function LowConfPageReviewer({
  document: doc,
  lowConfPages,
  onClose,
  onRequestManualCrop,
}: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [activeIdx, setActiveIdx] = useState<number>(
    lowConfPages.length > 0 ? lowConfPages[0].idx : 0,
  );
  const [excluding, setExcluding] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  // 학원장이 모달 안에서 제외 액션을 쌓아둘 수 있게 — 즉시 reanalyze 안 하고
  // 여러 페이지 처리 후 1번만 재분석. excluded_pages는 backend가 누적 관리.
  const [excludedThisSession, setExcludedThisSession] = useState<Set<number>>(new Set());
  // VLM 정밀 분석 — 페이지 idx별 결과 캐시 (한 번 호출 후 재호출 안 함, 비용 절약)
  const [vlmByPage, setVlmByPage] = useState<Record<number, VlmClassifyResult>>({});
  const [vlmLoadingIdx, setVlmLoadingIdx] = useState<number | null>(null);

  const pagesQuery = useQuery({
    queryKey: ["matchup-doc-pages", doc.id],
    queryFn: () => fetchDocumentPages(doc.id),
    staleTime: 5 * 60 * 1000,
  });
  const problemsQuery = useQuery({
    queryKey: ["matchup-problems", doc.id],
    queryFn: () => fetchMatchupProblems(doc.id),
  });

  const allPages = pagesQuery.data?.pages ?? [];
  const activePageData = allPages.find((p) => p.index === activeIdx) ?? allPages[0];
  const activeMeta = lowConfPages.find((p) => p.idx === activeIdx);
  // problemsQuery.data를 직접 dep으로 — `?? []` logical expression은
  // 매 렌더마다 새 배열 참조라 react-hooks/exhaustive-deps 경고를 깨뜨림.
  const problemsOnPage = useMemo(() => {
    const list = problemsQuery.data ?? [];
    return list.filter(
      (p) => (p.meta as Record<string, unknown> | null)?.page_index === activeIdx,
    );
  }, [problemsQuery.data, activeIdx]);

  // ESC 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !excluding && !reanalyzing) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [excluding, reanalyzing, onClose]);

  const handleExclude = useCallback(async () => {
    if (excluding) return;
    if (typeof activeIdx !== "number") return;
    const ok = await confirm({
      title: `${activeIdx + 1}페이지 매치업 제외`,
      message:
        `${activeIdx + 1}페이지를 매치업 인덱싱에서 제외합니다. ` +
        `이 페이지의 문항 ${problemsOnPage.length}건은 즉시 삭제되며, ` +
        `다음 재분석 시에도 다시 생성되지 않습니다. 계속하시겠어요?`,
      confirmText: "제외하기",
      danger: true,
    });
    if (!ok) return;
    setExcluding(true);
    try {
      const res = await excludeMatchupPage(doc.id, activeIdx);
      feedback.success(
        `${activeIdx + 1}페이지 제외됨 (문항 ${res.removed_problems}건 삭제)`,
      );
      setExcludedThisSession((prev) => {
        const next = new Set(prev);
        next.add(activeIdx);
        return next;
      });
      // 즉시 problems / documents 캐시 무효화
      qc.invalidateQueries({ queryKey: ["matchup-problems", doc.id] });
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      // 다음 검수 페이지로 자동 이동 — 처리 흐름 끊김 방지
      const nextPage = lowConfPages.find(
        (p) => p.idx !== activeIdx && !excludedThisSession.has(p.idx),
      );
      if (nextPage) setActiveIdx(nextPage.idx);
    } catch (e) {
      console.error(e);
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "페이지 제외 실패";
      feedback.error(msg);
    } finally {
      setExcluding(false);
    }
  }, [excluding, activeIdx, problemsOnPage.length, confirm, doc.id, qc, lowConfPages, excludedThisSession]);

  const handleReanalyze = useCallback(async () => {
    if (reanalyzing) return;
    const sessionExcludedCount = excludedThisSession.size;
    const ok = await confirm({
      title: "이 자료 재분석",
      message:
        sessionExcludedCount > 0
          ? `이번 세션에서 제외한 ${sessionExcludedCount}페이지를 반영해 자동분리를 다시 실행합니다. ` +
            `기존 문항이 모두 삭제되고 새로 생성됩니다. 계속하시겠어요?`
          : `이 자료의 자동분리를 다시 실행합니다. 기존 문항이 모두 삭제되고 새로 생성됩니다. 계속하시겠어요?`,
      confirmText: "재분석",
      danger: false,
    });
    if (!ok) return;
    setReanalyzing(true);
    try {
      await reanalyzeMatchupDocument(doc.id);
      feedback.success("재분석을 시작했습니다. 잠시 후 결과가 반영됩니다.");
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      qc.invalidateQueries({ queryKey: ["matchup-problems", doc.id] });
      onClose();
    } catch (e) {
      console.error(e);
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "재분석 실패";
      feedback.error(msg);
    } finally {
      setReanalyzing(false);
    }
  }, [reanalyzing, excludedThisSession, confirm, doc.id, qc, onClose]);

  const handleManualCrop = useCallback(() => {
    onRequestManualCrop(activeIdx);
  }, [onRequestManualCrop, activeIdx]);

  const handleVlmClassify = useCallback(async () => {
    if (vlmLoadingIdx !== null) return;
    setVlmLoadingIdx(activeIdx);
    try {
      const res = await vlmClassifyMatchupPage(doc.id, activeIdx);
      setVlmByPage((prev) => ({ ...prev, [activeIdx]: res }));
      const roleLabel = {
        cover: "표지", index: "목차", problem: "문항",
        explanation: "해설", answer_key: "정답지", mixed: "혼재",
      }[res.page_role];
      feedback.success(
        `VLM 분석 완료 — ${roleLabel} (신뢰도 ${Math.round(res.confidence * 100)}%, ` +
        `검출 ${res.problems.length}건)`,
      );
    } catch (e) {
      console.error(e);
      const status = (e as { response?: { status?: number } })?.response?.status;
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "VLM 분석 실패";
      if (status === 429) {
        feedback.error(`호출 한도 초과: ${msg}`);
      } else {
        feedback.error(msg);
      }
    } finally {
      setVlmLoadingIdx(null);
    }
  }, [vlmLoadingIdx, activeIdx, doc.id]);

  const activeVlm = vlmByPage[activeIdx];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="저신뢰 페이지 검수"
      style={/* eslint-disable-line no-restricted-syntax */ {
        position: "fixed", inset: 0, zIndex: 1100,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
      }}
      onClick={excluding || reanalyzing ? undefined : onClose}
    >
      <div
        data-testid="matchup-low-conf-reviewer"
        style={/* eslint-disable-line no-restricted-syntax */ {
          background: "var(--color-bg-surface)", borderRadius: "var(--radius-xl)",
          width: "min(1280px, 96vw)", height: "min(840px, 92vh)",
          display: "flex", flexDirection: "column",
          boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={/* eslint-disable-line no-restricted-syntax */ {
          padding: "var(--space-3) var(--space-5)",
          borderBottom: "1px solid var(--color-border-divider)",
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)",
        }}>
          <div style={/* eslint-disable-line no-restricted-syntax */ { display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
            <Eye size={16} style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-warning)", flexShrink: 0 }} />
            <h3 style={/* eslint-disable-line no-restricted-syntax */ {
              margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              저신뢰 페이지 검수 — {doc.title}
            </h3>
          </div>
          <div style={/* eslint-disable-line no-restricted-syntax */ { display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={/* eslint-disable-line no-restricted-syntax */ { fontSize: 12, color: "var(--color-text-muted)" }}>
              검수 대상 {lowConfPages.length}건
              {excludedThisSession.size > 0 && (
                <> · 이번 세션 제외 <strong style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-warning)" }}>{excludedThisSession.size}</strong>건</>
              )}
            </span>
            <button
              onClick={onClose}
              disabled={excluding || reanalyzing}
              style={/* eslint-disable-line no-restricted-syntax */ {
                background: "none", border: "none",
                cursor: excluding || reanalyzing ? "not-allowed" : "pointer",
                color: "var(--color-text-secondary)",
                opacity: excluding || reanalyzing ? 0.5 : 1,
              }}
              title="닫기 (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body: [페이지 사이드바] [캔버스 + 액션] */}
        <div style={/* eslint-disable-line no-restricted-syntax */ { flex: 1, display: "flex", minHeight: 0 }}>
          {/* 좌: 검수 페이지 리스트 */}
          <div style={/* eslint-disable-line no-restricted-syntax */ {
            width: 280, flexShrink: 0,
            borderRight: "1px solid var(--color-border-divider)",
            overflowY: "auto", padding: "var(--space-2)",
            background: "var(--color-bg-surface-soft)",
          }}>
            {lowConfPages.map((p) => {
              const isActive = p.idx === activeIdx;
              const isExcluded = excludedThisSession.has(p.idx);
              return (
                <button
                  key={p.idx}
                  type="button"
                  onClick={() => setActiveIdx(p.idx)}
                  data-testid="matchup-low-conf-page-row"
                  data-page={p.idx}
                  style={/* eslint-disable-line no-restricted-syntax */ {
                    width: "100%", textAlign: "left",
                    marginBottom: 6,
                    border: isActive
                      ? "2px solid var(--color-warning)"
                      : "1px solid var(--color-border-divider)",
                    borderRadius: 6,
                    background: isExcluded
                      ? "color-mix(in srgb, var(--color-text-muted) 8%, var(--color-bg-surface))"
                      : "var(--color-bg-surface)",
                    cursor: "pointer",
                    padding: "8px 10px",
                    display: "flex", flexDirection: "column", gap: 4,
                    opacity: isExcluded ? 0.55 : 1,
                  }}
                >
                  <div style={/* eslint-disable-line no-restricted-syntax */ {
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <span style={/* eslint-disable-line no-restricted-syntax */ {
                      fontWeight: 800, fontSize: 13,
                      color: isActive ? "var(--color-warning)" : "var(--color-text-primary)",
                    }}>
                      p{p.idx + 1}
                    </span>
                    <span style={/* eslint-disable-line no-restricted-syntax */ {
                      fontSize: 11, fontWeight: 700,
                      padding: "1px 6px", borderRadius: 999,
                      background: "color-mix(in srgb, var(--color-warning) 12%, transparent)",
                      color: "var(--color-warning)",
                    }}>
                      {Math.round(p.confidence * 100)}%
                    </span>
                    {isExcluded && (
                      <span style={/* eslint-disable-line no-restricted-syntax */ {
                        marginLeft: "auto",
                        fontSize: 10, fontWeight: 700,
                        padding: "1px 6px", borderRadius: 999,
                        background: "color-mix(in srgb, var(--color-text-muted) 18%, transparent)",
                        color: "var(--color-text-muted)",
                      }}>
                        제외됨
                      </span>
                    )}
                  </div>
                  <div style={/* eslint-disable-line no-restricted-syntax */ {
                    fontSize: 11, color: "var(--color-text-muted)",
                  }}>
                    {paperTypeLabel(p.paper_type)} · 박스 {p.n_boxes}개
                  </div>
                  {p.reasons.length > 0 && (
                    <div style={/* eslint-disable-line no-restricted-syntax */ {
                      fontSize: 11, color: "var(--color-text-secondary)",
                      lineHeight: 1.4,
                    }}>
                      {p.reasons.map((r) => reasonLabel(r)).join(", ")}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* 중앙+우측: 페이지 캔버스 + 액션 패널 */}
          <div style={/* eslint-disable-line no-restricted-syntax */ {
            flex: 1, minWidth: 0,
            display: "flex", flexDirection: "column",
            background: "var(--color-bg-surface-soft)",
          }}>
            {/* 메타 + 액션 바 */}
            <div style={/* eslint-disable-line no-restricted-syntax */ {
              padding: "var(--space-2) var(--space-3)",
              borderBottom: "1px solid var(--color-border-divider)",
              flexShrink: 0,
              background: "var(--color-bg-surface)",
              display: "flex", alignItems: "center", gap: "var(--space-2)",
              flexWrap: "wrap",
            }}>
              {activeMeta && (
                <>
                  <span style={/* eslint-disable-line no-restricted-syntax */ {
                    fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)",
                  }}>
                    {activeIdx + 1}페이지 · 신뢰도 {Math.round(activeMeta.confidence * 100)}%
                  </span>
                  <span style={/* eslint-disable-line no-restricted-syntax */ {
                    fontSize: 11, color: "var(--color-text-muted)",
                  }}>
                    · {paperTypeLabel(activeMeta.paper_type)} · 자동 검출 박스 {activeMeta.n_boxes}개 · 등록된 문항 {problemsOnPage.length}개
                  </span>
                </>
              )}
              <div style={/* eslint-disable-line no-restricted-syntax */ {
                marginLeft: "auto",
                display: "flex", alignItems: "center", gap: "var(--space-2)",
              }}>
                <Button
                  size="sm"
                  intent="ghost"
                  onClick={handleVlmClassify}
                  disabled={excluding || reanalyzing || vlmLoadingIdx !== null || Boolean(activeVlm)}
                  data-testid="matchup-low-conf-vlm-btn"
                  title="Gemini AI로 이 페이지를 정밀 분석합니다. 페이지당 1회만 호출되며, 학원별 일일 한도가 적용됩니다."
                >
                  {vlmLoadingIdx === activeIdx ? (
                    <Loader2 size={13} className="animate-spin" style={/* eslint-disable-line no-restricted-syntax */ { marginRight: 4 }} />
                  ) : (
                    <Sparkles size={13} style={/* eslint-disable-line no-restricted-syntax */ { marginRight: 4 }} />
                  )}
                  {activeVlm ? "AI 분석 완료" : "AI 정밀 분석"}
                </Button>
                <Button
                  size="sm"
                  intent="ghost"
                  onClick={handleManualCrop}
                  disabled={excluding || reanalyzing}
                  data-testid="matchup-low-conf-manual-crop-btn"
                >
                  <Crop size={13} style={/* eslint-disable-line no-restricted-syntax */ { marginRight: 4 }} />
                  직접 자르기
                </Button>
                <Button
                  size="sm"
                  intent="ghost"
                  onClick={handleExclude}
                  disabled={excluding || reanalyzing || excludedThisSession.has(activeIdx)}
                  data-testid="matchup-low-conf-exclude-btn"
                >
                  {excluding ? (
                    <Loader2 size={13} className="animate-spin" style={/* eslint-disable-line no-restricted-syntax */ { marginRight: 4 }} />
                  ) : (
                    <Ban size={13} style={/* eslint-disable-line no-restricted-syntax */ { marginRight: 4 }} />
                  )}
                  {excludedThisSession.has(activeIdx) ? "제외됨" : "이 페이지 제외"}
                </Button>
                <Button
                  size="sm"
                  intent="primary"
                  onClick={handleReanalyze}
                  disabled={excluding || reanalyzing}
                  data-testid="matchup-low-conf-reanalyze-btn"
                >
                  {reanalyzing ? (
                    <Loader2 size={13} className="animate-spin" style={/* eslint-disable-line no-restricted-syntax */ { marginRight: 4 }} />
                  ) : (
                    <RefreshCw size={13} style={/* eslint-disable-line no-restricted-syntax */ { marginRight: 4 }} />
                  )}
                  재분석
                </Button>
              </div>
            </div>

            {/* 페이지 이미지 + bbox overlay */}
            <div style={/* eslint-disable-line no-restricted-syntax */ {
              flex: 1, minHeight: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "var(--space-3)",
              overflow: "auto",
            }}>
              {pagesQuery.isLoading ? (
                <div style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-text-muted)", fontSize: 13 }}>
                  <Loader2 size={18} className="animate-spin" style={/* eslint-disable-line no-restricted-syntax */ { marginRight: 6 }} />
                  페이지 준비 중…
                </div>
              ) : pagesQuery.isError ? (
                <div style={/* eslint-disable-line no-restricted-syntax */ {
                  color: "var(--color-danger)", fontSize: 13,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <AlertCircle size={16} /> 페이지 로드 실패
                </div>
              ) : !activePageData ? (
                <div style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-text-muted)", fontSize: 13 }}>
                  페이지가 없습니다.
                </div>
              ) : (
                <div
                  data-testid="matchup-low-conf-page-canvas"
                  style={/* eslint-disable-line no-restricted-syntax */ {
                    position: "relative",
                    background: "white",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                    borderRadius: 4,
                    userSelect: "none",
                    maxWidth: "100%",
                    maxHeight: "100%",
                    aspectRatio: `${activePageData.width || 1} / ${activePageData.height || 1.4}`,
                    width: "auto",
                    height: "100%",
                  }}
                >
                  <img
                    src={activePageData.url}
                    alt={`Page ${activeIdx + 1}`}
                    draggable={false}
                    style={/* eslint-disable-line no-restricted-syntax */ {
                      width: "100%", height: "100%", display: "block",
                      objectFit: "contain", pointerEvents: "none",
                    }}
                  />
                  {/* 기존 problem bbox overlay (page_index 매칭 + bbox_norm 있을 때) */}
                  {problemsOnPage.map((p) => {
                    const m = p.meta as Record<string, unknown> | null;
                    const bb = (m?.bbox_norm as number[] | undefined) || null;
                    if (!bb || bb.length !== 4) return null;
                    const [bx, by, bw, bh] = bb;
                    return (
                      <div
                        key={p.id}
                        title={`${p.number}번 (등록됨)`}
                        style={/* eslint-disable-line no-restricted-syntax */ {
                          position: "absolute",
                          left: `${bx * 100}%`, top: `${by * 100}%`,
                          width: `${bw * 100}%`, height: `${bh * 100}%`,
                          border: "2px solid var(--color-success)",
                          background: "color-mix(in srgb, var(--color-success) 12%, transparent)",
                          pointerEvents: "none",
                        }}
                      >
                        <span style={/* eslint-disable-line no-restricted-syntax */ {
                          position: "absolute", top: -2, left: -2,
                          background: "var(--color-success)", color: "white",
                          fontSize: 10, fontWeight: 800, padding: "1px 5px",
                          borderRadius: 3,
                        }}>
                          {p.number}
                        </span>
                      </div>
                    );
                  })}
                  {problemsOnPage.length === 0 && (
                    <div style={/* eslint-disable-line no-restricted-syntax */ {
                      position: "absolute",
                      bottom: 8, right: 8,
                      padding: "4px 10px",
                      background: "color-mix(in srgb, var(--color-text-muted) 80%, transparent)",
                      color: "white",
                      fontSize: 11, fontWeight: 600,
                      borderRadius: 999,
                    }}>
                      이 페이지에 등록된 문항 없음
                    </div>
                  )}
                  {/* VLM 결과 bbox overlay — 보라색 점선 (자동 분리 결과와 시각적 구분) */}
                  {activeVlm && activeVlm.problems.length > 0 && activePageData && (() => {
                    // VLM bbox는 픽셀 좌표. page width/height(원본)로 정규화해 % 변환.
                    // page meta가 비어있으면 width=0이라 0% 출력 → noop.
                    const pw = activePageData.width || 1;
                    const ph = activePageData.height || 1;
                    return activeVlm.problems.map((p, i) => {
                      const [x, y, w, h] = p.bbox;
                      if (!Number.isFinite(x) || !Number.isFinite(y) || !w || !h) return null;
                      const left = (x / pw) * 100;
                      const top = (y / ph) * 100;
                      const width = (w / pw) * 100;
                      const height = (h / ph) * 100;
                      return (
                        <div
                          key={`vlm-${i}`}
                          title={`VLM Q${p.number} (${Math.round(p.confidence * 100)}%)`}
                          style={/* eslint-disable-line no-restricted-syntax */ {
                            position: "absolute",
                            left: `${left}%`, top: `${top}%`,
                            width: `${width}%`, height: `${height}%`,
                            border: "2px dashed #8b5cf6",
                            background: "color-mix(in srgb, #8b5cf6 8%, transparent)",
                            pointerEvents: "none",
                          }}
                        >
                          <span style={/* eslint-disable-line no-restricted-syntax */ {
                            position: "absolute", bottom: -2, right: -2,
                            background: "#8b5cf6", color: "white",
                            fontSize: 10, fontWeight: 800, padding: "1px 5px",
                            borderRadius: 3,
                          }}>
                            VLM {p.number}
                          </span>
                        </div>
                      );
                    });
                  })()}
                  {activeVlm && (
                    <div style={/* eslint-disable-line no-restricted-syntax */ {
                      position: "absolute",
                      top: 8, right: 8,
                      padding: "4px 10px",
                      background: "#8b5cf6",
                      color: "white",
                      fontSize: 11, fontWeight: 700,
                      borderRadius: 999,
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <Sparkles size={11} />
                      VLM: {activeVlm.page_role} ({Math.round(activeVlm.confidence * 100)}%)
                      {activeVlm.problems.length > 0 && ` · 검출 ${activeVlm.problems.length}건`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div style={/* eslint-disable-line no-restricted-syntax */ {
              padding: "var(--space-2) var(--space-3)",
              borderTop: "1px solid var(--color-border-divider)",
              fontSize: 11, color: "var(--color-text-muted)",
              flexShrink: 0,
            }}>
              초록 박스 = 등록된 문항 · <span style={/* eslint-disable-line no-restricted-syntax */ { color: "#8b5cf6", fontWeight: 700 }}>보라 점선</span> = VLM 검출 결과. 자동 검출이 부정확하다면 <strong>제외</strong> 또는 <strong>직접 자르기</strong>로 수정 후 <strong>재분석</strong>하세요.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
