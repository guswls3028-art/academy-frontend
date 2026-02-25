/**
 * YouTube-style seek overlay: animated "» 20s" / "« 20s" with ripple.
 * Scale 0.8→1, opacity 0→1→0, cubic-bezier(0.2, 0.8, 0.2, 1).
 */
import { useEffect, useState } from "react";
import type { SeekOverlayState } from "./useDoubleTapSeek";

const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

export default function SeekOverlay({ overlay }: { overlay: SeekOverlayState }) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    if (!overlay) {
      setVisible(false);
      return;
    }
    setVisible(true);
    setPhase("in");
    const t = setTimeout(() => setPhase("out"), 320);
    return () => clearTimeout(t);
  }, [overlay?.key]);

  if (!overlay || !visible) return null;

  const { delta, side } = overlay;
  const isForward = side === "right";
  const label = `${isForward ? "»" : "«"} ${delta}s`;

  return (
    <div
      className="svpSeekOverlay"
      role="status"
      aria-live="polite"
      aria-label={isForward ? `앞으로 ${delta}초` : `뒤로 ${delta}초`}
      data-phase={phase}
      data-side={side}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 15,
      }}
    >
      <div className="svpSeekOverlay__ripple" data-side={side} />
      <div className="svpSeekOverlay__content" data-side={side}>
        <span className="svpSeekOverlay__label">{label}</span>
      </div>
    </div>
  );
}
