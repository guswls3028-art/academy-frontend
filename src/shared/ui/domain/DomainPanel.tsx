// PATH: src/shared/ui/domain/DomainPanel.tsx
// 도메인 콘텐츠 스테이지 — 카드가 아닌 “바닥”. 테두리·그림자 없이 배경만.

import { ReactNode } from "react";

type DomainPanelProps = {
  children: ReactNode;
};

export default function DomainPanel({ children }: DomainPanelProps) {
  return (
    <div
      className="domain-panel"
      style={{
        background: "transparent",
      }}
    >
      {children}
    </div>
  );
}
