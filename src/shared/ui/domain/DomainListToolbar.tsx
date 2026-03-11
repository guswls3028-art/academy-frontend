// PATH: src/shared/ui/domain/DomainListToolbar.tsx
// Design SSOT — 리스트 페이지 툴바 (총계 | 검색 | 필터 | 추가)

import { ReactNode } from "react";
import { useIsMobile } from "@/shared/hooks/useIsMobile";

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
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="domain-list-toolbar flex flex-col gap-2">
        {/* 총계 + 액션 버튼 */}
        <div className="flex items-center justify-between gap-2">
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--color-text-primary)",
            }}
          >
            {totalLabel}
          </span>
          {primaryAction}
        </div>
        {/* 검색 풀와이드 */}
        <div style={{ width: "100%" }}>{searchSlot}</div>
        {/* 필터 */}
        {filterSlot && (
          <div className="flex items-center gap-2" style={{ overflowX: "auto" }}>
            {filterSlot}
          </div>
        )}
        {/* 선택 바 */}
        {belowSlot && (
          <div
            style={{
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              paddingBottom: 2,
            }}
          >
            {belowSlot}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="domain-list-toolbar flex flex-col gap-3">
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
