import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { Panel, WorkZone } from "@/shared/ui/ds";

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

  return createPortal(
    <div
      data-overlay="inspect"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: 32,
        overflow: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <Panel title={title} description={description}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: sidebar ? "320px 1fr" : "1fr",
              gap: 24,
            }}
          >
            {/* ===== LEFT : META / SUMMARY ===== */}
            {sidebar && (
              <Panel variant="subtle" density="compact">
                {sidebar}
              </Panel>
            )}

            {/* ===== RIGHT : WORK ===== */}
            <div style={{ minWidth: 0 }}>
              {tabs && <div style={{ marginBottom: 12 }}>{tabs}</div>}

              <WorkZone>
                {children}
              </WorkZone>
            </div>
          </div>
        </Panel>
      </div>
    </div>,
    document.body
  );
}
