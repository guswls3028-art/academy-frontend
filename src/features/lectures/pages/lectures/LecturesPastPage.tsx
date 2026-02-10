// PATH: src/features/lectures/pages/lectures/LecturesPastPage.tsx
import { EmptyState } from "@/shared/ui/ds";

export default function LecturesPastPage() {
  return (
    <>
      {/* CARD HEADER */}
      <div className="px-5 py-4 border-b border-[var(--border-divider)]">
        <div className="text-base font-semibold">지난 강의</div>
      </div>

      {/* CARD BODY */}
      <div className="p-4">
        <EmptyState
          scope="panel"
          title="지난 강의가 없습니다."
          description="종료된 강의가 이곳에 표시됩니다."
        />
      </div>
    </>
  );
}
