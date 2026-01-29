// PATH: src/features/exams/components/assets/AssetBlockNotice.tsx
export default function AssetBlockNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded border border-yellow-600/30 bg-yellow-600/10 p-4 text-sm text-yellow-800">
      <div className="font-semibold">{title}</div>
      <div className="mt-1">{description}</div>
    </div>
  );
}
