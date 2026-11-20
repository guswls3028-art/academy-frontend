// PATH: src/app_student/domains/video/playback/player/design/ui.tsx
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Settings } from "lucide-react";
import { createPortal } from "react-dom";
import type { QualityLevel } from "../headless/controllerTypes";
import { clamp, getActiveFullscreenElement } from "./utils";
import "./ui.css";

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
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
  className,
  disabled = false,
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
  /** 모바일에서 전체화면 등 사용자 제스처 직후 API 호출용. 키보드/구형 브라우저 click도 fallback 처리 */
  onPointerDown?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const pointerHandledRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (onPointerDown) {
      pointerHandledRef.current = true;
      window.setTimeout(() => {
        pointerHandledRef.current = false;
      }, 500);
      onPointerDown();
      e.preventDefault();
    }
  };
  const handleClick = () => {
    if (onPointerDown) {
      if (pointerHandledRef.current) {
        pointerHandledRef.current = false;
        return;
      }
      onPointerDown();
      return;
    }
    onClick?.();
  };
  // 아이콘 크기. 모바일/터치 환경에서는 24px(WCAG/Apple HIG 권장 hit area 44+ px),
  // 데스크톱에서는 22px로 살짝 키워 노약자/저시력 학생 가독성 확보.
  const S = typeof window !== "undefined" && (("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0) ? 24 : 22;
  const svgMap: Record<string, React.ReactNode> = {
    play: <svg width={S} height={S} viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 4.5v15l13-7.5z"/></svg>,
    pause: <svg width={S} height={S} viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4.5" height="16" rx="1"/><rect x="14.5" y="4" width="4.5" height="16" rx="1"/></svg>,
    replay10: <svg width={S} height={S} viewBox="0 0 24 24" fill="none"><path d="M8 5a8 8 0 1 1-3.7 7M8 2 5 5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><text x="12" y="16.1" textAnchor="middle" fill="currentColor" fontSize="8.5" fontWeight="700">10</text></svg>,
    forward10: <svg width={S} height={S} viewBox="0 0 24 24" fill="none"><path d="M16 5a8 8 0 1 0 3.7 7M16 2l3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><text x="12" y="16.1" textAnchor="middle" fill="currentColor" fontSize="8.5" fontWeight="700">10</text></svg>,
    volume: <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>,
    mute: <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>,
    fullscreen: <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5m6 0h5v5m0 6v5h-5M9 20H4v-5"/></svg>,
    theater: <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="10" rx="2"/></svg>,
    shrink: <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h5V4m6 0v5h5m0 6h-5v5m-6 0v-5H4"/></svg>,
  };
  return (
    <button
      type="button"
      className={["svpBtn", `svpBtn--${icon}`, className || ""].filter(Boolean).join(" ")}
      data-svp-icon={icon}
      onClick={handleClick}
      onPointerDown={onPointerDown ? handlePointerDown : undefined}
      aria-label={label}
      title={label}
      disabled={disabled}
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
  disabled = false,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  ariaLabel?: string;
  disabled?: boolean;
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
      disabled={disabled}
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
    const onDown = (e: MouseEvent) => {
      if (!root.current) return;
      if (!root.current.contains(e.target as Node)) setOpen(false);
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

const fullscreenChangeEvents = ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange"];

function floatingMenuRoot(button: HTMLButtonElement | null): Element {
  const fullscreen = getActiveFullscreenElement();
  // Native fullscreen covers body portals; keep the menu inside its own player's root.
  return fullscreen?.contains(button) ? fullscreen : document.body;
}

export function PlaybackSettings({
  rate, speeds, speedLocked, onSpeed, qualities, currentQuality, onQuality, open, onOpenChange,
}: {
  rate: number;
  speeds: number[];
  speedLocked: boolean;
  onSpeed: (rate: number) => void;
  qualities?: QualityLevel[];
  currentQuality: number;
  onQuality: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [position, setPosition] = useState<CSSProperties>({});
  const close = () => {
    onOpenChange(false);
    button.current?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const place = () => {
      const rect = button.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = 8;
      const above = rect.top - gap * 2;
      const below = window.innerHeight - rect.bottom - gap * 2;
      const width = Math.min(280, window.innerWidth - gap * 2);
      const left = Math.max(gap, Math.min(rect.right - width, window.innerWidth - width - gap));
      const placement = above >= Math.min(240, below)
        ? { bottom: window.innerHeight - rect.top + gap, maxHeight: above }
        : { top: rect.bottom + gap, maxHeight: below };
      setPosition({ left, width, ...placement });
    };
    place();
    panel.current?.focus({ preventScroll: true });
    const dismiss = (event: Event) => {
      const target = event.target as Node;
      if (!button.current?.contains(target) && !panel.current?.contains(target)) onOpenChange(false);
    };
    const onFullscreen = () => onOpenChange(false);
    const down = typeof window.PointerEvent === "function" ? "pointerdown" : "mousedown";
    document.addEventListener(down, dismiss);
    document.addEventListener("focusin", dismiss);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    fullscreenChangeEvents.forEach(type => document.addEventListener(type, onFullscreen));
    return () => {
      document.removeEventListener(down, dismiss);
      document.removeEventListener("focusin", dismiss);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      fullscreenChangeEvents.forEach(type => document.removeEventListener(type, onFullscreen));
    };
  }, [open, onOpenChange]);

  return (
    <>
      <button type="button" ref={button} className="svpPlaybackRateBtn"
        aria-label={`재생 설정, 배속 ${rate}배`} aria-haspopup="dialog" aria-expanded={open}
        aria-controls={open ? panelId : undefined} onClick={() => onOpenChange(!open)}>
        <Settings size={20} aria-hidden="true" />
        <span>배속 <b>{rate}×</b></span>
      </button>
      {open && createPortal(
        <div ref={panel} id={panelId} className="svpSettingsPanel" role="dialog" aria-label="재생 설정"
          style={position} tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}>
          <div className="svpSettingTitle">재생 속도</div>
          {speedLocked ? <p className="svpSettingValue">이 영상은 1배속으로 재생돼요.</p> : (
            <div className="svpSettingOptions" role="group" aria-label="재생 속도">
              {speeds.filter(speed => speed <= 3).map(speed => (
                <button type="button" key={speed} aria-label={`${speed}배속`}
                  aria-pressed={Math.abs(speed - rate) < 0.001}
                  onClick={() => { onSpeed(speed); close(); }}>
                  {speed}×
                </button>
              ))}
            </div>
          )}
          {qualities && (
            <div className="svpQualitySetting">
              <span id={`${panelId}-quality`}>화질</span>
              {qualities.length <= 1 ? <span>{qualities.length && qualities[0].index >= 0 ? qualities[0].label : "자동"}</span> : (
                <select aria-labelledby={`${panelId}-quality`} value={currentQuality}
                  onChange={(event) => { onQuality(Number(event.target.value)); close(); }}>
                  {qualities.map(quality => <option key={quality.index} value={quality.index}>
                    {quality.index === -1 ? "자동" : quality.label}
                  </option>)}
                </select>
              )}
            </div>
          )}
          <button type="button" className="svpSettingsDone" onClick={close}>닫기</button>
        </div>, floatingMenuRoot(button.current),
      )}
    </>
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
