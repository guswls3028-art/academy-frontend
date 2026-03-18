// PATH: src/promo/components/SectionHeading.tsx

interface Props {
  badge?: string;
  title: string;
  subtitle?: string;
}

export default function SectionHeading({ badge, title, subtitle }: Props) {
  return (
    <div className="text-center mb-14">
      {badge && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100/60 rounded-full mb-5">
          <span className="text-xs font-semibold text-blue-600 tracking-wide">{badge}</span>
        </div>
      )}
      <h2 className="text-2xl sm:text-3xl lg:text-[2.125rem] font-bold text-gray-900 mb-4 leading-snug tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-gray-500 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}
