// SSOT: 페이지 탭 → 플랫탭 (ds-tabs--flat + ds-tab)
import type { ExamTabKey } from "../../types";
import "@/shared/ui/assessment/AssessmentWorkflowTabs.css";

type Props = {
  activeTab: ExamTabKey;
  onChange: (k: ExamTabKey) => void;
  hasSession: boolean;
  assetsReady: boolean;
  /** operate 모드: 운영/제출관리/채점·결과만 노출, 자산 숨김 */
  mode?: "design" | "operate";
};

const TABS_DESIGN: { key: ExamTabKey; label: string }[] = [
  { key: "setup", label: "기본 설정" },
  { key: "assets", label: "자산" },
  { key: "submissions", label: "제출관리" },
  { key: "results", label: "결과" },
];

const TABS_OPERATE: { key: ExamTabKey; label: string }[] = [
  { key: "setup", label: "운영" },
  { key: "submissions", label: "제출관리" },
  { key: "results", label: "채점·결과" },
];

export default function ExamTabs({ activeTab, onChange, mode = "design" }: Props) {
  const tabs = mode === "operate" ? TABS_OPERATE : TABS_DESIGN;
  const effectiveTab = mode === "operate" && activeTab === "assets" ? "setup" : activeTab;
  return (
    <nav
      className="assessment-workflow-tabs"
      aria-label={mode === "operate" ? "시험 업무 흐름" : "시험 구성 단계"}
    >
      <span className="assessment-workflow-tabs__label">
        {mode === "operate" ? "업무 흐름" : "구성 단계"}
      </span>
      <div className="domain-header__tabs-wrap assessment-workflow-tabs__control">
        <div className="ds-tabs ds-tabs--flat" role="tablist">
          {tabs.map((t, index) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={effectiveTab === t.key}
              onClick={() => onChange(t.key)}
              className={`ds-tab ${effectiveTab === t.key ? "is-active" : ""}`}
            >
              <span className="assessment-workflow-tabs__step" aria-hidden>{index + 1}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
