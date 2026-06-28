// PATH: src/app_admin/domains/storage/components/matchup/HitReportEditor.parts/PreviewPane.tsx
// 중앙 미리보기 — PDF 양식과 동일한 다크 헤더 + 좌/우 2-pane + 코멘트.
//
// 인라인 스타일은 PDF pane 색상/사이즈 토큰을 동적으로 매핑(적중분류색·캡션톤)하기 위해
// 의도적 사용. 부모 HitReportEditor.tsx 와 동일 정책.
/* eslint-disable no-restricted-syntax */

import { memo, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import type {
  HitReportCandidate,
  HitReportExamProblem,
} from "../../../api/matchup.api";
import {
  classifyMatch,
  TIER_BG,
  TIER_COLOR,
  TIER_LABEL,
  SOURCE_PANE_BG,
  SOURCE_PANE_COLOR,
  type CandidateMeta,
  type Tier,
} from "./types";

function PreviewPaneInner({
  active, activeIndex, examProblemsCount, documentTitle,
  activeCandidateId, selectedIds, candidateMap, comment, onComment, disabled,
  onPrev, onNext,
}: {
  active: HitReportExamProblem | null;
  activeIndex: number;
  examProblemsCount: number;
  documentTitle: string;
  activeCandidateId: number | null;
  selectedIds: number[];
  candidateMap: Map<number, CandidateMeta>;
  comment: string;
  onComment: (v: string) => void;
  disabled: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [zoomItem, setZoomItem] = useState<PreviewZoomItem | null>(null);
  const [zoomScale, setZoomScale] = useState(1);

  if (!active) return null;

  const openZoom = (item: PreviewZoomItem) => {
    setZoomItem(item);
    setZoomScale(1);
  };
  const closeZoom = () => setZoomItem(null);

  const selectedCandidates = selectedIds
    .map((id) => candidateMap.get(id))
    .filter((c): c is CandidateMeta => Boolean(c));
  const selectedSet = new Set(selectedIds);
  const showSelectedGroup = selectedCandidates.length > 1
    && (activeCandidateId == null || selectedSet.has(activeCandidateId));
  const singleActiveCand = activeCandidateId != null ? candidateMap.get(activeCandidateId) : null;
  const groupBestCand = selectedCandidates.reduce<CandidateMeta | null>((best, cand) => {
    if (!best) return cand;
    const bestSim = "similarity" in best ? best.similarity : 0;
    const candSim = "similarity" in cand ? cand.similarity : 0;
    return candSim > bestSim ? cand : best;
  }, null);
  const activeCand = showSelectedGroup ? groupBestCand : singleActiveCand;
  const sim: number = activeCand && "similarity" in activeCand
    ? (activeCand as HitReportCandidate).similarity
    : 0;
  const tier: Tier = activeCand ? classifyMatch(sim) : "miss";
  const labelText = showSelectedGroup
    ? `선택 자료 ${selectedCandidates.length}건${activeCand && "similarity" in activeCand ? `  ·  최고 ${(sim * 100).toFixed(1)}%` : ""}`
    : activeCand
    ? (tier === "miss"
        ? `유사도 ${(sim * 100).toFixed(1)}%`
        : `${TIER_LABEL[tier]}  ·  ${(sim * 100).toFixed(1)}%`)
    : "후보 없음";
  const tierColor = TIER_COLOR[tier];
  const tierBg = TIER_BG[tier];

  const candDocTitle = activeCand ? candidateDocTitle(activeCand) : "";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      borderRight: "1px solid var(--color-border-divider)",
      overflow: "hidden", minHeight: 0,
    }}>
      {/* 다크 헤더 — PDF 페이지 헤더와 동일 */}
      <div style={{
        background: "#0F172A", color: "white",
        padding: "10px 14px", flexShrink: 0,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={onPrev}
          disabled={activeIndex === 0}
          aria-label="이전 문항"
          style={{
            background: "transparent", border: "none",
            color: activeIndex === 0 ? "rgba(255,255,255,0.3)" : "white",
            cursor: activeIndex === 0 ? "default" : "pointer",
            padding: 4, display: "flex", alignItems: "center",
          }}
        >
          <ChevronLeft size={ICON.lg} />
        </button>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flex: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>Q{active.number}</span>
          <span style={{ fontSize: 11, opacity: 0.7 }}>
            {activeIndex + 1} / {examProblemsCount}
          </span>
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: activeCand ? tierColor : "#94A3B8",
        }}>
          {labelText}
        </span>
        <button
          onClick={onNext}
          disabled={activeIndex >= examProblemsCount - 1}
          aria-label="다음 문항"
          style={{
            background: "transparent", border: "none",
            color: activeIndex >= examProblemsCount - 1 ? "rgba(255,255,255,0.3)" : "white",
            cursor: activeIndex >= examProblemsCount - 1 ? "default" : "pointer",
            padding: 4, display: "flex", alignItems: "center",
          }}
        >
          <ChevronRight size={ICON.lg} />
        </button>
      </div>

      {/* 2-pane 본문 */}
      <div style={{
        flex: 1, minHeight: 0,
        display: "grid",
        gridTemplateColumns: showSelectedGroup
          ? "minmax(0, 0.92fr) minmax(0, 1.38fr)"
          : "minmax(0, 1fr) minmax(0, 1fr)",
        gap: 4,
        padding: 4, background: "#f1f5f9",
      }}>
        {/* 좌 — 시험지 (warning 톤 cap, PDF와 동일) */}
        <PreviewSubPane
          captionLabel="실제 시험"
          captionSub={`${documentTitle || "시험지"}  ·  ${active.number}번`}
          captionColor={SOURCE_PANE_COLOR}
          captionBg={SOURCE_PANE_BG}
          imageUrl={active.image_url || null}
          placeholderText="시험지 이미지가 없습니다"
          onOpenZoom={openZoom}
        />
        {showSelectedGroup ? (
          <PreviewMatchRail candidates={selectedCandidates} onOpenZoom={openZoom} />
        ) : (
          <PreviewSubPane
            captionLabel="내 수업 자료"
            captionSub={activeCand
              ? `${candDocTitle}  ·  Q${activeCand.number}`
              : "우측 후보 목록에서 선택하세요"}
            captionColor={activeCand ? tierColor : "#94A3B8"}
            captionBg={activeCand ? tierBg : "#F1F5F9"}
            imageUrl={activeCand?.image_url || null}
            placeholderText={activeCand ? "이미지가 없습니다" : "후보를 클릭하면 미리보기"}
            onOpenZoom={openZoom}
          />
        )}
      </div>

      {/* 코멘트 — PDF 코멘트 band와 동일 위치/역할 */}
      <div style={{
        padding: 10, borderTop: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)", flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        <label style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 600 }}>
          지도 코멘트 / 해설  <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>· PDF 문항 페이지 하단에 노출</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => onComment(e.target.value)}
          disabled={disabled}
          placeholder="이 문항을 어떻게 다뤘는지, 학생이 알아둘 점은 무엇인지 작성하세요"
          rows={3}
          style={{
            fontSize: 12, padding: 8,
            border: "1px solid var(--color-border-divider)", borderRadius: 4,
            resize: "vertical", outline: "none",
            background: "var(--color-bg-canvas)", color: "var(--color-text-primary)",
            minHeight: 60,
          }}
        />
      </div>
      {zoomItem && (
        <PreviewZoomOverlay
          item={zoomItem}
          scale={zoomScale}
          onClose={closeZoom}
          onZoomIn={() => setZoomScale((v) => Math.min(2.5, Number((v + 0.25).toFixed(2))))}
          onZoomOut={() => setZoomScale((v) => Math.max(0.75, Number((v - 0.25).toFixed(2))))}
          onReset={() => setZoomScale(1)}
        />
      )}
    </div>
  );
}

