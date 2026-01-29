// PATH: src/shared/ui/page/Page.tsx
// --------------------------------------------------
// 페이지 단위 레이아웃 래퍼
//
// - padding / max-width / 기본 텍스트 색상 책임
// - AppLayout 내부에서 반드시 이 컴포넌트를 통해 페이지를 구성한다
// --------------------------------------------------

import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export default function Page({ children, className }: Props) {
  return (
    <div className={`px-6 py-6 text-[var(--text-primary)] ${className ?? ""}`}>
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        {children}
      </div>
    </div>
  );
}
