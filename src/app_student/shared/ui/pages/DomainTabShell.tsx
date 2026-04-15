/**
 * DomainTabShell — 도메인 페이지 공통 쉘 (홈 | 통계 탭 구조)
 * 시험, 성적, 영상, 저장소 4개 도메인에서 통일된 탭 UI 제공.
 * state 기반 탭 전환 + ?tab= searchParam 동기화.
 */
import { type ReactNode, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export type DomainTab = {
  key: string;
  label: string;
};

type DomainTabShellProps = {
  title: string;
  description?: string;
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
  description,
  tabs,
  activeTab,
  onTabChange,
  actions,
  children,
  noSearchParam,
}: DomainTabShellProps) {
  const [searchParams, setSearchParams] = useSearchParams();

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
    <div>
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 4,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{title}</div>
          {description && (
            <div className="stu-muted" style={{ marginTop: 4 }}>
              {description}
            </div>
          )}
        </div>
        {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
      </div>

      {/* 탭 바 */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "2px solid var(--stu-border)",
          marginBottom: "var(--stu-space-6)",
        }}
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
              style={{
                flex: 1,
                padding: "var(--stu-space-4) var(--stu-space-4)",
                background: "transparent",
                border: "none",
                borderBottom: isActive
                  ? "2px solid var(--stu-primary)"
                  : "2px solid transparent",
                marginBottom: -2,
                fontWeight: isActive ? 700 : 500,
                fontSize: 14,
                color: isActive ? "var(--stu-primary)" : "var(--stu-text-muted)",
                cursor: "pointer",
                transition:
                  "color var(--stu-motion-base), border-color var(--stu-motion-base)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 콘텐츠 */}
      <div className="stu-section" role="tabpanel">
        {children}
      </div>
    </div>
  );
}
