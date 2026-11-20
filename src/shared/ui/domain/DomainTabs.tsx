// PATH: src/shared/ui/domain/DomainTabs.tsx
// Students 도메인 UI SSOT — ds-tabs 공통 컴포넌트

import { useEffect, useRef } from "react";
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

function matchesPath(pathname: string, destination: string, exact = false): boolean {
  // Query parameters carry the destination's context; the route identifies this tab.
  const path = destination.split(/[?#]/, 1)[0].replace(/\/$/, "");
  const current = pathname.replace(/\/$/, "");
  return current === path || (!exact && current.startsWith(`${path}/`));
}

function isTabActive(tab: DomainTab, pathname: string): boolean {
  if (tab.activePaths?.length) {
    return tab.activePaths.some(
      (path) => matchesPath(pathname, path),
    );
  }
  if (tab.path == null) return false;
  if (tab.exact) {
    return matchesPath(pathname, tab.path, true);
  }
  return matchesPath(pathname, tab.path);
}

export default function DomainTabs({
  tabs,
  pathname,
  onNavigate,
}: DomainTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    const viewport = list?.closest<HTMLElement>(".domain-header__tabs-wrap");
    if (!selected || !viewport) return;
    const item = selected.getBoundingClientRect();
    const frame = viewport.getBoundingClientRect();
    if (item.left < frame.left) viewport.scrollLeft += item.left - frame.left;
    else if (item.right > frame.right) viewport.scrollLeft += item.right - frame.right;
  }, [pathname]);
  return (
    <div ref={listRef} className="ds-tabs ds-tabs--flat" role="tablist">
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
