/**
 * 인터랙티브 가이드 투어 — 타겟 요소 하이라이트 + 단계별 안내 팝오버
 * antd 의존 없이 CSS-only spotlight + portal popover
 */
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import type { TourStep } from "./types";
import "./GuideTour.css";

type Props = { steps: TourStep[]; onClose: () => void };

const SPOTLIGHT_PADDING = 8;
const POPOVER_WIDTH = 300;
const POPOVER_GAP = 14;
const VIEWPORT_MARGIN = 12;
const POPOVER_SAFE_HEIGHT = 160;

type GuideTourVars = CSSProperties & Record<`--guide-tour-${string}`, string>;

function getPopoverPosition(rect: DOMRect | null, step: TourStep | undefined): GuideTourVars {
  if (!rect || !step) {
    return {
      "--guide-tour-popover-left": "0px",
      "--guide-tour-popover-top": "0px",
      "--guide-tour-popover-width": `${POPOVER_WIDTH}px`,
    };
  }

  const placement = step.placement || "bottom";
  let top = 0;
  let left = 0;

  if (placement === "top") {
    top = rect.top - POPOVER_GAP - 8;
    left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
  } else if (placement === "bottom") {
    top = rect.bottom + POPOVER_GAP;
    left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
  } else if (placement === "left") {
    top = rect.top + rect.height / 2 - 60;
    left = rect.left - POPOVER_GAP - POPOVER_WIDTH;
  } else {
    top = rect.top + rect.height / 2 - 60;
    left = rect.right + POPOVER_GAP;
  }

  left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(left, window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN),
  );
  top = Math.max(
    VIEWPORT_MARGIN,
    Math.min(top, window.innerHeight - POPOVER_SAFE_HEIGHT),
  );

  return {
    "--guide-tour-popover-left": `${left}px`,
    "--guide-tour-popover-top": `${top}px`,
    "--guide-tour-popover-width": `${POPOVER_WIDTH}px`,
  };
}

function getSpotlightPosition(rect: DOMRect): GuideTourVars {
  return {
    "--guide-tour-spotlight-left": `${rect.left - SPOTLIGHT_PADDING}px`,
    "--guide-tour-spotlight-top": `${rect.top - SPOTLIGHT_PADDING}px`,
    "--guide-tour-spotlight-width": `${rect.width + SPOTLIGHT_PADDING * 2}px`,
    "--guide-tour-spotlight-height": `${rect.height + SPOTLIGHT_PADDING * 2}px`,
  };
}

export function GuideTour({ steps, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);

  const step = steps[idx];

  useEffect(() => {
    if (!step) onClose();
  }, [step, onClose]);

  /* ---- 타겟 요소 탐색 & 스크롤 ---- */
  useEffect(() => {
    if (!step) return;
    setReady(false);
    setRect(null);
    let cancelled = false;
    let attempts = 0;

    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          if (!cancelled) {
            setRect(el.getBoundingClientRect());
            setReady(true);
          }
        }, 350);
      } else if (++attempts < 15) {
        setTimeout(find, 200);
      } else {
        // 요소 못 찾음 → 다음 스텝 또는 종료
        if (idx < steps.length - 1) setIdx((i) => i + 1);
        else onClose();
      }
    };
    find();
    return () => { cancelled = true; };
  }, [idx, step, steps.length, onClose]);

  /* ---- 스크롤/리사이즈 추적 ---- */
  useEffect(() => {
    if (!ready || !step) return;
    const update = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [ready, step]);

  /* ---- 키보드 ---- */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const next = useCallback(() => {
    if (idx < steps.length - 1) setIdx((i) => i + 1);
    else onClose();
  }, [idx, steps.length, onClose]);

  const prev = useCallback(() => {
    if (idx > 0) setIdx((i) => i - 1);
  }, [idx]);

  if (!step) return null;

  return createPortal(
    <>
      {/* spotlight hole */}
      {rect && (
        <div
          aria-hidden
          className="guide-tour__spotlight"
          style={getSpotlightPosition(rect)}
        />
      )}

      {/* click-catcher behind popover */}
      <div
        className="guide-tour__click-catcher"
        onClick={onClose}
      />

      {/* popover card */}
      {ready && rect ? (
        <div
          className="guide-tour__popover"
          style={getPopoverPosition(rect, step)}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="guide-tour__card">
            <div className="guide-tour__title">
              {step.title}
            </div>
            <div className="guide-tour__description">
              {step.description}
            </div>
            <div className="guide-tour__footer">
              <span className="guide-tour__progress">
                {idx + 1} / {steps.length}
              </span>
              <div className="guide-tour__actions">
                {idx > 0 && (
                  <button type="button" onClick={prev} className="guide-tour__button">
                    이전
                  </button>
                )}
                <button
                  type="button"
                  onClick={next}
                  className="guide-tour__button guide-tour__button--primary"
                >
                  {idx < steps.length - 1 ? "다음" : "완료"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 로딩 */
        <div className="guide-tour__loading">
          <div className="guide-tour__loading-card">
            화면을 준비하고 있어요…
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
