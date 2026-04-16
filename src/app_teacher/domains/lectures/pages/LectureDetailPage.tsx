// PATH: src/app_teacher/domains/lectures/pages/LectureDetailPage.tsx
// 강의 상세 — 탭 구조: 차시 목록 + 수강생 목록 + CRUD
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { MoreVertical, Pencil, Trash2, Plus, Download } from "@teacher/shared/ui/Icons";
import { fetchLecture, fetchLectureSessions, fetchLectureEnrollments, deleteLecture, deleteSession, downloadAttendanceExcel } from "../api";
import LectureFormSheet from "../components/LectureFormSheet";
import SessionFormSheet from "../components/SessionFormSheet";
import EnrollStudentSheet from "../components/EnrollStudentSheet";
import SectionManageSheet from "../components/SectionManageSheet";

type Tab = "sessions" | "students";

export default function LectureDetailPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const lid = Number(lectureId);
  const [tab, setTab] = useState<Tab>("sessions");
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [editSession, setEditSession] = useState<any>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);

  const deleteLectureMut = useMutation({
    mutationFn: () => deleteLecture(lid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lectures-mobile"] }); navigate(-1); },
  });

  const deleteSessionMut = useMutation({
    mutationFn: (sessionId: number) => deleteSession(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lecture-sessions", lid] }),
  });

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
        {/* Actions menu */}
        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="flex p-1 cursor-pointer"
            style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 rounded-lg shadow-lg"
                style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", zIndex: 100, minWidth: 130 }}>
                <button onClick={() => { setEditOpen(true); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                  style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-text)" }}>
                  <Pencil size={14} /> 편집
                </button>
                <button onClick={() => downloadAttendanceExcel(lid).catch(() => {})}
                  className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                  style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-text)", borderTop: "1px solid var(--tc-border-subtle)" }}>
                  <Download size={14} /> 출석 엑셀
                </button>
                <button onClick={() => { setSectionOpen(true); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                  style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-text)", borderTop: "1px solid var(--tc-border-subtle)" }}>
                  <Plus size={14} /> 반 편성 / D-Day
                </button>
                <button onClick={() => { if (confirm("이 강의를 삭제하시겠습니까?")) deleteLectureMut.mutate(); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                  style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-danger)", borderTop: "1px solid var(--tc-border-subtle)" }}>
                  <Trash2 size={14} /> 삭제
                </button>
              </div>
            </>
          )}
        </div>
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
        <>
        <button onClick={() => { setEditSession(null); setSessionFormOpen(true); }}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer self-end"
          style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          <Plus size={14} /> 차시 추가
        </button>
        {sessLoading ? (
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
                <div className="flex items-center gap-1 shrink-0">
                  <span onClick={(e) => { e.stopPropagation(); setEditSession(s); setSessionFormOpen(true); }}
                    className="flex p-1 cursor-pointer" style={{ color: "var(--tc-text-muted)" }}>
                    <Pencil size={13} />
                  </span>
                  <span onClick={(e) => { e.stopPropagation(); if (confirm("이 차시를 삭제하시겠습니까?")) deleteSessionMut.mutate(s.id); }}
                    className="flex p-1 cursor-pointer" style={{ color: "var(--tc-danger)" }}>
                    <Trash2 size={13} />
                  </span>
                  <ChevronRight />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState scope="panel" tone="empty" title="차시가 없습니다" />
        )}
        </>
      )}

      {/* Students tab */}
      {tab === "students" && (
        <>
        <button onClick={() => setEnrollOpen(true)}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer self-end"
          style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          <Plus size={14} /> 수강생 등록
        </button>
        {enrollments ? (
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
        )}
        </>
      )}

      {/* Sheets */}
      {lecture && <LectureFormSheet open={editOpen} onClose={() => setEditOpen(false)} editData={lecture} />}
      <SessionFormSheet open={sessionFormOpen} onClose={() => setSessionFormOpen(false)} lectureId={lid} editData={editSession} />
      <EnrollStudentSheet open={enrollOpen} onClose={() => setEnrollOpen(false)} lectureId={lid}
        enrolledStudentIds={(enrollments ?? []).map((e: any) => e.student_id).filter(Boolean)} />
      <SectionManageSheet open={sectionOpen} onClose={() => setSectionOpen(false)} lectureId={lid} />
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
