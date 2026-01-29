// PATH: src/features/submissions/components/ManualReviewBadge.tsx
export default function ManualReviewBadge({
  required,
  reasons,
}: {
  required: boolean;
  reasons?: string[];
}) {
  if (!required) {
    return (
      <span className="inline-flex items-center rounded-full border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-400">
        자동 처리
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-yellow-800 bg-yellow-950 px-2 py-1 text-xs text-yellow-200"
      title={(reasons ?? []).join(", ")}
    >
      ⚠️ 수동 검토 필요{reasons?.length ? ` (${reasons.length})` : ""}
    </span>
  );
}
