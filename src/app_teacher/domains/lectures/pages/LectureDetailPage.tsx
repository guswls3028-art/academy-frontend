// PATH: src/app_teacher/domains/lectures/pages/LectureDetailPage.tsx
// 강의 상세 — 탭 구조: 차시 목록 + 수강생 목록
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { fetchLecture, fetchLectureSessions, fetchLectureEnrollments } from "../api";

type Tab = "sessions" | "students";

export default function LectureDetailPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const navigate = useNavigate();
  const lid = Number(lectureId);
  const [tab, setTab] = useState<Tab>("sessions");

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

  const { data: enrollments } = useQuery({
    queryKey: ["lecture-enrollments", lid],
    queryFn: () => fetchLectureEnrollments(lid),
    enabled: Number.isFinite(lid) && tab === "students",
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;

  const chipLabel = lecture?.chip_label ?? lecture?.chipLabel;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        {lecture && (
          <LectureChip
            lectureName={lecture.title}
            color={lecture.color}
            chipLabel={chipLabel}
            size={24}
          />
        )}
        <h1 className="text-[17px] font-bold flex-1 truncate" style={{ color: "var(--tc-text)" }}>
          {lecture?.title || "강의 상세"}
        </h1>
      </div>

      {/* Lecture info */}
      {lecture && (
        <div
          className="rounded-xl"
          style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}
        >
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]" style={{ color: "var(--tc-text-secondary)" }}>
            {lecture.subject && <span>{lecture.subject}</span>}
            {(lecture.name || lecture.instructor) && <span>{lecture.name ?? lecture.instructor}</span>}
            {lecture.lecture_time && <span>{lecture.lecture_time}</span>}
          </div>
          {lecture.start_date && (
            <div className="text-[12px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
              {lecture.start_date} ~ {lecture.end_date}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--tc-border)", background: "var(--tc-surface-soft)" }}
      >
        {([
          { key: "sessions" as Tab, label: `차시 (${sessions?.length ?? 0})` },
          { key: "students" as Tab, label: `수강생 (${enrollments?.length ?? "…"})` },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 text-[13px] font-semibold py-2.5 cursor-pointer"
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

      {/* Sessions tab */}
      {tab === "sessions" && (
        sessLoading ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : sessions && sessions.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {sessions.map((s: any) => (
              <button
                key={s.id}
                onClick={() => navigate(`/teacher/classes/${lectureId}/sessions/${s.id}`)}
                className="flex items-center gap-3 rounded-xl w-full text-left cursor-pointer"
                style={{
                  padding: "var(--tc-space-3) var(--tc-space-4)",
                  background: "var(--tc-surface)",
                  border: "1px solid var(--tc-border)",
                }}
              >
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                  style={{
                    background: "var(--tc-primary-bg)",
                    color: "var(--tc-primary)",
                  }}
                >
                  {s.order}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>
                    {s.title || `${s.order}차시`}
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                    {s.date || "날짜 미정"}
                    {s.section_label ? ` · ${s.section_label}` : ""}
                  </div>
                </div>
                <ChevronRight />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState scope="panel" tone="empty" title="차시가 없습니다" />
        )
      )}

      {/* Students tab */}
      {tab === "students" && (
        enrollments ? (
          enrollments.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {enrollments.map((e: any) => {
                const name = e.student_name ?? e.name ?? "이름 없음";
                const parentPhone = e.parent_phone ?? e.parentPhone;
                const studentPhone = e.student_phone ?? e.studentPhone ?? e.phone;
                return (
                  <button
                    key={e.id}
                    onClick={() => e.student_id && navigate(`/teacher/students/${e.student_id}`)}
                    className="flex items-center gap-3 rounded-xl w-full text-left cursor-pointer"
                    style={{
                      padding: "var(--tc-space-3) var(--tc-space-4)",
                      background: "var(--tc-surface)",
                      border: "1px solid var(--tc-border)",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
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
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        color: e.status === "ACTIVE" ? "var(--tc-success)" : "var(--tc-text-muted)",
                        background: e.status === "ACTIVE" ? "var(--tc-success-bg)" : "var(--tc-surface-soft)",
                      }}
                    >
                      {e.status === "ACTIVE" ? "수강 중" : "비활성"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState scope="panel" tone="empty" title="수강생이 없습니다" />
          )
        ) : (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        )
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
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--tc-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
