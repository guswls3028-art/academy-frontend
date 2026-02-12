// PATH: src/features/sessions/components/SessionTabs.tsx
import { Button } from "@/shared/ui/ds";

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
    <div className="mb-6 border-b border-[var(--color-border-divider)]">
      <div className="flex gap-2">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              type="button"
              intent={active ? "primary" : "ghost"}
              size="sm"
              onClick={() => onChange(tab.id)}
              className="-mb-px rounded-none border-b-2 px-4 py-2"
              style={{
                borderColor: active
                  ? "var(--color-primary)"
                  : "transparent",
              }}
            >
              {tab.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
