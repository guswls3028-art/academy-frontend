/**
 * 인터랙티브 가이드 투어 — 타겟 요소 하이라이트 + 단계별 안내 팝오버
 * antd 의존 없이 CSS-only spotlight + portal popover
 */
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { TourStep } from "./types";

type Props = { steps: TourStep[]; onClose: () => void };

export function GuideTour({ steps, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);

  const step = steps[idx];

  /* ---- 타겟 요소 탐색 & 스크롤 ---- */
  useEffect(() => {
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
  }, [idx, step.selector, steps.length, onClose]);

  /* ---- 스크롤/리사이즈 추적 ---- */
  useEffect(() => {
    if (!ready) return;
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
  }, [ready, step.selector]);

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

  /* ---- 팝오버 위치 계산 ---- */
  const popover = (() => {
    if (!rect) return { top: 0, left: 0 };
    const W = 300;
    const GAP = 14;
    const pl = step.placement || "bottom";
    let t = 0, l = 0;

    if (pl === "top") { t = rect.top - GAP - 8; l = rect.left + rect.width / 2 - W / 2; }
    else if (pl === "bottom") { t = rect.bottom + GAP; l = rect.left + rect.width / 2 - W / 2; }
    else if (pl === "left") { t = rect.top + rect.height / 2 - 60; l = rect.left - GAP - W; }
    else { t = rect.top + rect.height / 2 - 60; l = rect.right + GAP; }

    l = Math.max(12, Math.min(l, window.innerWidth - W - 12));
    t = Math.max(12, Math.min(t, window.innerHeight - 160));
    return { top: t, left: l, width: W };
  })();

  const PAD = 8;

  return createPortal(
    <>
      {/* spotlight hole */}
      {rect && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: 10,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.52)",
            zIndex: 10000,
            pointerEvents: "none",
            transition: "all 280ms cubic-bezier(.4,0,.2,1)",
          }}
        />
      )}

      {/* click-catcher behind popover */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 10001 }}
        onClick={onClose}
      />

      {/* popover card */}
      {ready && rect ? (
        <div
          style={{
            position: "fixed",
            ...popover,
            zIndex: 10002,
            animation: "guideTourFadeIn 200ms ease",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "18px 20px 14px",
              boxShadow:
                "0 8px 30px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
              color: "#1a1a1a",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              {step.title}
            </div>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.65,
                color: "#555",
                marginBottom: 16,
              }}
            >
              {step.description}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 12, color: "#aaa" }}>
                {idx + 1} / {steps.length}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                {idx > 0 && (
                  <button onClick={prev} style={btnBase}>
                    이전
                  </button>
                )}
                <button onClick={next} style={btnPrimary}>
                  {idx < steps.length - 1 ? "다음" : "완료"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 로딩 */
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "20px 28px",
              fontSize: 14,
              color: "#444",
            }}
          >
            화면을 준비하고 있어요…
          </div>
        </div>
      )}

      {/* keyframe injection */}
      <style>{`
        @keyframes guideTourFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>,
    document.body,
  );
}

/* ---- button styles ---- */
const btnBase: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "#fff",
  color: "#555",
  fontSize: 13,
  cursor: "pointer",
  lineHeight: 1.4,
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 600,
};
