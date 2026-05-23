// PATH: src/shared/ui/domain/DomainLayout.tsx
// 페이지 헤더 SSOT — 도메인별 제목·설명·탭은 여기서만 담당.
// 레이아웃을 쓰는 페이지는 탭 아래에 SectionHeader 등 "내부 헤더"를 넣지 말 것.

import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import DomainTabs, { type DomainTab } from "./DomainTabs";
import DomainPanel from "./DomainPanel";
import "./DomainLayout.css";

export type { DomainTab } from "./DomainTabs";

export type DomainCrumb = { label: string; to?: string };

type DomainLayoutProps = {
  title: string;
  description?: string;
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
  breadcrumbs,
  tabs,
  density = "default",
  headerActions,
  className,
  children,
}: DomainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isCompact = density === "compact";
  const hasTabs = tabs != null && tabs.length > 0;

  return (
    <div
      className={["domain-layout", className].filter(Boolean).join(" ")}
      data-app="admin"
      data-domain-density={density}
    >
      {/* DOMAIN HEADER — 은은한 primary 톤 + 좌측 액센트, 탭 있으면 맨 바닥에 여백 없이 */}
      <div
        className={[
          "domain-layout__header",
          hasTabs ? "domain-header--with-tabs" : "domain-layout__header--no-tabs",
          isCompact ? "domain-header--compact" : "",
        ].filter(Boolean).join(" ")}
      >
        <div className="domain-layout__header-row">
          <div className="domain-layout__title-area">
            <div className="domain-layout__accent" aria-hidden />
            <div className="domain-layout__title-stack">
              {breadcrumbs != null && breadcrumbs.length > 0 ? (
                <div className="domain-layout__breadcrumbs">
                  {breadcrumbs.map((c, idx) => (
                    <span key={`${c.label}-${idx}`} className="flex items-center gap-2">
                      {c.to ? (
                        <span
                          className="domain-layout__breadcrumb-link"
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(c.to!)}
                          onKeyDown={(e) => e.key === "Enter" && navigate(c.to!)}
                        >
                          {c.label}
                        </span>
                      ) : (
                        <span>{c.label}</span>
                      )}
                      {idx < breadcrumbs.length - 1 && (
                        <span className="domain-layout__breadcrumb-separator">
                          ›
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="domain-layout__title">
                  {title}
                </div>
              )}
              {description != null && (
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
