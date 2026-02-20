// SSOT: 페이지 탭 → 플랫탭 (ds-tabs--flat + ds-tab)
import type { ExamTabKey } from "../../types";

type Props = {
  activeTab: ExamTabKey;
  onChange: (k: ExamTabKey) => void;
  hasSession: boolean;
  assetsReady: boolean;
  /** operate 모드: 운영/제출/채점·결과만 노출, 자산 숨김 */
  mode?: "design" | "operate";
};

const TABS_DESIGN: { key: ExamTabKey; label: string }[] = [
  { key: "setup", label: "기본 설정" },
  { key: "assets", label: "자산" },
  { key: "submissions", label: "제출" },
  { key: "results", label: "결과" },
];

const TABS_OPERATE: { key: ExamTabKey; label: string }[] = [
  { key: "setup", label: "운영" },
  { key: "submissions", label: "제출" },
  { key: "results", label: "채점·결과" },
];

export default function ExamTabs({ activeTab, onChange, mode = "design" }: Props) {
  const tabs = mode === "operate" ? TABS_OPERATE : TABS_DESIGN;
  const effectiveTab = mode === "operate" && activeTab === "assets" ? "setup" : activeTab;
  return (
    <div className="ds-tabs ds-tabs--flat border-b border-[var(--color-border-divider)]" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={effectiveTab === t.key}
          onClick={() => onChange(t.key)}
          className={`ds-tab ${effectiveTab === t.key ? "is-active" : ""}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
