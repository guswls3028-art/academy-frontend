// PATH: src/features/sessions/components/SessionTabs.tsx
// SSOT: 페이지 탭 → 플랫탭 (ds-tabs--flat + ds-tab)

type SessionTab =
  | "attendance"
  | "scores"
  | "exams"
  | "assignments"
  | "videos"
  | "materials";

const TABS: { id: SessionTab; label: string }[] = [
  { id: "attendance", label: "출결" },
  { id: "scores", label: "성적" },
  { id: "exams", label: "시험" },
  { id: "assignments", label: "과제" },
  { id: "videos", label: "영상" },
  { id: "materials", label: "자료" },
];

export default function SessionTabs({
  activeTab,
  onChange,
}: {
  activeTab: SessionTab;
  onChange: (tab: SessionTab) => void;
}) {
  return (
    <div className="ds-tabs ds-tabs--flat mb-6 border-b border-[var(--color-border-divider)]" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={`ds-tab ${activeTab === tab.id ? "is-active" : ""}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
