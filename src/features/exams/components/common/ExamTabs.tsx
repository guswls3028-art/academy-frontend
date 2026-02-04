import type { ExamTabKey } from "../../types";

type Props = {
  activeTab: ExamTabKey;
  onChange: (k: ExamTabKey) => void;
  hasSession: boolean;
  assetsReady: boolean;
};

const TABS: { key: ExamTabKey; label: string }[] = [
  { key: "setup", label: "기본 설정" },
  { key: "assets", label: "자산" },
  { key: "submissions", label: "제출" },
  { key: "results", label: "결과" },
];

export default function ExamTabs({ activeTab, onChange }: Props) {
  return (
    <div className="flex gap-6 border-b border-[var(--border-divider)]">
      {TABS.map((t) => {
        const isActive = activeTab === t.key;

        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={[
              "pb-2 text-sm border-b-2 transition-colors",
              isActive
                ? "border-[var(--color-primary)] font-semibold text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
