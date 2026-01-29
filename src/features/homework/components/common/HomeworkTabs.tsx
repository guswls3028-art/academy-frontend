// PATH: src/features/homework/components/common/HomeworkTabs.tsx
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
    <div className="flex gap-6 border-b border-[var(--border-divider)]">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={[
              "pb-2 text-sm border-b-2 transition-colors",
              isActive
                ? "border-[var(--color-primary)] font-semibold text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
