export function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-lg font-semibold">{title}</h1>
      {actions}
    </div>
  );
}
