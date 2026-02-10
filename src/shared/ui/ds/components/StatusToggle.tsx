// PATH: src/shared/ui/ds/components/StatusToggle.tsx
import { Button } from "@/shared/ui/ds";

export default function StatusToggle({
  active,
  onToggle,
  disabled,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      intent={active ? "secondary" : "ghost"}
      size="sm"
      aria-pressed={active}
      disabled={disabled}
      onClick={onToggle}
    >
      {active ? "활성" : "비활성"}
    </Button>
  );
}
