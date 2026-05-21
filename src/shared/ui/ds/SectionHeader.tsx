// PATH: src/shared/ui/ds/SectionHeader.tsx
// 섹션 내부 제목용. 페이지 상단 제목(도메인 헤더)에는 사용 금지.
// 페이지 제목·탭은 DomainLayout에서만 담당. (탭 아래에 "근태" 같은 큰 헤더 중복 금지)
import React from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type SectionHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  navigation?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export default function SectionHeader({
  title,
  description,
  navigation,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cx("ds-section-header", className)}>
      <div className="ds-section-header__inner">
        <div className="ds-section-header__copy">
          <div className="ds-section-header__title">
            {title}
          </div>

          {description && (
            <div className="ds-section-header__description">
              {description}
            </div>
          )}
        </div>

        {actions && <div className="ds-section-header__actions">{actions}</div>}
      </div>

      {navigation && (
        <div className="ds-section-header__navigation">
          {navigation}
        </div>
      )}
    </div>
  );
}
