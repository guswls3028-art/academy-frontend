// PATH: src/shared/ui/domain/DomainListToolbar.tsx
// Design SSOT — 리스트 페이지 툴바 (총계 | 검색 | 필터 | 추가)

import { ReactNode } from "react";
import { ControlSizeContext } from "@/shared/ui/ds/ControlSizeContext";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import styles from "./DomainListToolbar.module.css";

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
  compactMobile?: boolean;
  inlineFiltersOnDesktop?: boolean;
};

export default function DomainListToolbar({
  totalLabel,
  searchSlot,
  filterSlot,
  primaryAction,
  belowSlot,
  compactMobile = false,
  inlineFiltersOnDesktop = false,
}: DomainListToolbarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <ControlSizeContext.Provider value="lg">
      <div className="domain-list-toolbar flex flex-col gap-2" data-control-size="lg">
        <div className={compactMobile ? styles.mobileCompactRow : "flex flex-col gap-2"}>
          <span className={styles.totalMobile}>
            {totalLabel}
          </span>
          {compactMobile && <div className={styles.fullWidth}>{searchSlot}</div>}
          {primaryAction && <div className={styles.mobileActionScroller}>{primaryAction}</div>}
        </div>
        {!compactMobile && <div className={styles.fullWidth}>{searchSlot}</div>}
        {/* 필터 */}
        {filterSlot && (
          <div className={`flex items-center gap-2 ${styles.horizontalScroller}`}>
            {filterSlot}
          </div>
        )}
        {/* 선택 바 */}
        {belowSlot && (
          <div className={styles.mobileBelowScroller}>
            {belowSlot}
          </div>
        )}
      </div>
      </ControlSizeContext.Provider>
    );
  }

  return (
    <ControlSizeContext.Provider value="lg">
    <div className="domain-list-toolbar flex flex-col gap-3" data-control-size="lg">
      <div className={`${styles.desktopMainRow} ${inlineFiltersOnDesktop ? styles.inlineFiltersRow : ""}`}>
        <span className={styles.totalDesktop}>
          {totalLabel}
        </span>
        <div className={styles.desktopSearch}>{searchSlot}</div>
        {inlineFiltersOnDesktop && filterSlot && <div className={styles.desktopFilters}>{filterSlot}</div>}
        <div className={styles.desktopPrimary}>{primaryAction}</div>
      </div>
      {!inlineFiltersOnDesktop && filterSlot && <div className={styles.desktopFilters}>{filterSlot}</div>}
      {belowSlot && <div className={styles.desktopBelow}>{belowSlot}</div>}
    </div>
    </ControlSizeContext.Provider>
  );
}
