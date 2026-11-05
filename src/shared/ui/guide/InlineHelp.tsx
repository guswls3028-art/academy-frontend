import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CircleHelp, X } from "lucide-react";
import type { GuideBookScope } from "./GuideBookPresets";
import "./InlineHelp.css";

type InlineHelpProps = {
  title: ReactNode;
  children: ReactNode;
  tone?: GuideBookScope;
  align?: "left" | "right";
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
  iconSize?: number;
  openOnHover?: boolean;
  style?: CSSProperties;
};

export function InlineHelp({
  title,
  children,
  tone = "admin",
  align = "left",
  ariaLabel = "도움말",
  className = "",
  triggerClassName = "",
  iconSize = 16,
  openOnHover = false,
  style,
}: InlineHelpProps) {
  const [open, setOpen] = useState(false);
  const pinnedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeHelp = useCallback(() => {
    pinnedRef.current = false;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeHelp();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeHelp();
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("touchstart", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("touchstart", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, closeHelp]);

  return (
    <div
      ref={rootRef}
      className={`inline-help ${className}`.trim()}
      data-tone={tone}
      data-align={align}
      style={style}
      onPointerEnter={(event) => {
        if (openOnHover && event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (
          openOnHover
          && event.pointerType === "mouse"
          && !pinnedRef.current
          && !rootRef.current?.contains(document.activeElement)
        ) closeHelp();
      }}
      onFocusCapture={(event) => {
        if (openOnHover && event.target.matches(":focus-visible")) setOpen(true);
      }}
      onBlurCapture={(event) => {
        if (openOnHover && !rootRef.current?.contains(event.relatedTarget as Node | null)) {
          closeHelp();
        }
      }}
    >
      <button
        type="button"
        className={`inline-help__trigger ${triggerClassName}`.trim()}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={ariaLabel}
        onClick={() => {
          if (openOnHover ? pinnedRef.current : open) closeHelp();
          else {
            pinnedRef.current = true;
            setOpen(true);
          }
        }}
      >
        <CircleHelp size={iconSize} strokeWidth={2.2} aria-hidden />
      </button>

      {open && <span className="inline-help__hover-bridge" aria-hidden />}
      {open && (
        <div
          className="inline-help__popup"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <div className="inline-help__header">
            <strong id={titleId}>{title}</strong>
            <button
              type="button"
              className="inline-help__close"
              aria-label="도움말 닫기"
              onClick={closeHelp}
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          <div className="inline-help__body">{children}</div>
        </div>
      )}
    </div>
  );
}
