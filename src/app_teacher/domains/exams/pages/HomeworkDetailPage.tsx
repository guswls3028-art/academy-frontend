// PATH: src/app_teacher/domains/exams/pages/HomeworkDetailPage.tsx
// 과제 상세 — 제출 현황
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { fetchHomework, fetchHomeworkSubmissions } from "../api";
import { teacherToast } from "@teacher/shared/ui/teacherToast";

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
        <PendingSection
          pending={pending}
          homeworkTitle={hw.title}
          dueDate={hw.due_date}
          onCopy={async (text) => {
            try {
              await navigator.clipboard.writeText(text);
              teacherToast.success(`미제출 ${pending.length}명 명단이 복사되었습니다.`);
            } catch {
              teacherToast.error("복사에 실패했습니다.");
            }
          }}
          onContactStudent={(s) => {
            const phone = s.student_phone ?? s.parent_phone;
            if (phone) {
              const cleaned = String(phone).replace(/[^0-9+]/g, "");
              const body = encodeURIComponent(`[${hw.title}] 과제 미제출 안내드립니다.${hw.due_date ? ` 마감일: ${hw.due_date}` : ""}`);
              window.location.href = `sms:${cleaned}?body=${body}`;
            } else if (s.student_id && Number(s.student_id) > 0) {
              navigate(`/teacher/students/${s.student_id}`);
            } else {
              teacherToast.error("연락처 정보가 없습니다.");
            }
          }}
        />
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

function PendingSection({
  pending,
  homeworkTitle,
  dueDate,
  onCopy,
  onContactStudent,
}: {
  pending: any[];
  homeworkTitle: string;
  dueDate?: string;
  onCopy: (text: string) => void;
  onContactStudent: (s: any) => void;
}) {
  const handleCopyAll = () => {
    const lines = pending.map((s: any) => {
      const name = s.student_name ?? s.enrollment_name ?? "이름 없음";
      const phone = s.student_phone ?? s.parent_phone ?? "";
      return phone ? `${name} (${phone})` : name;
    });
    const header = `[${homeworkTitle}] 미제출 ${pending.length}명${dueDate ? ` · 마감 ${dueDate}` : ""}`;
    onCopy([header, ...lines].join("\n"));
  };

  return (
    <div
      className="rounded-xl"
      style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>
          미제출 ({pending.length})
        </h3>
        <button
          type="button"
          onClick={handleCopyAll}
          className="text-[12px] font-semibold cursor-pointer"
          style={{
            padding: "6px 10px",
            borderRadius: "var(--tc-radius-sm)",
            border: "1px solid var(--tc-border-strong)",
            background: "var(--tc-surface-soft)",
            color: "var(--tc-text-secondary)",
            minHeight: "var(--tc-touch-min, 32px)",
          }}
        >
          명단 복사
        </button>
      </div>
      <div className="flex flex-col gap-0">
        {pending.map((s: any) => {
          const phone = s.student_phone ?? s.parent_phone;
          return (
            <div
              key={s.id}
              className="flex justify-between items-center py-2 border-b last:border-b-0"
              style={{ borderColor: "var(--tc-border)" }}
            >
              <span className="text-sm" style={{ color: "var(--tc-text)" }}>
                {s.student_name ?? s.enrollment_name ?? "이름 없음"}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: "var(--tc-danger)" }}>미제출</span>
                <button
                  type="button"
                  onClick={() => onContactStudent(s)}
                  className="text-[11px] font-semibold cursor-pointer"
                  style={{
                    padding: "4px 8px",
                    borderRadius: "var(--tc-radius-sm)",
                    border: `1px solid ${phone ? "var(--tc-primary)" : "var(--tc-border-strong)"}`,
                    background: phone ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                    color: phone ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                    minHeight: 28,
                  }}
                  title={phone ? "문자 보내기" : "학생 상세로 이동"}
                >
                  {phone ? "문자" : "상세"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
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
