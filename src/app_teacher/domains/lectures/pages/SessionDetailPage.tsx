// PATH: src/app_teacher/domains/lectures/pages/SessionDetailPage.tsx
// 차시 상세 — 탭 구조: 학생 + 출석 + 성적 + 영상
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { fetchSession, fetchSessionAttendance } from "../api";
import { fetchSessionExams, fetchExamResults } from "@teacher/domains/scores/api";
import { fetchVideos } from "@teacher/domains/videos/api";

type Tab = "students" | "attendance" | "scores" | "videos";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PRESENT: { label: "출석", color: "var(--tc-success)" },
  ONLINE: { label: "영상", color: "var(--tc-primary)" },
  SUPPLEMENT: { label: "보강", color: "var(--tc-info)" },
  LATE: { label: "지각", color: "var(--tc-warn)" },
  EARLY_LEAVE: { label: "조퇴", color: "var(--tc-warn)" },
  ABSENT: { label: "결석", color: "var(--tc-danger)" },
  RUNAWAY: { label: "출튀", color: "var(--tc-danger)" },
  MATERIAL: { label: "자료", color: "var(--tc-text-muted)" },
  INACTIVE: { label: "부재", color: "var(--tc-text-muted)" },
  SECESSION: { label: "퇴원", color: "var(--tc-text-muted)" },
};

