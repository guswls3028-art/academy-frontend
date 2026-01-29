// src/features/sessions/components/SessionTabs.tsx

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
    <div className="mb-6 border-b">
      <div className="flex gap-2">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={
                "border-b-2 px-4 py-2 text-sm " +
                (active
                  ? "border-blue-600 font-semibold text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800")
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
