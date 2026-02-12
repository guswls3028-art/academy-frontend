import { Button } from "@/shared/ui/ds";
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
          <Button
            key={t.key}
            type="button"
            intent={isActive ? "primary" : "ghost"}
            size="sm"
            onClick={() => onChange(t.key)}
            className="-mb-px rounded-none border-b-2 border-transparent pb-2"
            style={isActive ? { borderColor: "var(--color-primary)" } : undefined}
          >
            {t.label}
          </Button>
        );
      })}
    </div>
  );
}
