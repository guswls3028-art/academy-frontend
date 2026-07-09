/**
 * DomainTabShell — 도메인 페이지 공통 쉘 (홈 | 통계 탭 구조)
 * 시험, 성적, 영상, 저장소 4개 도메인에서 통일된 탭 UI 제공.
 * state 기반 탭 전환 + ?tab= searchParam 동기화.
 */
import { type ReactNode, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { InlineHelp } from "@/shared/ui/guide";

export type DomainTab = {
  key: string;
  label: string;
};

type DomainTabShellProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  descriptionMode?: "help" | "visible";
  help?: ReactNode;
  helpTitle?: ReactNode;
  icon?: ReactNode;
  variant?: "default" | "plain";
  tabs: DomainTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  actions?: ReactNode;
  children: ReactNode;
  /** true면 ?tab= searchParam 동기화 비활성화 */
  noSearchParam?: boolean;
};

export default function DomainTabShell({
  title,
  eyebrow,
  description,
  descriptionMode = "help",
  help,
  helpTitle,
  icon,
  variant = "default",
  tabs,
  activeTab,
  onTabChange,
  actions,
  children,
  noSearchParam,
}: DomainTabShellProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabLabel = tabs.find((tab) => tab.key === activeTab)?.label ?? tabs[0]?.label ?? "";
  const fallbackInitial = title.trim().slice(0, 1) || "?";
  const showMark = variant !== "plain" || icon != null;
  const helpContent = help ?? (descriptionMode === "help" ? description : null);
  const showVisibleDescription = Boolean(description && descriptionMode === "visible");

  // ?tab= searchParam → 초기 탭 동기화
  useEffect(() => {
    if (noSearchParam) return;
    const paramTab = searchParams.get("tab");
    if (paramTab && tabs.some((t) => t.key === paramTab) && paramTab !== activeTab) {
      onTabChange(paramTab);
    }
    // 마운트 시 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 탭 변경 → searchParam 업데이트
  const handleTabChange = (key: string) => {
    onTabChange(key);
    if (!noSearchParam) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (key === tabs[0]?.key) {
            next.delete("tab");
          } else {
            next.set("tab", key);
          }
          return next;
        },
        { replace: true },
      );
    }
  };

  return (
    <div className={`domain-tab-shell domain-tab-shell--${variant}`}>
      <header className="domain-tab-shell__header">
        {showMark && (
          <div className="domain-tab-shell__mark" aria-hidden="true">
            {icon ?? <span className="domain-tab-shell__initial">{fallbackInitial}</span>}
          </div>
        )}

        <div className="domain-tab-shell__copy">
          {eyebrow && <div className="domain-tab-shell__eyebrow">{eyebrow}</div>}
          <div className="domain-tab-shell__title-line">
            <h1 className="domain-tab-shell__title">{title}</h1>
            {helpContent && (
              <InlineHelp
                title={helpTitle ?? `${title} 안내`}
                tone="student"
                align="left"
                ariaLabel={`${title} 도움말`}
                className="domain-tab-shell__help"
              >
                {typeof helpContent === "string" ? <p>{helpContent}</p> : helpContent}
              </InlineHelp>
            )}
          </div>
          {showVisibleDescription && <p className="domain-tab-shell__description">{description}</p>}
        </div>

        {actions && <div className="domain-tab-shell__actions">{actions}</div>}
      </header>

      <div
        role="tablist"
        className="domain-tab-shell__tabs"
        aria-label={`${title} 보기 전환`}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabChange(tab.key)}
              className={`domain-tab-shell__tab${isActive ? " domain-tab-shell__tab--active" : ""}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="domain-tab-shell__content" role="tabpanel" aria-label={activeTabLabel}>
        {children}
      </div>
    </div>
  );
}
