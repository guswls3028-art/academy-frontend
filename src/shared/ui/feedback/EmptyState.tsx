// src/shared/ui/feedback/EmptyState.tsx

interface EmptyStateProps {
  title?: string;
  message: string;
  size?: "sm" | "md";
}

export default function EmptyState({
  title,
  message,
  size = "md",
}: EmptyStateProps) {
  return (
    <div
      className={[
        "rounded-lg border border-dashed",
        "border-[var(--border-divider)]",
        "bg-[var(--bg-surface-soft)]",
        size === "sm" ? "px-3 py-2 text-sm" : "px-4 py-3 text-sm",
        "text-[var(--text-secondary)]",
      ].join(" ")}
    >
      {title && (
        <div className="mb-1 font-semibold text-[var(--text-primary)]">
          {title}
        </div>
      )}
      <div>{message}</div>
    </div>
  );
}
