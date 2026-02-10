// PATH: src/features/notice/overlays/NoticeOverlay.tsx
import Panel from "@/shared/ui/ds/Panel";
import { useNotices } from "../context/NoticeContext";

function levelColor(level: string) {
  if (level === "success") return "var(--color-success)";
  if (level === "warning") return "var(--color-warning)";
  if (level === "error") return "var(--color-error)";
  return "var(--color-info)";
}

export default function NoticeOverlay({ onClose }: { onClose: () => void }) {
  const { notices, remove, clear } = useNotices();

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/30">
      <div
        className="w-[420px] h-full"
        style={{
          background: "var(--color-bg-surface)",
          borderLeft: "1px solid var(--color-border-divider)",
        }}
      >
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            borderBottom: "1px solid var(--color-border-divider)",
          }}
        >
          <div style={{ fontWeight: 900, letterSpacing: "-0.2px" }}>알림</div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={clear}
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: "var(--color-text-muted)",
              }}
            >
              모두 지우기
            </button>
            <button
              onClick={onClose}
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: "var(--color-text-muted)",
              }}
            >
              닫기
            </button>
          </div>
        </div>

        <div style={{ padding: 16, overflow: "auto", height: "calc(100% - 56px)" }}>
          {notices.length === 0 && (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--color-text-muted)",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              알림이 없습니다
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notices.map((n) => (
              <Panel
                key={n.id}
                header={
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: levelColor(n.level),
                          flex: "0 0 auto",
                        }}
                      />
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 900,
                          letterSpacing: "-0.15px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={n.title}
                      >
                        {n.title}
                      </div>
                    </div>

                    <button
                      onClick={() => remove(n.id)}
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        color: "var(--color-text-muted)",
                        cursor: "pointer",
                      }}
                      aria-label="알림 제거"
                      title="알림 제거"
                    >
                      ✕
                    </button>
                  </div>
                }
              >
                {n.body && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "var(--color-text-muted)",
                      lineHeight: 1.35,
                    }}
                  >
                    {n.body}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    fontWeight: 800,
                    color: "var(--color-text-disabled)",
                  }}
                >
                  {new Date(n.created_at).toLocaleString("ko-KR")}
                </div>
              </Panel>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
