/**
 * PATH: src/app_admin/domains/results/components/omr-review/BBoxOverlay.tsx
 *
 * OMR 스캔 이미지 위에 문항별 버블 영역을 시각적으로 표시하는 SVG overlay.
 *
 * 활성 조건: detail.answers[].omr.bubble_rects 가 존재할 때 (worker v10.1+).
 * fallback: bubble_rects 없으면 아무것도 렌더하지 않음 (운영자에게 기능 없는 듯 보임).
 *
 * 좌표계: worker가 원본 이미지 픽셀 기준으로 제공 → scan_image_size로 normalize 후 SVG 상대좌표.
 *
 * 시각 상태:
 * - 현재 선택(focused) 문항: 굵은 indigo border
 * - flagged(빈칸/중복/저신뢰도) 문항: 주황 border
 * - 정상 문항: 반투명 회색 border (선택적으로 표시)
 */

import { useMemo } from "react";

import type { OmrReviewDetailAnswer } from "./omrReviewApi";

type Props = {
  answers: OmrReviewDetailAnswer[];
  focusedQid: number | null;
  /** 원본 이미지 픽셀 크기 (좌표 normalize 용). 없으면 answers의 좌표로 bbox 추정. */
  imageSize: { width: number; height: number } | null;
  onPickQuestion?: (qid: number) => void;
  /** 정상 문항도 얇게 표시할지 여부 (default: false — flagged/focused만) */
  showAll?: boolean;
};

function answerBBox(a: OmrReviewDetailAnswer): { x: number; y: number; w: number; h: number } | null {
  // 우선 rect 필드 (question 전체 영역)
  const r = a.omr?.rect;
  if (r && Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.w) && Number.isFinite(r.h)) {
    return { x: r.x, y: r.y, w: r.w, h: r.h };
  }
  // bubble_rects에서 min/max 계산
  const bubbles = a.omr?.bubble_rects;
  if (Array.isArray(bubbles) && bubbles.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of bubbles) {
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + (b.w ?? 0));
      maxY = Math.max(maxY, b.y + (b.h ?? 0));
    }
    if (Number.isFinite(minX) && Number.isFinite(maxX)) {
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
  }
  return null;
}

function isFlagged(a: OmrReviewDetailAnswer): boolean {
  const marking = String(a.omr?.marking || "").toLowerCase();
  if (marking === "blank" || marking === "multi") return true;
  const conf = a.omr?.confidence;
  if (typeof conf === "number" && conf < 0.5) return true;
  const st = String(a.omr?.status || "").toLowerCase();
  if (st && st !== "ok") return true;
  return false;
}

export default function BBoxOverlay({
  answers,
  focusedQid,
  imageSize,
  onPickQuestion,
  showAll = false,
}: Props) {
  const boxes = useMemo(() => {
    return answers
      .map((a) => ({ answer: a, rect: answerBBox(a) }))
      .filter((x): x is { answer: OmrReviewDetailAnswer; rect: { x: number; y: number; w: number; h: number } } => x.rect !== null);
  }, [answers]);

  if (boxes.length === 0 || !imageSize) return null;

  return (
    <svg
      className="orw-bbox-overlay"
      viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {boxes.map(({ answer, rect }) => {
        const flagged = isFlagged(answer);
        const focused = focusedQid === answer.question_id;
        if (!focused && !flagged && !showAll) return null;

        const stroke = focused
          ? "#6366f1"
          : flagged
            ? "#f59e0b"
            : "rgba(107, 114, 128, 0.4)";
        const strokeWidth = focused ? 4 : flagged ? 3 : 1.5;
        const fillOpacity = focused ? 0.08 : 0;

        return (
          <g key={answer.question_id} className="orw-bbox-overlay__group">
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.w}
              height={rect.h}
              fill={focused ? stroke : "none"}
              fillOpacity={fillOpacity}
              stroke={stroke}
              strokeWidth={strokeWidth}
              rx={4}
              ry={4}
              style={{ cursor: onPickQuestion ? "pointer" : "default", pointerEvents: "visibleStroke" }}
              onClick={onPickQuestion ? () => onPickQuestion(answer.question_id) : undefined}
            />
            {(focused || flagged) && (
              <text
                x={rect.x + 4}
                y={rect.y + 14}
                fill={stroke}
                fontSize={Math.max(12, Math.min(rect.h * 0.25, 18))}
                fontWeight={700}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {answer.question_no ?? answer.question_id}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