type PreviewZoomItem = {
  captionLabel: string;
  captionSub: string;
  captionColor: string;
  captionBg: string;
  imageUrl: string;
};

function candidateDocTitle(candidate: CandidateMeta): string {
  return ("document_title" in candidate && candidate.document_title)
    ? candidate.document_title
    : ("document_id" in candidate ? `자료 ${candidate.document_id}번` : "");
}

function PreviewMatchRail({
  candidates, onOpenZoom,
}: {
  candidates: CandidateMeta[];
  onOpenZoom: (item: PreviewZoomItem) => void;
}) {
  const shouldFitRows = candidates.length <= 2;
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      background: "white",
      border: "1px solid var(--color-border-divider)",
      borderRadius: 4,
      overflow: "hidden",
    }}>
      <div style={{
        flexShrink: 0,
        padding: "7px 10px",
        background: "color-mix(in srgb, var(--color-brand-primary) 9%, white)",
        borderBottom: "1px solid color-mix(in srgb, var(--color-brand-primary) 20%, transparent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}>
        <span style={{
          color: "var(--color-brand-primary)",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0,
        }}>
          내 수업 자료 {candidates.length}건
        </span>
        <span style={{
          color: "var(--color-text-muted)",
          fontSize: 10,
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}>
          PDF 2건 단위
        </span>
      </div>
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: 8,
        background: "#f8fafc",
        display: "grid",
        gridTemplateRows: shouldFitRows
          ? `repeat(${candidates.length}, minmax(0, 1fr))`
          : undefined,
        gridAutoRows: shouldFitRows ? undefined : "minmax(320px, auto)",
        gap: 8,
      }}>
        {candidates.map((candidate, index) => {
          const sim = "similarity" in candidate ? candidate.similarity : 0;
          const tier = "similarity" in candidate ? classifyMatch(sim) : "miss";
          const label = `내 수업 자료 ${index + 1}/${candidates.length}`;
          const sub = [
            `${candidateDocTitle(candidate)}  ·  Q${candidate.number}`,
            "similarity" in candidate ? `${(sim * 100).toFixed(1)}%` : "",
          ].filter(Boolean).join("  ·  ");
          return (
            <PreviewSubPane
              key={candidate.id}
              captionLabel={label}
              captionSub={sub}
              captionColor={"similarity" in candidate ? TIER_COLOR[tier] : "#94A3B8"}
              captionBg={"similarity" in candidate ? TIER_BG[tier] : "#F1F5F9"}
              imageUrl={candidate.image_url || null}
              placeholderText="이미지가 없습니다"
              paneStyle={shouldFitRows ? undefined : { minHeight: 320 }}
              onOpenZoom={onOpenZoom}
            />
          );
        })}
      </div>
    </div>
  );
}

