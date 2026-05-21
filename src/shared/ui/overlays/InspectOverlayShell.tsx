import { useEffect, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Panel } from "@/shared/ui/ds";

type InspectOverlayShellProps = {
  title: string;
  description?: string;
  width?: number;
  onClose: () => void;

  /** NEW */
  sidebar?: ReactNode;
  tabs?: ReactNode;
  children: ReactNode;
};

type InspectOverlayStyle = CSSProperties & {
  "--inspect-overlay-width": string;
};

function getOverlayWidthStyle(width: number): InspectOverlayStyle {
  return { "--inspect-overlay-width": `${width}px` };
}

export default function InspectOverlayShell({
  title,
  description,
  width = 1080,
  onClose,
  sidebar,
  tabs,
  children,
}: InspectOverlayShellProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  return createPortal(
    <div
      data-overlay="inspect"
      className="inspect-overlay-shell"
      onClick={onClose}
    >
      <div
        className="inspect-overlay-shell__inner"
        style={getOverlayWidthStyle(width)}
        onClick={(e) => e.stopPropagation()}
      >
        <Panel title={title} description={description}>
          <div
            className={`inspect-overlay-shell__grid${sidebar ? " inspect-overlay-shell__grid--with-sidebar" : ""}`}
          >
            {/* ===== LEFT : META / SUMMARY ===== */}
            {sidebar && (
              <Panel variant="subtle" density="compact">
                {sidebar}
              </Panel>
            )}

            {/* ===== RIGHT : WORK ===== */}
            <div className="inspect-overlay-shell__content">
              {tabs && <div className="inspect-overlay-shell__tabs">{tabs}</div>}

              <div>{children}</div>
            </div>
          </div>
        </Panel>
      </div>
    </div>,
    document.body,
  );
}
