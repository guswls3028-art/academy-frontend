// PATH: src/app_teacher/domains/exams/pages/HomeworkDetailPage.tsx
// 과제 상세 — 제출 현황
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { fetchHomework, fetchHomeworkSubmissions } from "../api";

export default function HomeworkDetailPage() {
  const { homeworkId } = useParams<{ homeworkId: string }>();
  const navigate = useNavigate();
  const hid = Number(homeworkId);

  const { data: hw, isLoading: loadingHw } = useQuery({
    queryKey: ["teacher-homework", hid],
    queryFn: () => fetchHomework(hid),
    enabled: Number.isFinite(hid),
  });

  const { data: submissions, isLoading: loadingSub } = useQuery({
    queryKey: ["teacher-homework-submissions", hid],
    queryFn: () => fetchHomeworkSubmissions(hid),
    enabled: Number.isFinite(hid),
  });

  if (loadingHw || loadingSub)
    return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!hw)
    return <EmptyState scope="panel" tone="error" title="과제를 찾을 수 없습니다" />;

  const submitted = submissions?.filter((s: any) => s.submitted_at || s.status === "submitted") ?? [];
  const pending = submissions?.filter((s: any) => !s.submitted_at && s.status !== "submitted") ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold flex-1 truncate" style={{ color: "var(--tc-text)" }}>
          {hw.title}
        </h1>
      </div>

      {/* Info */}
      <div
        className="rounded-xl flex flex-col gap-2"
        style={{ padding: "var(--tc-space-4)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
      >
        {hw.session_title && (
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--tc-text-muted)" }}>수업</span>
            <span style={{ color: "var(--tc-text)" }}>{hw.session_title}</span>
          </div>
        )}
        {hw.due_date && (
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--tc-text-muted)" }}>마감일</span>
            <span style={{ color: "var(--tc-text)" }}>{hw.due_date}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--tc-text-muted)" }}>제출</span>
          <span style={{ color: "var(--tc-primary)" }}>
            {submitted.length} / {(submissions ?? []).length}
          </span>
        </div>
      </div>

      {/* Submitted */}
      {submitted.length > 0 && (
        <Section title={`제출 완료 (${submitted.length})`}>
          {submitted.map((s: any) => (
            <div key={s.id} className="flex justify-between items-center py-2 border-b last:border-b-0" style={{ borderColor: "var(--tc-border)" }}>
              <span className="text-sm" style={{ color: "var(--tc-text)" }}>
                {s.student_name ?? s.enrollment_name ?? "이름 없음"}
              </span>
              <span className="text-xs font-semibold" style={{ color: "var(--tc-success)" }}>
                {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString("ko-KR") : "제출"}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <Section title={`미제출 (${pending.length})`}>
          {pending.map((s: any) => (
            <div key={s.id} className="flex justify-between items-center py-2 border-b last:border-b-0" style={{ borderColor: "var(--tc-border)" }}>
              <span className="text-sm" style={{ color: "var(--tc-text)" }}>
                {s.student_name ?? s.enrollment_name ?? "이름 없음"}
              </span>
              <span className="text-xs font-semibold" style={{ color: "var(--tc-danger)" }}>미제출</span>
            </div>
          ))}
        </Section>
      )}

      {!submissions?.length && (
        <EmptyState scope="panel" tone="empty" title="제출 현황이 없습니다" />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl"
      style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}
    >
      <h3 className="text-sm font-bold mb-3" style={{ color: "var(--tc-text)" }}>{title}</h3>
      <div className="flex flex-col gap-0">{children}</div>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex p-1 cursor-pointer"
      style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
