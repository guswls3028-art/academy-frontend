// PATH: src/shared/ui/domain/DomainListToolbar.tsx
// Design SSOT — 리스트 페이지 툴바 (총계 | 검색 | 필터 | 추가)

import { ReactNode } from "react";

type DomainListToolbarProps = {
  /** 좌측 총계 표시 (예: "총 12명", "총 5개") */
  totalLabel: ReactNode;
  /** 검색 input (ds-input) */
  searchSlot: ReactNode;
  /** 필터 버튼 (선택) */
  filterSlot?: ReactNode;
  /** 메인 추가 버튼 (필수) */
  primaryAction: ReactNode;
  /** 검색창 밑에 표시 (예: N명 선택됨 + 액션 버튼) */
  belowSlot?: ReactNode;
};

export default function DomainListToolbar({
  totalLabel,
  searchSlot,
  filterSlot,
  primaryAction,
  belowSlot,
}: DomainListToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-3">
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "var(--color-text-primary)",
          paddingRight: 12,
          borderRight: "1px solid var(--color-border-divider)",
          marginRight: 4,
        }}
      >
        {totalLabel}
      </span>
      {searchSlot}
      {filterSlot}
      {primaryAction}
    </div>
    {belowSlot}
    </div>
  );
}
