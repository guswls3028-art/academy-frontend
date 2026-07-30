// PATH: src/shared/ui/domain/DomainTabs.tsx
// Students 도메인 UI SSOT — ds-tabs 공통 컴포넌트

import { Badge } from "@/shared/ui/ds";

export type DomainTab = {
  key: string;
  label: string;
  badge?: string;
  badgeTitle?: string;
  path?: string;
  locked?: boolean;
  /** true면 path와 완전 일치할 때만 active */
  exact?: boolean;
  /** 여러 경로 중 하나면 active (path보다 우선) */
  activePaths?: string[];
};

const LOCKED_TAB_CLASS =
  "opacity-40 cursor-not-allowed pointer-events-none";

type DomainTabsProps = {
  tabs: DomainTab[];
  pathname: string;
  onNavigate: (path: string) => void;
};

function isTabActive(tab: DomainTab, pathname: string): boolean {
  if (tab.activePaths?.length) {
    return tab.activePaths.some(
      (path) =>
        pathname === path ||
        pathname === `${path}/` ||
        pathname.startsWith(`${path}/`),
    );
  }
  if (tab.path == null) return false;
  if (tab.exact) {
    return pathname === tab.path || pathname === `${tab.path}/`;
  }
  return pathname === tab.path || pathname.startsWith(`${tab.path}/`);
}

export default function DomainTabs({
  tabs,
  pathname,
  onNavigate,
}: DomainTabsProps) {
  return (
    <div className="ds-tabs ds-tabs--flat" role="tablist">
      {tabs.map((tab) => {
        const active = !tab.locked && isTabActive(tab, pathname);
        return tab.locked ? (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected="false"
            disabled
            title="준비 중인 기능입니다"
            className={`ds-tab ${LOCKED_TAB_CLASS}`}
            aria-label={tab.badge ? `${tab.label} ${tab.badge}` : undefined}
          >
            <span>{tab.label}</span>
            {tab.badge != null && (
              <Badge
                tone="warning"
                size="xs"
                className="domain-tab__badge"
                title={tab.badgeTitle}
              >
                {tab.badge}
              </Badge>
            )}
          </button>
        ) : (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`ds-tab ${active ? "is-active" : ""}`}
            onClick={() => tab.path != null && onNavigate(tab.path)}
            aria-label={tab.badge ? `${tab.label} ${tab.badge}` : undefined}
          >
            <span>{tab.label}</span>
            {tab.badge != null && (
              <Badge
                tone="warning"
                size="xs"
                className="domain-tab__badge"
                title={tab.badgeTitle}
              >
                {tab.badge}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
