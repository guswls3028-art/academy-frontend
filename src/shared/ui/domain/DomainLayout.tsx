// PATH: src/shared/ui/domain/DomainLayout.tsx
// 페이지 헤더 SSOT — 도메인별 제목·설명·탭은 여기서만 담당.
// 레이아웃을 쓰는 페이지는 탭 아래에 SectionHeader 등 "내부 헤더"를 넣지 말 것.

import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import DomainTabs, { type DomainTab } from "./DomainTabs";
import DomainPanel from "./DomainPanel";

export type { DomainTab } from "./DomainTabs";

export type DomainCrumb = { label: string; to?: string };

type DomainLayoutProps = {
  title: string;
  description?: string;
  /** 도메인 헤더 상단 브레드크럼 (예: 강의 › 박철의 생명과학) */
  breadcrumbs?: DomainCrumb[];
  tabs?: DomainTab[];
  children: ReactNode;
};

export default function DomainLayout({
  title,
  description,
  breadcrumbs,
  tabs,
  children,
}: DomainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-full bg-[var(--bg-page)]" data-app="admin">
      {/* DOMAIN HEADER — 은은한 primary 톤 + 좌측 액센트, 탭 있으면 맨 바닥에 여백 없이 */}
      <div
        className={`relative flex flex-col ${tabs != null && tabs.length > 0 ? "domain-header--with-tabs" : ""}`}
        style={{
          background: "color-mix(in srgb, var(--color-primary) 8%, var(--bg-surface))",
          borderBottom: "1px solid var(--color-border-divider-strong)",
          paddingLeft: "var(--space-6)",
          paddingRight: "var(--space-6)",
          paddingTop: "var(--space-7)",
          paddingBottom: tabs != null && tabs.length > 0 ? 0 : "var(--space-4)",
        }}
      >
        <div className="relative flex-shrink-0">
          <div
            className="absolute left-0 top-1 rounded-full bg-[var(--color-primary)]"
            style={{ width: 4, height: 24 }}
            aria-hidden
          />
          <div style={{ paddingLeft: "var(--space-4)" }}>
            {breadcrumbs != null && breadcrumbs.length > 0 ? (
              <div
                className="flex items-center gap-2 flex-wrap text-2xl tracking-tight"
                style={{ fontWeight: 700, color: "var(--color-text-primary)" }}
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
                className="text-2xl tracking-tight"
                style={{ fontWeight: 700, color: "var(--color-text-primary)" }}
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
          padding: "var(--space-6)",
        }}
      >
        <DomainPanel>{children}</DomainPanel>
      </div>
    </div>
  );
}
