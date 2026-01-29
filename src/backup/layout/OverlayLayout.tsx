// PATH: src/shared/ui/layout/OverlayLayout.tsx
// --------------------------------------------------
// OverlayLayout
// - Route 기반 상세/설정 패널용 레이아웃
// - 기존 페이지 위에 Overlay 형태로 렌더된다
// --------------------------------------------------

import { ReactNode } from "react";

export default function OverlayLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* panel */}
      <div className="relative h-full w-full max-w-[720px] bg-[var(--bg-surface)] shadow-xl animate-fadeUp">
        {children}
      </div>
    </div>
  );
}