function PreviewSubPane({
  captionLabel, captionSub, captionColor, captionBg, imageUrl, placeholderText, paneStyle, onOpenZoom,
}: {
  captionLabel: string;
  captionSub: string;
  captionColor: string;
  captionBg: string;
  imageUrl: string | null;
  placeholderText: string;
  paneStyle?: CSSProperties;
  onOpenZoom?: (item: PreviewZoomItem) => void;
}) {
  const canZoom = Boolean(imageUrl && onOpenZoom);
  const handleOpenZoom = () => {
    if (!imageUrl || !onOpenZoom) return;
    onOpenZoom({ captionLabel, captionSub, captionColor, captionBg, imageUrl });
  };
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      background: "white", border: "1px solid var(--color-border-divider)",
      borderRadius: 4, overflow: "hidden", minHeight: 0,
      ...paneStyle,
    }}>
      <div style={{
        padding: "6px 10px", background: captionBg,
        display: "flex", flexDirection: "column", gap: 1, flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: captionColor, letterSpacing: 0 }}>
          {captionLabel}
        </span>
        <span style={{
          fontSize: 10, color: "#475569",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {captionSub}
        </span>
      </div>
      <div style={{
        position: "relative",
        flex: 1, minHeight: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 6, overflow: "auto",
      }}>
        {imageUrl ? (
          <>
            <button
              type="button"
              onClick={handleOpenZoom}
              aria-label={`${captionLabel} 크게 보기`}
              title="크게 보기"
              style={{
                width: "100%",
                height: "100%",
                minHeight: 0,
                border: 0,
                padding: 0,
                background: "transparent",
                cursor: canZoom ? "zoom-in" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={imageUrl}
                alt={captionLabel}
                style={{
                  maxWidth: "100%", maxHeight: "100%",
                  objectFit: "contain", background: "white",
                }}
              />
            </button>
            <button
              type="button"
              onClick={handleOpenZoom}
              aria-label={`${captionLabel} 크게 보기`}
              title="크게 보기"
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 8px",
                border: "1px solid color-mix(in srgb, var(--color-border-divider) 80%, transparent)",
                borderRadius: 4,
                background: "rgba(255,255,255,0.92)",
                color: "var(--color-text-primary)",
                fontSize: 11,
                fontWeight: 800,
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.14)",
                cursor: "zoom-in",
              }}
            >
              <Maximize2 size={14} />
              크게 보기
            </button>
          </>
        ) : (
          <span style={{ color: "#94A3B8", fontSize: 12 }}>{placeholderText}</span>
        )}
      </div>
    </div>
  );
}

