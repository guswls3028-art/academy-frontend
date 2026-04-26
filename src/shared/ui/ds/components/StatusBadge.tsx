// PATH: src/shared/ui/ds/components/StatusBadge.tsx
import Badge from "./Badge";

export type Status = "active" | "inactive" | "archived";

const LABEL: Record<Status, string> = {
  active: "활성",
  inactive: "비활성",
  archived: "종료",
};

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="solid" status={status} title={LABEL[status]}>
      {LABEL[status]}
    </Badge>
  );
}
