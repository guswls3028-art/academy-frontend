// SSOT: 페이지 탭 → 플랫탭 (ds-tabs--flat + ds-tab)
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
    <div className="ds-tabs ds-tabs--flat border-b border-[var(--color-border-divider)]" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={activeTab === t.key}
          onClick={() => onChange(t.key)}
          className={`ds-tab ${activeTab === t.key ? "is-active" : ""}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