export default function SessionDetailPage() {
  const { sessionId, lectureId } = useParams<{ sessionId: string; lectureId: string }>();
  const navigate = useNavigate();
  const sid = Number(sessionId);
  const [tab, setTab] = useState<Tab>("students");

  const { data: session, isLoading } = useQuery({
    queryKey: ["session-detail", sid],
    queryFn: () => fetchSession(sid),
    enabled: Number.isFinite(sid),
  });

  const { data: attendances } = useQuery({
    queryKey: ["session-attendance", sid],
    queryFn: () => fetchSessionAttendance(sid),
    enabled: Number.isFinite(sid),
  });

  const { data: exams } = useQuery({
    queryKey: ["session-exams-detail", sid],
    queryFn: () => fetchSessionExams(sid),
    enabled: Number.isFinite(sid) && tab === "scores",
  });

  const { data: videos } = useQuery({
    queryKey: ["session-videos", sid],
    queryFn: () => fetchVideos({ session: sid }),
    enabled: Number.isFinite(sid) && tab === "videos",
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;

  const title = session?.title || `${session?.order ?? ""}차시`;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold flex-1 truncate" style={{ color: "var(--tc-text)" }}>
          {title}
        </h1>
      </div>

      {/* Session info */}
      {session && (
        <div
          className="rounded-xl flex items-center gap-3"
          style={{ padding: "var(--tc-space-3) var(--tc-space-4)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
        >
          {session.lecture_color && (
            <LectureChip
              lectureName={session.lecture_title ?? ""}
              color={session.lecture_color}
              chipLabel={session.lecture_chip_label}
              size={28}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>
              {session.lecture_title}
            </div>
            <div className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>
              {session.date || "날짜 미정"}
              {session.section_label ? ` · ${session.section_label}` : ""}
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <ActionBtn
          label="출석 체크"
          color="var(--tc-success)"
          onClick={() => navigate(`/teacher/attendance/${sessionId}`)}
        />
        <ActionBtn
          label="성적 입력"
          color="var(--tc-primary)"
          onClick={() => navigate(`/teacher/scores/${sessionId}`)}
        />
      </div>

      {/* Tabs */}
      <div
        className="flex rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--tc-border)", background: "var(--tc-surface-soft)" }}
      >
        {([
          { key: "students" as Tab, label: `학생 (${attendances?.length ?? "…"})` },
          { key: "attendance" as Tab, label: "출석" },
          { key: "scores" as Tab, label: "성적" },
          { key: "videos" as Tab, label: "영상" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 text-[12px] font-semibold py-2 cursor-pointer"
            style={{
              border: "none",
              background: tab === t.key ? "var(--tc-primary)" : "transparent",
              color: tab === t.key ? "#fff" : "var(--tc-text-secondary)",
              transition: "all var(--tc-motion-fast)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "students" && <StudentsTab attendances={attendances ?? []} navigate={navigate} />}
      {tab === "attendance" && <AttendanceTab attendances={attendances ?? []} />}
      {tab === "scores" && <ScoresTab exams={exams ?? []} sessionId={sid} />}
      {tab === "videos" && <VideosTab videos={videos ?? []} navigate={navigate} />}
    </div>
  );
}

/* === Students tab === */
function StudentsTab({ attendances, navigate }: { attendances: any[]; navigate: any }) {
  if (!attendances.length) return <EmptyState scope="panel" tone="empty" title="수강생이 없습니다" />;

  return (
    <div className="flex flex-col gap-1.5">
      {attendances.map((a: any) => {
        const name = a.student_name ?? a.name ?? "이름 없음";
        const parentPhone = a.parent_phone ?? a.parentPhone;
        const studentPhone = a.student_phone ?? a.studentPhone ?? a.phone;
        const st = STATUS_LABELS[a.status] ?? { label: a.status, color: "var(--tc-text-muted)" };

        return (
          <button
            key={a.id}
            onClick={() => a.student_id && navigate(`/teacher/students/${a.student_id}`)}
            className="flex items-center gap-3 rounded-xl w-full text-left cursor-pointer"
            style={{
              padding: "var(--tc-space-3) var(--tc-space-4)",
              background: "var(--tc-surface)",
              border: "1px solid var(--tc-border)",
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}
            >
              {name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{name}</div>
              <div className="flex gap-3 text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                {parentPhone && <span>부 {formatPhone(parentPhone)}</span>}
                {studentPhone && <span>학 {formatPhone(studentPhone)}</span>}
              </div>
            </div>
            <StatusBadge label={st.label} color={st.color} />
          </button>
        );
      })}
    </div>
  );
}

/* === Attendance tab === */
function AttendanceTab({ attendances }: { attendances: any[] }) {
  if (!attendances.length) return <EmptyState scope="panel" tone="empty" title="출석 데이터가 없습니다" />;

  const counts = attendances.reduce<Record<string, number>>((acc, a) => {
    const s = a.status ?? "UNKNOWN";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-3">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(counts).map(([status, count]) => {
          const st = STATUS_LABELS[status] ?? { label: status, color: "var(--tc-text-muted)" };
          return (
            <div
              key={status}
              className="rounded-lg flex flex-col items-center py-2"
              style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
            >
              <span className="text-lg font-bold" style={{ color: st.color }}>{count}</span>
              <span className="text-[10px]" style={{ color: "var(--tc-text-muted)" }}>{st.label}</span>
            </div>
          );
        })}
      </div>

      {/* Detail list */}
      <div className="flex flex-col gap-1">
        {attendances.map((a: any) => {
          const name = a.student_name ?? a.name ?? "이름 없음";
          const st = STATUS_LABELS[a.status] ?? { label: a.status, color: "var(--tc-text-muted)" };
          return (
            <div
              key={a.id}
              className="flex justify-between items-center py-2 border-b last:border-b-0"
              style={{ borderColor: "var(--tc-border)" }}
            >
              <span className="text-sm" style={{ color: "var(--tc-text)" }}>{name}</span>
              <StatusBadge label={st.label} color={st.color} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* === Scores tab === */
function ScoresTab({ exams, sessionId }: { exams: any[]; sessionId: number }) {
  const [selectedExam, setSelectedExam] = useState<number | null>(null);

  const { data: results } = useQuery({
    queryKey: ["exam-results-session", selectedExam],
    queryFn: () => fetchExamResults(selectedExam!),
    enabled: selectedExam != null,
  });

  if (!exams.length) return <EmptyState scope="panel" tone="empty" title="이 차시에 시험이 없습니다" />;

  return (
    <div className="flex flex-col gap-3">
      {/* Exam selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {exams.map((e: any) => (
          <button
            key={e.id}
            onClick={() => setSelectedExam(e.id)}
            className="shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-full cursor-pointer"
            style={{
              border: selectedExam === e.id ? "2px solid var(--tc-primary)" : "1px solid var(--tc-border)",
              background: selectedExam === e.id ? "var(--tc-primary-bg)" : "var(--tc-surface)",
              color: selectedExam === e.id ? "var(--tc-primary)" : "var(--tc-text-secondary)",
            }}
          >
            {e.title} ({e.max_score ?? 100}점)
          </button>
        ))}
      </div>

      {/* Results */}
      {selectedExam == null ? (
        <div className="text-sm text-center py-4" style={{ color: "var(--tc-text-muted)" }}>
          시험을 선택하세요
        </div>
      ) : results ? (
        results.length > 0 ? (
          <div className="flex flex-col gap-1">
            {results.map((r: any) => {
              const name = r.student_name ?? r.enrollment_name ?? "이름 없음";
              return (
                <div
                  key={r.id}
                  className="flex justify-between items-center py-2 border-b last:border-b-0"
                  style={{ borderColor: "var(--tc-border)" }}
                >
                  <span className="text-sm" style={{ color: "var(--tc-text)" }}>{name}</span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: r.score != null ? "var(--tc-text)" : "var(--tc-text-muted)" }}
                  >
                    {r.score != null ? `${r.score}점` : "미채점"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState scope="panel" tone="empty" title="결과가 없습니다" />
        )
      ) : (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      )}
    </div>
  );
}

/* === Videos tab === */
function VideosTab({ videos, navigate }: { videos: any[]; navigate: any }) {
  if (!videos.length) return <EmptyState scope="panel" tone="empty" title="이 차시에 영상이 없습니다" />;

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    completed: { label: "완료", color: "var(--tc-success)" },
    processing: { label: "인코딩 중", color: "var(--tc-warn)" },
    pending: { label: "대기", color: "var(--tc-text-muted)" },
    failed: { label: "실패", color: "var(--tc-danger)" },
  };

  return (
    <div className="flex flex-col gap-1.5">
      {videos.map((v: any) => {
        const st = STATUS_MAP[v.status ?? "pending"] ?? STATUS_MAP.pending;
        return (
          <button
            key={v.id}
            onClick={() => v.status === "completed" && navigate(`/teacher/videos/${v.id}`)}
            className="flex items-center gap-3 rounded-xl w-full text-left cursor-pointer"
            style={{
              padding: "var(--tc-space-3) var(--tc-space-4)",
              background: "var(--tc-surface)",
              border: "1px solid var(--tc-border)",
            }}
          >
            <div
              className="w-10 h-8 rounded flex items-center justify-center shrink-0"
              style={{ background: "var(--tc-surface-soft)" }}
            >
              <VideoIcon />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>
                {v.title}
              </div>
              <div className="flex gap-2 text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                {v.duration_display && <span>{v.duration_display}</span>}
                <StatusBadge label={st.label} color={st.color} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* === Shared === */
function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {label}
    </span>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-sm font-semibold py-2.5 rounded-xl cursor-pointer"
      style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color, border: "none" }}
    >
      {label}
    </button>
  );
}

function VideoIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--tc-text-muted)" strokeWidth={1.5}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
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
