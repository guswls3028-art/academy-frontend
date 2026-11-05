// PATH: src/shared/ui/domain/DomainLayout.tsx
// 페이지 헤더 SSOT — 도메인별 제목·설명·탭은 여기서만 담당.
// 레이아웃을 쓰는 페이지는 탭 아래에 SectionHeader 등 "내부 헤더"를 넣지 말 것.

import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router";

import DomainTabs, { type DomainTab } from "./DomainTabs";
import DomainPanel from "./DomainPanel";
import { InlineHelp } from "@/shared/ui/guide";
import PageTrail from "@/shared/ui/navigation/PageTrail";
import { workspaceSectionForPath } from "@/core/navigation/workspaceSections";
import "./DomainLayout.css";

export type { DomainTab } from "./DomainTabs";

export type DomainCrumb = { label: string; to?: string };

type DomainLayoutProps = {
  title: string;
  description?: string;
  /** 상시 사용 안내는 기본적으로 제목 옆 ? 팝업으로 접는다. 데이터 맥락/오류는 visible 사용. */
  descriptionMode?: "help" | "visible";
  /** description 외에 별도 도움말 본문이 필요할 때 사용 */
  help?: ReactNode;
  helpTitle?: ReactNode;
  /** 도메인 헤더 상단 브레드크럼 (예: 강의 › 박철의 생명과학) */
  breadcrumbs?: DomainCrumb[];
  tabs?: DomainTab[];
  /** 정보 밀도가 높은 작업 화면에서 헤더를 낮게 쓰는 표시 옵션 */
  density?: "default" | "compact";
  /** 제목 행 우측 액션 영역 (예: 설정 아이콘) */
  headerActions?: ReactNode;
  /** 도메인별 반응형 보정이 필요할 때만 쓰는 루트 클래스 */
  className?: string;
  children: ReactNode;
};

export default function DomainLayout({
  title,
  description,
  descriptionMode,
  help,
  helpTitle,
  breadcrumbs,
  tabs,
  density = "default",
  headerActions,
  className,
  children,
}: DomainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const section = workspaceSectionForPath(location.pathname);
  const resolvedBreadcrumbs = breadcrumbs ?? (section && section.to !== location.pathname
    ? [{ label: section.title, to: section.to }] : []);
  const isCompact = density === "compact";
  const hasTabs = tabs != null && tabs.length > 0;
  const resolvedDescriptionMode =
    descriptionMode ?? (breadcrumbs != null && breadcrumbs.length > 0 ? "visible" : "help");
  const helpContent = help ?? (description != null && resolvedDescriptionMode === "help" ? description : null);
  const showVisibleDescription = description != null && resolvedDescriptionMode === "visible";
  const resolvedHelpTitle = helpTitle ?? `${title} 안내`;

  return (
    <div
      className={["domain-layout", className].filter(Boolean).join(" ")}
      data-app="admin"
      data-domain-density={density}
      data-page-level={resolvedBreadcrumbs.some((crumb) => crumb.to) ? "detail" : "overview"}
    >
      {/* 상위 경로 → 현재 화면 제목 → 해당 화면 안의 탭 */}
      <div
        className={[
          "domain-layout__header",
          hasTabs ? "domain-header--with-tabs" : "domain-layout__header--no-tabs",
          isCompact ? "domain-header--compact" : "",
        ].filter(Boolean).join(" ")}
      >
        <PageTrail items={resolvedBreadcrumbs.filter((crumb, index) =>
          !(index === resolvedBreadcrumbs.length - 1 && !crumb.to && crumb.label === title)
        )} />
        <div className="domain-layout__header-row">
          <div className="domain-layout__title-area">
            <div className="domain-layout__title-stack">
              <div className="domain-layout__heading-line">
                <h1 className="domain-layout__title">{title}</h1>
                {helpContent != null && (
                  <InlineHelp
                    title={resolvedHelpTitle}
                    tone="admin"
                    align="left"
                    ariaLabel={`${title} 도움말`}
                    className="domain-layout__help"
                  >
                    {typeof helpContent === "string" ? (
                      <p>{helpContent}</p>
                    ) : (
                      helpContent
                    )}
                  </InlineHelp>
                )}
              </div>
              {showVisibleDescription && (
                <div className="domain-layout__description">
                  {description}
                </div>
              )}
            </div>
          </div>
          {headerActions != null && (
            <div className="domain-layout__actions">{headerActions}</div>
          )}
        </div>

        {hasTabs && (
          <div className="domain-header__tabs-wrap">
            <DomainTabs
              tabs={tabs}
              pathname={location.pathname}
              onNavigate={(path) => navigate(path)}
            />
          </div>
        )}
      </div>

      {/* DOMAIN CONTENT (ds-panel) */}
      <div className="domain-layout__content">
        <DomainPanel>{children}</DomainPanel>
      </div>
    </div>
  );
}
