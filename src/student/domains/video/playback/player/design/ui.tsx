// PATH: src/student/domains/video/playback/player/design/ui.tsx
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
  onPointerDown,
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
  onClick?: () => void;
  /** 모바일에서 전체화면 등 사용자 제스처 직후 API 호출용. 전달 시 pointerdown에서 호출하고 preventDefault로 click 중복 방지 */
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const handlePointerDown = (e: React.PointerEvent) => {
    if (onPointerDown) {
      onPointerDown(e);
      e.preventDefault();
    }
  };
  const svgMap: Record<string, JSX.Element> = {
    play: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 4.5v15l13-7.5z"/></svg>,
    pause: <svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4.5" height="16" rx="1"/><rect x="14.5" y="4" width="4.5" height="16" rx="1"/></svg>,
    replay10: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/><text x="12" y="15.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none">10</text></svg>,
    forward10: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/><text x="12" y="15.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none">10</text></svg>,
    volume: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>,
    mute: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>,
    fullscreen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>,
    theater: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="10" rx="2"/></svg>,
    shrink: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>,
  };
  return (
    <button
      type="button"
      className="svpBtn"
      onClick={onPointerDown ? undefined : onClick}
      onPointerDown={onPointerDown ? handlePointerDown : undefined}
      aria-label={label}
      title={label}
    >
      {svgMap[icon] || <span className="svpBtnIcon">{icon}</span>}
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

export function SpeedButton({
  rate,
  speeds,
  disabled,
  onSelect,
}: {
  rate: number;
  speeds: number[];
  disabled?: boolean;
  onSelect: (r: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: any) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const label = rate % 1 === 0 ? `${rate}x` : `${rate.toFixed(2)}x`;

  return (
    <div className="svpSpeedWrap" ref={ref}>
      <button
        type="button"
        className={`svpSpeedBtn${disabled ? " svpSpeedBtn--disabled" : ""}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-label={disabled ? "배속 제한" : `배속 ${label}`}
        title={disabled ? "배속 제한" : `배속 ${label}`}
        disabled={!!disabled}
      >
        {label}
      </button>
      {open && !disabled && (
        <div className="svpSpeedMenu">
          {speeds.filter((r) => r <= 3).map((r) => (
            <button
              key={r}
              type="button"
              className={`svpSpeedMenuItem${Math.abs(r - rate) < 0.001 ? " svpSpeedMenuItem--active" : ""}`}
              onClick={() => { onSelect(r); setOpen(false); }}
            >
              <span>{r}x</span>
              {Math.abs(r - rate) < 0.001 && <span className="svpSpeedCheck">✓</span>}
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
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!t) {
      setShow(false);
      return;
    }
    setShow(true);
    const id = window.setTimeout(() => onCloseRef.current(), 2600);
    return () => window.clearTimeout(id);
  }, [t]);

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
