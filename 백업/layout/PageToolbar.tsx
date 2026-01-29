// PATH: src/shared/ui/layout/PageToolbar.tsx
// --------------------------------------------------
// PageToolbar
// - 검색 / 필터 / 액션용 상단 툴바
// - PageSection 안에서 사용한다
// --------------------------------------------------

import { ReactNode } from "react";

export default function PageToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      {children}
    </div>
  );
}
