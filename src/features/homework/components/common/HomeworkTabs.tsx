// PATH: src/features/homework/components/common/HomeworkTabs.tsx
// SSOT: 페이지 탭 → 플랫탭 (ds-tabs--flat + ds-tab) — 시험 ExamTabs와 동일 구조
import type { HomeworkTabKey } from "../../types";

const TABS_DESIGN: { key: HomeworkTabKey; label: string }[] = [
  { key: "setup", label: "기본 설정" },
  { key: "assets", label: "자산" },
  { key: "submissions", label: "제출관리" },
  { key: "results", label: "결과" },
];

const TABS_OPERATE: { key: HomeworkTabKey; label: string }[] = [
  { key: "setup", label: "운영" },
  { key: "submissions", label: "제출관리" },
  { key: "results", label: "결과" },
];

type Props = {
  activeTab: HomeworkTabKey;
  onChange: (tab: HomeworkTabKey) => void;
  /** 세션 컨텍스트(강의>세션>과제)에서는 operate로 2탭(운영|결과) 표시 */
  mode?: "design" | "operate";
};

export default function HomeworkTabs({ activeTab, onChange, mode = "design" }: Props) {
  const tabs = mode === "operate" ? TABS_OPERATE : TABS_DESIGN;
  const effectiveTab =
    mode === "operate" && activeTab === "assets"
      ? "setup"
      : activeTab;

  return (
    <div className="ds-tabs ds-tabs--flat" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={effectiveTab === tab.key}
          onClick={() => onChange(tab.key)}
          className={`ds-tab ${effectiveTab === tab.key ? "is-active" : ""}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
