// PATH: src/app_teacher/domains/lectures/pages/LectureListPage.tsx
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { fetchLectures } from "../api";

const COLORS: Record<string, string> = {
  blue: "#3b82f6", green: "#22c55e", red: "#ef4444", purple: "#8b5cf6",
  orange: "#f97316", yellow: "#eab308", pink: "#ec4899", cyan: "#06b6d4",
};

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
        <div className="flex flex-col gap-1.5">
          {lectures.map((l: any) => {
            const color = COLORS[l.color || ""] || "var(--tc-primary)";
            return (
              <button
                key={l.id}
                onClick={() => navigate(`/teacher/classes/${l.id}`)}
                className="flex items-center gap-3 rounded-lg w-full text-left cursor-pointer"
                style={{ padding: "var(--tc-space-3) var(--tc-space-4)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
              >
                <div className="w-2 h-10 rounded shrink-0" style={{ background: color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold" style={{ color: "var(--tc-text)" }}>{l.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--tc-text-muted)" }}>{l.subject}</div>
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
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--tc-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
