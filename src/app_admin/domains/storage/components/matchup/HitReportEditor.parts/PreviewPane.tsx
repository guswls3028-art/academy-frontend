// PATH: src/app_admin/domains/storage/components/matchup/HitReportEditor.parts/PreviewPane.tsx
// 중앙 미리보기 — PDF 양식과 동일한 다크 헤더 + 좌/우 2-pane + 코멘트.
//
// 인라인 스타일은 PDF pane 색상/사이즈 토큰을 동적으로 매핑(적중분류색·캡션톤)하기 위해
// 의도적 사용. 부모 HitReportEditor.tsx 와 동일 정책.
/* eslint-disable no-restricted-syntax */

import { ChevronLeft, ChevronRight } from "lucide-react";
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

export function PreviewPane({
  active, activeIndex, examProblemsCount, documentTitle,
  activeCandidateId, candidateMap, comment, onComment, disabled,
  onPrev, onNext,
}: {
  active: HitReportExamProblem | null;
  activeIndex: number;
  examProblemsCount: number;
  documentTitle: string;
  activeCandidateId: number | null;
  candidateMap: Map<number, CandidateMeta>;
  comment: string;
  onComment: (v: string) => void;
  disabled: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (!active) return null;

  const activeCand = activeCandidateId != null ? candidateMap.get(activeCandidateId) : null;
  const sim: number = activeCand && "similarity" in activeCand
    ? (activeCand as HitReportCandidate).similarity
    : 0;
  const tier: Tier = activeCand ? classifyMatch(sim) : "miss";
  const labelText = activeCand
    ? (tier === "miss"
        ? `유사도 ${(sim * 100).toFixed(1)}%`
        : `${TIER_LABEL[tier]}  ·  ${(sim * 100).toFixed(1)}%`)
    : "후보 없음";
  const tierColor = TIER_COLOR[tier];
  const tierBg = TIER_BG[tier];

  const candDocTitle = activeCand
    ? ("document_title" in activeCand && activeCand.document_title)
      ? activeCand.document_title
      : ("document_id" in activeCand ? `자료 ${activeCand.document_id}번` : "")
    : "";

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
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4,
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
        />
        {/* 우 — active 후보 (적중 분류 색 cap) — 강사 본인 수업자료 */}
        <PreviewSubPane
          captionLabel="내 수업 자료"
          captionSub={activeCand
            ? `${candDocTitle}  ·  Q${activeCand.number}`
            : "우측 후보 목록에서 선택하세요"}
          captionColor={activeCand ? tierColor : "#94A3B8"}
          captionBg={activeCand ? tierBg : "#F1F5F9"}
          imageUrl={activeCand?.image_url || null}
          placeholderText={activeCand ? "이미지가 없습니다" : "후보를 클릭하면 미리보기"}
        />
      </div>

      {/* 코멘트 — PDF 코멘트 band와 동일 위치/역할 */}
      <div style={{
        padding: 10, borderTop: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)", flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        <label style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 600 }}>
          지도 코멘트 / 해설  <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>· PDF 각 후보 페이지 하단에 노출</span>
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
    </div>
  );
}

function PreviewSubPane({
  captionLabel, captionSub, captionColor, captionBg, imageUrl, placeholderText,
}: {
  captionLabel: string;
  captionSub: string;
  captionColor: string;
  captionBg: string;
  imageUrl: string | null;
  placeholderText: string;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      background: "white", border: "1px solid var(--color-border-divider)",
      borderRadius: 4, overflow: "hidden", minHeight: 0,
    }}>
      <div style={{
        padding: "6px 10px", background: captionBg,
        display: "flex", flexDirection: "column", gap: 1, flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: captionColor, letterSpacing: 0.3 }}>
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
        flex: 1, minHeight: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 6, overflow: "auto",
      }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={captionLabel}
            style={{
              maxWidth: "100%", maxHeight: "100%",
              objectFit: "contain", background: "white",
            }}
          />
        ) : (
          <span style={{ color: "#94A3B8", fontSize: 12 }}>{placeholderText}</span>
        )}
      </div>
    </div>
  );
}
