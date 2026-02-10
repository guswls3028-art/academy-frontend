// PATH: src/shared/ui/ds/components/StatusBadge.tsx
export type Status = "active" | "inactive" | "archived";

const LABEL: Record<Status, string> = {
  active: "활성",
  inactive: "비활성",
  archived: "종료",
};

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className="ds-status-badge"
      data-status={status}
    >
      {LABEL[status]}
    </span>
  );
}
