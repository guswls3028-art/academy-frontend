// PATH: src/shared/ui/domain/DomainLayout.tsx
// 페이지 헤더 SSOT — 도메인별 제목·설명·탭은 여기서만 담당.
// 레이아웃을 쓰는 페이지는 탭 아래에 SectionHeader 등 "내부 헤더"를 넣지 말 것.

import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import DomainTabs, { type DomainTab } from "./DomainTabs";
import DomainPanel from "./DomainPanel";
import { useIsMobile } from "@/shared/hooks/useIsMobile";

export type { DomainTab } from "./DomainTabs";

export type DomainCrumb = { label: string; to?: string };

type DomainLayoutProps = {
  title: string;
  description?: string;
  /** 도메인 헤더 상단 브레드크럼 (예: 강의 › 박철의 생명과학) */
  breadcrumbs?: DomainCrumb[];
  tabs?: DomainTab[];
  /** 제목 행 우측 액션 영역 (예: 설정 아이콘) */
  headerActions?: ReactNode;
  children: ReactNode;
};

export default function DomainLayout({
  title,
  description,
  breadcrumbs,
  tabs,
  headerActions,
  children,
}: DomainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-full bg-[var(--bg-page)]" data-app="admin">
      {/* DOMAIN HEADER — 은은한 primary 톤 + 좌측 액센트, 탭 있으면 맨 바닥에 여백 없이 */}
      <div
        className={`relative flex flex-col ${tabs != null && tabs.length > 0 ? "domain-header--with-tabs" : ""}`}
        style={{
          background: "color-mix(in srgb, var(--color-primary) 8%, var(--bg-surface))",
          borderBottom: "1px solid var(--color-border-divider-strong)",
          paddingLeft: isMobile ? "var(--space-4)" : "var(--space-6)",
          paddingRight: isMobile ? "var(--space-4)" : "var(--space-6)",
          paddingTop: isMobile ? "var(--space-4)" : "var(--space-7)",
          paddingBottom: tabs != null && tabs.length > 0 ? 0 : "var(--space-3)",
        }}
      >
        <div className="relative flex-shrink-0 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 relative">
            <div
              className="absolute left-0 top-1 rounded-full bg-[var(--color-primary)]"
              style={{ width: 4, height: 24 }}
              aria-hidden
            />
            <div style={{ paddingLeft: "var(--space-4)" }}>
              {breadcrumbs != null && breadcrumbs.length > 0 ? (
                <div
                  className="flex items-center gap-2 flex-wrap tracking-tight"
                  style={{
                    fontWeight: 700,
                    color: "var(--color-text-primary)",
                    fontSize: isMobile ? "1rem" : "1.5rem",
                  }}
                >
                  {breadcrumbs.map((c, idx) => (
                    <span key={`${c.label}-${idx}`} className="flex items-center gap-2">
                      {c.to ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(c.to!)}
                          onKeyDown={(e) => e.key === "Enter" && navigate(c.to!)}
                          style={{
                            cursor: "pointer",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          {c.label}
                        </span>
                      ) : (
                        <span>{c.label}</span>
                      )}
                      {idx < breadcrumbs.length - 1 && (
                        <span
                          style={{
                            color: "var(--color-text-disabled)",
                            fontWeight: 500,
                          }}
                        >
                          ›
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <div
                  className="tracking-tight"
                  style={{
                    fontWeight: 700,
                    color: "var(--color-text-primary)",
                    fontSize: isMobile ? "1.125rem" : "1.5rem",
                  }}
                >
                  {title}
                </div>
              )}
              {description != null && (
                <div
                  className="text-base mt-1"
                  style={{
                    color: "var(--color-text-muted)",
                    opacity: 0.9,
                  }}
                >
                  {description}
                </div>
              )}
            </div>
          </div>
          {headerActions != null && (
            <div className="flex items-center gap-2 flex-shrink-0 pt-1">{headerActions}</div>
          )}
        </div>

        {tabs != null && tabs.length > 0 && (
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
      <div
        style={{
          padding: isMobile ? "var(--space-3)" : "var(--space-4)",
        }}
      >
        <DomainPanel>{children}</DomainPanel>
      </div>
    </div>
  );
}
