// PATH: src/app_teacher/domains/lectures/pages/LectureListPage.tsx
// 강의 목록 — 딱지 + 강사 + 시간 + 기간
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { fetchLectures } from "../api";

export default function LectureListPage() {
  const navigate = useNavigate();
  const { data: lectures, isLoading } = useQuery({
    queryKey: ["lectures-mobile"],
    queryFn: fetchLectures,
  });

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-bold py-1" style={{ color: "var(--tc-text)" }}>강의 목록</h2>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : lectures && lectures.length > 0 ? (
        <div className="flex flex-col gap-2">
          {lectures.map((l: any) => {
            const chipLabel = l.chip_label ?? l.chipLabel;
            const instructor = l.name ?? l.instructor;
            const time = l.lecture_time ?? l.lectureTime;
            const dateRange = l.start_date && l.end_date
              ? `${l.start_date} ~ ${l.end_date}`
              : l.start_date;

            return (
              <button
                key={l.id}
                onClick={() => navigate(`/teacher/classes/${l.id}`)}
                className="flex gap-3 rounded-xl w-full text-left cursor-pointer"
                style={{
                  padding: "var(--tc-space-3) var(--tc-space-4)",
                  background: "var(--tc-surface)",
                  border: "1px solid var(--tc-border)",
                }}
              >
                {/* Lecture chip (large) */}
                <LectureChip
                  lectureName={l.title}
                  color={l.color}
                  chipLabel={chipLabel}
                  size={40}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold truncate" style={{ color: "var(--tc-text)" }}>
                    {l.title}
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                    {l.subject}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                    {instructor && <span>{instructor}</span>}
                    {time && <span>{time}</span>}
                    {dateRange && <span>{dateRange}</span>}
                  </div>
                </div>

                <ChevronRight />
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="활성 강의가 없습니다" />
      )}
    </div>
  );
}

function ChevronRight() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--tc-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 self-center">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
