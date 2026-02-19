// PATH: src/student/domains/media/playback/player/design/ui.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { clamp } from "./utils";

export function Pill({
  children,
  tone = "neutral",
}: {
  children: any;
  tone?: "neutral" | "warn" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "svpPill svpPillDanger"
      : tone === "warn"
        ? "svpPill svpPillWarn"
        : "svpPill";
  return <span className={cls}>{children}</span>;
}

export function IconButton({
  icon,
  label,
  onClick,
}: {
  icon:
    | "play"
    | "pause"
    | "replay10"
    | "forward10"
    | "volume"
    | "mute"
    | "fullscreen"
    | "theater"
    | "shrink";
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="svpBtn" onClick={onClick} aria-label={label} title={label}>
      <span className="svpBtnIcon" aria-hidden="true">
        {icon === "play" ? "▶" : null}
        {icon === "pause" ? "❚❚" : null}
        {icon === "replay10" ? "↺10" : null}
        {icon === "forward10" ? "10↻" : null}
        {icon === "volume" ? "🔊" : null}
        {icon === "mute" ? "🔇" : null}
        {icon === "fullscreen" ? "⛶" : null}
        {icon === "theater" ? "▭" : null}
        {icon === "shrink" ? "▢" : null}
      </span>
    </button>
  );
}

export function RangeSlider({
  value,
  min,
  max,
  step,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  ariaLabel?: string;
}) {
  const v = Number(value || 0);
  const mn = Number(min || 0);
  const mx = Math.max(mn + 0.0001, Number(max || 0));
  const st = Number(step || 0.01);

  return (
    <input
      className="svpRange"
      type="range"
      value={clamp(v, mn, mx)}
      min={mn}
      max={mx}
      step={st}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={ariaLabel || "range"}
    />
  );
}

export type MenuItem = {
  label: string;
  onClick: () => void;
};

export function KebabMenu({
  label,
  items,
  align = "left",
  disabled,
  buttonClassName,
}: {
  label: string;
  items: MenuItem[];
  align?: "left" | "right";
  disabled?: boolean;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: any) => {
      if (!root.current) return;
      if (!root.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="svpMenu" ref={root}>
      <button
        type="button"
        className={`svpBtn svpBtnKebab ${buttonClassName || ""}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-label={label}
        title={label}
        disabled={!!disabled}
      >
        <span className="svpBtnIcon" aria-hidden="true">
          ⋮
        </span>
      </button>

      {open && !disabled && (
        <div className={`svpMenuPanel ${align === "right" ? "svpMenuRight" : ""}`}>
          {items.map((it, idx) => (
            <button
              key={idx}
              type="button"
              className="svpMenuItem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlayerToast({
  toast,
  onClose,
}: {
  toast: { text: string; kind?: "info" | "warn" | "danger" } | null;
  onClose: () => void;
}) {
  const t = toast;
  const [show, setShow] = useState(!!t);

  useEffect(() => {
    if (!t) {
      setShow(false);
      return;
    }
    setShow(true);
    const id = window.setTimeout(() => onClose(), 2600);
    return () => window.clearTimeout(id);
  }, [t, onClose]);

  if (!t || !show) return null;

  const cls =
    t.kind === "danger" ? "svpToast svpToastDanger" : t.kind === "warn" ? "svpToast svpToastWarn" : "svpToast";

  return (
    <div className={cls} role="status" aria-live="polite">
      <div className="svpToastText">{t.text}</div>
      <button type="button" className="svpToastClose" onClick={onClose} aria-label="닫기">
        ✕
      </button>
    </div>
  );
}
