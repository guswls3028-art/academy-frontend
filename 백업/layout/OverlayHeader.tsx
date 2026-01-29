// PATH: src/shared/ui/layout/OverlayHeader.tsx
// --------------------------------------------------
// OverlayHeader
// - Overlay 패널 상단 헤더
// - 제목 + 닫기 버튼 제공
// --------------------------------------------------

import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export default function OverlayHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-6 h-14 border-b border-[var(--border-divider)]">
      <h2 className="text-base font-semibold text-[var(--text-primary)]">
        {title}
      </h2>

      <div className="flex items-center gap-2">
        {actions}
        <button
          onClick={() => navigate(-1)}
          className="px-2 py-1 text-sm rounded hover:bg-[var(--bg-app)]"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
