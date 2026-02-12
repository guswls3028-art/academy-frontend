// PATH: src/shared/ui/domain/DomainTabs.tsx
// Students 도메인 UI SSOT — ds-tabs 공통 컴포넌트

export type DomainTab = {
  key: string;
  label: string;
  path?: string;
  locked?: boolean;
  /** true면 path와 완전 일치할 때만 active */
  exact?: boolean;
};

const LOCKED_TAB_CLASS =
  "opacity-40 cursor-not-allowed pointer-events-none";

type DomainTabsProps = {
  tabs: DomainTab[];
  pathname: string;
  onNavigate: (path: string) => void;
};

export default function DomainTabs({
  tabs,
  pathname,
  onNavigate,
}: DomainTabsProps) {
  return (
    <div className="ds-tabs">
      {tabs.map((tab) =>
        tab.locked ? (
          <button
            key={tab.key}
            type="button"
            disabled
            title="준비 중인 기능입니다"
            className={`ds-tab ${LOCKED_TAB_CLASS}`}
          >
            {tab.label}
          </button>
        ) : (
          <button
            key={tab.key}
            type="button"
            className={`ds-tab ${
              tab.path != null &&
              (tab.exact
                ? pathname === tab.path || pathname === tab.path + "/"
                : pathname === tab.path ||
                  pathname.startsWith(tab.path + "/"))
                ? "is-active"
                : ""
            }`}
            onClick={() => tab.path != null && onNavigate(tab.path)}
          >
            {tab.label}
          </button>
        )
      )}
    </div>
  );
}
