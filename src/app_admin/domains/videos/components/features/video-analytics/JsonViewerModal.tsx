// PATH: src/app_admin/domains/videos/components/features/video-analytics/JsonViewerModal.tsx

import { useMemo, useState } from "react";
import { Badge } from "@/shared/ui/ds";
import "./JsonViewerModal.css";

interface Props {
  open: boolean;
  title: string;
  payload: unknown;
  snapshot: unknown;
  onClose: () => void;
}

type PanelKey = "payload" | "snapshot";

export default function JsonViewerModal({
  open,
  title,
  payload,
  snapshot,
  onClose,
}: Props) {
  const [activePanel, setActivePanel] = useState<PanelKey | "both">("both");

  const prettyPayload = useMemo(
    () => JSON.stringify(payload ?? {}, null, 2),
    [payload]
  );
  const prettySnap = useMemo(
    () => JSON.stringify(snapshot ?? {}, null, 2),
    [snapshot]
  );

  if (!open) return null;

  const showPayload = activePanel === "both" || activePanel === "payload";
  const showSnapshot = activePanel === "both" || activePanel === "snapshot";

  return (
    <div className="json-viewer-overlay">
      <div className="json-viewer-modal">
        {/* Header */}
        <div className="json-viewer-header">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="json-viewer-title">
                {title}
              </div>
              <div className="json-viewer-subtitle">
                event_payload / policy_snapshot 비교
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* View toggle */}
              <div className="json-viewer-toggle">
                {(
                  [
                    { key: "both", label: "양쪽" },
                    { key: "payload", label: "Payload" },
                    { key: "snapshot", label: "Snapshot" },
                  ] as { key: typeof activePanel; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActivePanel(key)}
                    className="json-viewer-toggle-button"
                    data-active={activePanel === key}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="json-viewer-close"
              >
                닫기
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="json-viewer-body">
          <div className="json-viewer-shell">
            <div
              className={[
                "json-viewer-grid",
                showPayload && showSnapshot && "json-viewer-grid--split",
              ].filter(Boolean).join(" ")}
            >
              {showPayload && (
                <div className="json-viewer-panel">
                  <div className="json-viewer-panel-header">
                    <span className="json-viewer-panel-label">
                      event_payload
                    </span>
                    <Badge variant="solid" tone="primary" oneChar>
                      JSON
                    </Badge>
                  </div>
                  <pre className="json-viewer-pre">
                    {prettyPayload}
                  </pre>
                </div>
              )}

              {showSnapshot && (
                <div className="json-viewer-panel">
                  <div className="json-viewer-panel-header">
                    <span className="json-viewer-panel-label">
                      policy_snapshot
                    </span>
                    <Badge variant="solid" tone="neutral" oneChar>
                      JSON
                    </Badge>
                  </div>
                  <pre className="json-viewer-pre">
                    {prettySnap}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
