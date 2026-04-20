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
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</div>
          {description && (
            <div className="stu-muted" style={{ marginTop: 4 }}>
              {description}
            </div>
          )}
        </div>
        {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
      </div>

      {/* 탭 바 — 프리미엄: 글자 하단 짧은 인디케이터 */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--stu-border)",
          marginBottom: "var(--stu-space-5)",
          marginTop: "var(--stu-space-2)",
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
                position: "relative",
                flex: "0 0 auto",
                padding: "10px 14px",
                background: "transparent",
                border: "none",
                fontWeight: isActive ? 700 : 500,
                fontSize: 14,
                color: isActive ? "var(--stu-primary)" : "var(--stu-text-muted)",
                cursor: "pointer",
                transition: "color var(--stu-motion-base)",
              }}
            >
              {tab.label}
              {isActive && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: -1,
                    transform: "translateX(-50%)",
                    width: "calc(100% - 20px)",
                    height: 2,
                    background: "var(--stu-primary)",
                    borderRadius: 2,
                  }}
                />
              )}
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
