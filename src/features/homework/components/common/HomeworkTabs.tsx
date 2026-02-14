// PATH: src/features/homework/components/common/HomeworkTabs.tsx
// SSOT: 페이지 탭 → 플랫탭 (ds-tabs--flat + ds-tab)
import type { HomeworkTabKey } from "../../types";

const TABS: { key: HomeworkTabKey; label: string }[] = [
  { key: "setup", label: "기본 설정" },
  { key: "assets", label: "자산" },
  { key: "submissions", label: "제출" },
  { key: "results", label: "결과 · 통계" },
];

export default function HomeworkTabs({
  activeTab,
  onChange,
}: {
  activeTab: HomeworkTabKey;
  onChange: (tab: HomeworkTabKey) => void;
}) {
  return (
    <div className="ds-tabs ds-tabs--flat border-b border-[var(--color-border-divider)]" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.key}
          onClick={() => onChange(tab.key)}
          className={`ds-tab ${activeTab === tab.key ? "is-active" : ""}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
