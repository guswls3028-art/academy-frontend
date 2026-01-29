// PATH: src/features/scores/components/PassFailBadge.tsx
/**
 * PASS/FAIL 표시 전용
 */

export default function PassFailBadge({ passed }: { passed: boolean | null }) {
  if (passed == null) {
    return (
      <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface-soft)] px-2 py-1 text-[11px] text-[var(--text-muted)]">
        -
      </span>
    );
  }

  return passed ? (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
      PASS
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
      FAIL
    </span>
  );
}
