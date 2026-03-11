// PATH: src/promo/components/SectionHeading.tsx

interface Props {
  badge?: string;
  title: string;
  subtitle?: string;
}

export default function SectionHeading({ badge, title, subtitle }: Props) {
  return (
    <div className="text-center mb-12">
      {badge && (
        <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full mb-4">
          {badge}
        </span>
      )}
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{title}</h2>
      {subtitle && <p className="text-gray-500 max-w-2xl mx-auto text-lg">{subtitle}</p>}
    </div>
  );
}
