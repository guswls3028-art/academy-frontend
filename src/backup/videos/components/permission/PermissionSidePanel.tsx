// src/features/videos/components/permission/PermissionSidePanel.tsx

import { RULE_COLORS, RULE_LABELS } from "./permission.constants";

export default function PermissionSidePanel({
  selectedCount,
  onApply,
  onClear,
  pending,
}: {
  selectedCount: number;
  onApply: (rule: string) => void;
  onClear: () => void;
  pending: boolean;
}) {
  return (
    <div className="permission-right">
      <div className="permission-right-header">
        선택 목록 ({selectedCount})
      </div>

      <div className="permission-right-actions">
        {(["free", "once", "blocked"] as const).map((type) => (
          <button
            key={type}
            disabled={selectedCount === 0 || pending}
            onClick={() => onApply(type)}
            className={`h-12 w-full text-sm font-bold text-white rounded ${
              RULE_COLORS[type]
            } ${pending ? "opacity-70" : ""}`}
          >
            {RULE_LABELS[type]} ({selectedCount})
          </button>
        ))}

        <button
          disabled={selectedCount === 0}
          onClick={onClear}
          className="w-full h-10 border rounded bg-white text-sm"
        >
          선택 해제
        </button>
      </div>
    </div>
  );
}
