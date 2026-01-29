// PATH: src/features/exams/components/BlockReason.tsx
export default function BlockReason({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded border border-red-600/30 bg-red-600/10 p-4 text-sm text-red-700">
      <div className="font-semibold">{title}</div>
      <div className="mt-1">{description}</div>
    </div>
  );
}
