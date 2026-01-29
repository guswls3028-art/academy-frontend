// PATH: src/features/profile/components/MemoCell.tsx
import { useMemo, useState } from "react";

export default function MemoCell({ value, max = 20 }: { value?: string | null; max?: number }) {
  const [open, setOpen] = useState(false);

  const v = useMemo(() => (value ?? "").trim(), [value]);
  if (!v) return <span className="text-[var(--text-muted)]">-</span>;

  const isLong = v.length > max;
  const short = isLong ? v.slice(0, max) + "…" : v;

  return (
    <span
      className="relative inline-flex max-w-[420px] cursor-default items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      title={!isLong ? v : undefined}
    >
      <span className={isLong ? "cursor-help underline decoration-dotted underline-offset-4" : ""}>
        {short}
      </span>

      {open && isLong && (
        <span
          className="
            absolute left-0 top-full z-50 mt-2
            w-max max-w-[520px]
            whitespace-pre-wrap break-words
            rounded-md border border-[var(--border-divider)]
            bg-[var(--bg-surface)]
            px-3 py-2 text-xs
            text-[var(--text-primary)]
            shadow-lg
          "
        >
          {v}
        </span>
      )}
    </span>
  );
}