function PreviewZoomOverlay({
  item, scale, onClose, onZoomIn, onZoomOut, onReset,
}: {
  item: PreviewZoomItem;
  scale: number;
  onClose: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.captionLabel} 크게 보기`}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      tabIndex={-1}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(15, 23, 42, 0.78)",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px",
          borderRadius: "8px 8px 0 0",
          background: "var(--color-bg-surface)",
          borderBottom: "1px solid var(--color-border-divider)",
          boxShadow: "0 16px 40px rgba(15, 23, 42, 0.18)",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            color: item.captionColor,
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: 0,
          }}>
            {item.captionLabel}
          </div>
          <div style={{
            color: "var(--color-text-secondary)",
            fontSize: 12,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {item.captionSub}
          </div>
        </div>
        <ZoomButton label="축소" onClick={onZoomOut}>
          <Minus size={16} />
        </ZoomButton>
        <span style={{
          minWidth: 44,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 800,
          color: "var(--color-text-secondary)",
        }}>
          {Math.round(scale * 100)}%
        </span>
        <ZoomButton label="확대" onClick={onZoomIn}>
          <Plus size={16} />
        </ZoomButton>
        <ZoomButton label="원래 크기" onClick={onReset}>
          <RotateCcw size={16} />
        </ZoomButton>
        <ZoomButton label="확대 보기 닫기" onClick={onClose}>
          <X size={18} />
        </ZoomButton>
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          minHeight: 0,
          overflow: "auto",
          background: "color-mix(in srgb, var(--color-bg-canvas) 92%, #0f172a)",
          borderRadius: "0 0 8px 8px",
          boxShadow: "0 16px 40px rgba(15, 23, 42, 0.18)",
          display: "flex",
          alignItems: scale > 1 ? "flex-start" : "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <img
          src={item.imageUrl}
          alt={item.captionLabel}
          style={{
            width: `${scale * 100}%`,
            maxWidth: scale === 1 ? "100%" : "none",
            maxHeight: scale === 1 ? "100%" : "none",
            objectFit: "contain",
            background: "white",
            boxShadow: "0 2px 16px rgba(15, 23, 42, 0.18)",
          }}
        />
      </div>
    </div>
  );
}

function ZoomButton({
  label, onClick, children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        borderRadius: 6,
        border: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)",
        color: "var(--color-text-primary)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// memo wrap — comment / activeCandidateId / active 등 변경 시만 rerender.
// 자료 토글 (entries 변경) → 부모 rerender 만 발생, 본 컴포넌트는 prop 동일하면 skip.
export const PreviewPane = memo(PreviewPaneInner);
