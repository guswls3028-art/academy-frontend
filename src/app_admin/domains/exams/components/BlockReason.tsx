// PATH: src/app_admin/domains/exams/components/BlockReason.tsx
export default function BlockReason({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-lg border p-4 text-sm"
      style={{
        borderColor: "color-mix(in srgb, var(--color-danger) 30%, var(--color-border-divider))",
        background: "color-mix(in srgb, var(--color-danger) 8%, var(--color-bg-surface))",
        color: "var(--color-danger)",
      }}
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-1" style={{ color: "var(--color-text-secondary)" }}>{description}</div>
    </div>
  );
}
