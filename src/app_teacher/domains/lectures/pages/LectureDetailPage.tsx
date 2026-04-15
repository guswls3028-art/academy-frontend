// PATH: src/app_teacher/domains/lectures/pages/LectureDetailPage.tsx
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { fetchLecture, fetchLectureSessions } from "../api";

export default function LectureDetailPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const navigate = useNavigate();
  const lid = Number(lectureId);

  const { data: lecture, isLoading } = useQuery({
    queryKey: ["lecture", lid],
    queryFn: () => fetchLecture(lid),
    enabled: Number.isFinite(lid),
  });

  const { data: sessions, isLoading: sessLoading } = useQuery({
    queryKey: ["lecture-sessions", lid],
    queryFn: () => fetchLectureSessions(lid),
    enabled: Number.isFinite(lid),
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>
          {lecture?.title || "강의 상세"}
        </h1>
      </div>

      {lecture && (
        <div className="rounded-xl" style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}>
          <div className="text-[13px]" style={{ color: "var(--tc-text-secondary)" }}>
            {[lecture.subject, lecture.start_date && `${lecture.start_date} ~ ${lecture.end_date}`].filter(Boolean).join(" · ")}
          </div>
        </div>
      )}

      <h3 className="text-sm font-bold py-1" style={{ color: "var(--tc-text)" }}>세션 목록</h3>

      {sessLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : sessions && sessions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {sessions.map((s: any) => (
            <button
              key={s.id}
              onClick={() => navigate(`/teacher/classes/${lectureId}/sessions/${s.id}`)}
              className="flex justify-between items-center rounded-lg w-full text-left cursor-pointer"
              style={{ padding: "var(--tc-space-3) var(--tc-space-4)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
            >
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{s.title || `${s.order}차시`}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                  {s.date || "날짜 미정"}{s.section_label ? ` · ${s.section_label}` : ""}
                </div>
              </div>
              <ChevronRight />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="세션이 없습니다" />
      )}
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}

function ChevronRight() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--tc-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
