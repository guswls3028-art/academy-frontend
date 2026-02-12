// PATH: src/features/notice/pages/NoticePage.tsx
import NoticeOverlay from "@/features/notice/overlays/NoticeOverlay";
import { useState } from "react";
import { Button } from "@/shared/ui/ds";

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
          <Button type="button" intent="secondary" size="md" onClick={() => setOpen(true)} className="mt-4">
            알림 오버레이 열기
          </Button>
        </div>
      )}
    </div>
  );
}
