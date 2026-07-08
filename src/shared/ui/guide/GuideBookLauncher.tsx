import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, BookOpen, HelpCircle, X } from "lucide-react";
import type { GuideBookPreset, GuideBookScope } from "./GuideBookPresets";
import "./GuideBookLauncher.css";

type Props = {
  preset: GuideBookPreset;
  tone: GuideBookScope;
  onNavigate: (path: string) => void;
  ariaLabel?: string;
  align?: "left" | "right";
  buttonClassName?: string;
  buttonStyle?: CSSProperties;
  iconSize?: number;
  supportAction?: {
    label: string;
    onClick: () => void;
  };
};

export function GuideBookLauncher({
  preset,
  tone,
  onNavigate,
  ariaLabel = "가이드북",
  align = "right",
  buttonClassName = "",
  buttonStyle,
  iconSize = 20,
  supportAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useMemo(() => `guidebook-title-${tone}`, [tone]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("touchstart", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("touchstart", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const go = (path?: string) => {
    if (!path) return;
    setOpen(false);
    onNavigate(path);
  };

  return (
    <div
      ref={rootRef}
      className="guidebook-launcher"
      data-tone={tone}
      data-align={align}
    >
      <button
        type="button"
        className={`guidebook-trigger ${buttonClassName}`.trim()}
        style={buttonStyle}
        aria-label={open ? "가이드북 닫기" : ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={ariaLabel}
        onClick={() => setOpen((value) => !value)}
      >
        <HelpCircle size={iconSize} strokeWidth={2.2} aria-hidden />
      </button>

      {open && (
        <section
          className="guidebook-popup"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <header className="guidebook-popup__header">
            <span className="guidebook-popup__mark" aria-hidden>
              <BookOpen size={18} strokeWidth={2.2} />
            </span>
            <span className="guidebook-popup__heading">
              <strong id={titleId}>{preset.title}</strong>
              <span>{preset.subtitle}</span>
            </span>
            <button
              type="button"
              className="guidebook-popup__close"
              aria-label="가이드북 닫기"
              onClick={() => setOpen(false)}
            >
              <X size={16} aria-hidden />
            </button>
          </header>

          <div className="guidebook-popup__body">
            {preset.sections.map((section) => (
              <section key={section.title} className="guidebook-popup__section">
                <h3>{section.title}</h3>
                <div className="guidebook-popup__items">
                  {section.items.map((item) => (
                    <button
                      key={`${section.title}-${item.title}`}
                      type="button"
                      className="guidebook-popup__item"
                      data-clickable={item.path ? "true" : undefined}
                      onClick={() => go(item.path)}
                      disabled={!item.path}
                    >
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                      </span>
                      {item.path ? (
                        <em>
                          {item.actionLabel ?? "열기"}
                          <ArrowRight size={13} strokeWidth={2.5} aria-hidden />
                        </em>
                      ) : null}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="guidebook-popup__footer">
            <button type="button" className="guidebook-popup__primary" onClick={() => go(preset.fullGuidePath)}>
              {preset.fullGuideLabel}
            </button>
            {supportAction ? (
              <button
                type="button"
                className="guidebook-popup__secondary"
                onClick={() => {
                  setOpen(false);
                  supportAction.onClick();
                }}
              >
                {supportAction.label}
              </button>
            ) : null}
          </footer>
        </section>
      )}
    </div>
  );
}
