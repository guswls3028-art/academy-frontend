// PATH: src/features/videos/components/features/video-analytics/JsonViewerModal.tsx

import { useMemo, useState } from "react";

interface Props {
  open: boolean;
  title: string;
  payload: any;
  snapshot: any;
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
    <div
      className="fixed inset-0 flex items-center justify-center z-[400]"
      style={{
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: 960,
          height: 640,
          borderRadius: "var(--radius-xl)",
          background: "var(--color-bg-surface)",
          boxShadow: "var(--elevation-3), 0 0 0 1px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div
                className="font-semibold truncate"
                style={{
                  fontSize: "var(--text-sm, 13px)",
                  color: "var(--color-text-primary)",
                }}
              >
                {title}
              </div>
              <div
                className="mt-1"
                style={{
                  fontSize: "var(--text-xs, 11px)",
                  color: "var(--color-text-muted)",
                }}
              >
                event_payload / policy_snapshot 비교
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* View toggle */}
              <div
                className="flex items-center gap-1"
                style={{
                  padding: "var(--space-1)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-bg-surface-soft, var(--bg-surface-soft))",
                }}
              >
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
                    style={{
                      padding: "var(--space-1) var(--space-3)",
                      fontSize: "var(--text-xs, 11px)",
                      fontWeight: activePanel === key ? 600 : 500,
                      color:
                        activePanel === key
                          ? "var(--color-text-primary)"
                          : "var(--color-text-secondary)",
                      background:
                        activePanel === key
                          ? "var(--color-bg-surface)"
                          : "transparent",
                      boxShadow:
                        activePanel === key ? "var(--elevation-1)" : "none",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      transition: "all 140ms ease",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onClose}
                style={{
                  height: 28,
                  padding: "0 var(--space-3)",
                  fontSize: "var(--text-xs, 11px)",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  transition: "all 140ms ease",
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div
          className="flex-1 min-h-0"
          style={{ padding: "0 var(--space-5) var(--space-5)" }}
        >
          <div
            className="h-full min-h-0"
            style={{
              marginTop: "var(--space-4)",
              borderRadius: "var(--radius-lg)",
              background: "var(--color-bg-surface-soft, var(--bg-surface-soft))",
              padding: "var(--space-4)",
            }}
          >
            <div
              className="h-full min-h-0"
              style={{
                display: "grid",
                gridTemplateColumns:
                  showPayload && showSnapshot ? "1fr 1fr" : "1fr",
                gap: "var(--space-3)",
              }}
            >
              {showPayload && (
                <div
                  className="flex flex-col min-h-0 overflow-hidden"
                  style={{
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <div
                    className="flex items-center justify-between"
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      borderBottom: "1px solid var(--color-border-subtle)",
                      background:
                        "var(--color-bg-surface-soft, var(--bg-surface-soft))",
                    }}
                  >
                    <span
                      className="font-semibold"
                      style={{
                        fontSize: "var(--text-xs, 11px)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      event_payload
                    </span>
                    <span
                      className="ds-status-badge ds-status-badge--1ch"
                      data-tone="primary"
                    >
                      JSON
                    </span>
                  </div>
                  <pre
                    className="flex-1 overflow-auto whitespace-pre-wrap"
                    style={{
                      padding: "var(--space-3)",
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: "var(--color-text-secondary)",
                      background: "var(--color-bg-surface)",
                      fontFamily:
                        "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
                      margin: 0,
                    }}
                  >
                    {prettyPayload}
                  </pre>
                </div>
              )}

              {showSnapshot && (
                <div
                  className="flex flex-col min-h-0 overflow-hidden"
                  style={{
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <div
                    className="flex items-center justify-between"
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      borderBottom: "1px solid var(--color-border-subtle)",
                      background:
                        "var(--color-bg-surface-soft, var(--bg-surface-soft))",
                    }}
                  >
                    <span
                      className="font-semibold"
                      style={{
                        fontSize: "var(--text-xs, 11px)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      policy_snapshot
                    </span>
                    <span
                      className="ds-status-badge ds-status-badge--1ch"
                      data-tone="neutral"
                    >
                      JSON
                    </span>
                  </div>
                  <pre
                    className="flex-1 overflow-auto whitespace-pre-wrap"
                    style={{
                      padding: "var(--space-3)",
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: "var(--color-text-secondary)",
                      background: "var(--color-bg-surface)",
                      fontFamily:
                        "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
                      margin: 0,
                    }}
                  >
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
