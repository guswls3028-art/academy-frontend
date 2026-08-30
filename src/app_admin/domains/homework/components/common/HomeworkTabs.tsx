// PATH: src/app_admin/domains/homework/components/common/HomeworkTabs.tsx
// SSOT: 페이지 탭 → 플랫탭 (ds-tabs--flat + ds-tab) — 시험 ExamTabs와 동일 구조
import type { HomeworkTabKey } from "../../types";
import "@/shared/ui/assessment/AssessmentWorkflowTabs.css";

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
    <nav
      className="assessment-workflow-tabs"
      aria-label={mode === "operate" ? "과제 업무 흐름" : "과제 구성 단계"}
    >
      <span className="assessment-workflow-tabs__label">
        {mode === "operate" ? "업무 흐름" : "구성 단계"}
      </span>
      <div className="domain-header__tabs-wrap assessment-workflow-tabs__control">
        <div className="ds-tabs ds-tabs--flat" role="tablist">
          {tabs.map((tab, index) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={effectiveTab === tab.key}
              onClick={() => onChange(tab.key)}
              className={`ds-tab ${effectiveTab === tab.key ? "is-active" : ""}`}
            >
              <span className="assessment-workflow-tabs__step" aria-hidden>{index + 1}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
