// PATH: src/shared/ui/layout/EmptyState.tsx
// --------------------------------------------------
// EmptyState
// - 테이블 / 리스트 / 패널의 빈 상태 공용 UI
// --------------------------------------------------

export default function EmptyState({
  message = "데이터가 없습니다.",
  size = "md",
}: {
  message?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={`flex items-center justify-center text-[var(--text-secondary)] ${
        size === "sm" ? "text-xs py-2" : "text-sm py-6"
      }`}
    >
      {message}
    </div>
  );
}
