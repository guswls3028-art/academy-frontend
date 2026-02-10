// PATH: src/features/notice/pages/NoticePage.tsx
import NoticeOverlay from "@/features/notice/overlays/NoticeOverlay";
import { useState } from "react";

export default function NoticePage() {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ minHeight: 400 }}>
      {open && <NoticeOverlay onClose={() => setOpen(false)} />}
      {!open && (
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>알림</div>
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: "var(--color-text-muted)" }}>
            이 페이지는 디버그/검증용입니다. 실제 사용은 Header의 🔔 오버레이를 사용합니다.
          </div>
          <button
            onClick={() => setOpen(true)}
            style={{
              marginTop: 16,
              height: 40,
              borderRadius: 999,
              padding: "0 16px",
              border: "1px solid var(--color-border-divider)",
              background: "var(--color-bg-surface)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            알림 오버레이 열기
          </button>
        </div>
      )}
    </div>
  );
}
