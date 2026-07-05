/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */
// PATH: src/app_teacher/domains/lectures/pages/LectureDetailPage.tsx
// 강의 상세 — 탭 구조: 차시 목록 + 수강생 목록 + CRUD
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import LectureChip from "@/shared/ui/chips/LectureChip";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { MoreVertical, Pencil, Trash2, Plus, Download } from "@teacher/shared/ui/Icons";
import { fetchLecture, fetchLectureSessions, fetchLectureEnrollments, deleteLecture, downloadAttendanceExcel } from "../api";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";
import LectureFormSheet from "../components/LectureFormSheet";
import SessionFormSheet from "../components/SessionFormSheet";
import EnrollStudentSheet from "../components/EnrollStudentSheet";
import SectionManageSheet from "../components/SectionManageSheet";
import { formatSessionLabel, getRegularOrder, isSupplementSession } from "@/shared/product/sessions/sessionOrdering";
import { teacherLectureQueryKeys } from "../queryKeys";

type Tab = "sessions" | "students";

export default function LectureDetailPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: teacherLectureQueryKeys.lectures }); teacherToast.info("강의가 삭제되었습니다."); navigate(-1); },
    onError: (e) => teacherToast.error(extractApiError(e, "강의를 삭제하지 못했습니다.")),
  });

  const attendanceExportMut = useMutation({
    mutationFn: () => downloadAttendanceExcel(lid),
    onSuccess: () => teacherToast.success("출석 엑셀을 다운로드했습니다."),
    onError: (e) => teacherToast.error(extractApiError(e, "출석 엑셀을 내려받지 못했습니다.")),
  });

  const { data: lecture, isLoading } = useQuery({
    queryKey: teacherLectureQueryKeys.lecture(lid),
    queryFn: () => fetchLecture(lid),
    enabled: Number.isFinite(lid),
  });

  const { data: sessions, isLoading: sessLoading } = useQuery({
    queryKey: teacherLectureQueryKeys.lectureSessionsFor(lid),
    queryFn: () => fetchLectureSessions(lid),
    enabled: Number.isFinite(lid),
  });

  // 수강생 카운트가 탭 헤더에 표시되므로 탭 전환 전에도 fetch
  const { data: enrollments } = useQuery({
    queryKey: teacherLectureQueryKeys.lectureEnrollmentsFor(lid),
    queryFn: () => fetchLectureEnrollments(lid),
    enabled: Number.isFinite(lid),
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
            <MoreVertical size={ICON.md} />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 rounded-lg shadow-lg"
                style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", zIndex: 100, minWidth: 130 }}>
                <button onClick={() => { setEditOpen(true); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                  style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-text)" }}>
                  <Pencil size={ICON.xs} /> 편집
                </button>
                <button onClick={() => { navigate(`/teacher/classes/${lid}/attendance-matrix`); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                  style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-text)", borderTop: "1px solid var(--tc-border-subtle)" }}>
                  <Download size={ICON.xs} /> 출석 현황 (매트릭스)
                </button>
                <button onClick={() => { setMenuOpen(false); attendanceExportMut.mutate(); }}
                  disabled={!Number.isFinite(lid) || attendanceExportMut.isPending}
                  className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                  style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-text)", borderTop: "1px solid var(--tc-border-subtle)" }}>
                  <Download size={ICON.xs} /> {attendanceExportMut.isPending ? "엑셀 생성 중..." : "출석 엑셀"}
                </button>
                <button onClick={() => { setSectionOpen(true); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                  style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-text)", borderTop: "1px solid var(--tc-border-subtle)" }}>
                  <Plus size={ICON.xs} /> 반 편성
                </button>
                <button onClick={async () => {
                    setMenuOpen(false);
                    const ok = await confirm({ title: "강의 삭제", message: "이 강의를 완전히 삭제하시겠습니까? 차시·수강생·출결 등 모든 관련 정보가 제거됩니다.", confirmText: "삭제", danger: true });
                    if (ok) deleteLectureMut.mutate();
                  }}
                  className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                  style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-danger)", borderTop: "1px solid var(--tc-border-subtle)" }}>
                  <Trash2 size={ICON.xs} /> 삭제
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
          <Plus size={ICON.xs} /> 차시 추가
        </button>
        {sessLoading ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : sessions && sessions.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {sessions.map((s: any) => {
              const regularOrder = getRegularOrder(s);
              const badge = isSupplementSession(s) ? "보" : regularOrder ?? s.order;
              return (
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
                    {badge}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>
                      {formatSessionLabel(s)}
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                      {s.date || "날짜 미정"}
                      {s.section_label ? ` · ${s.section_label}` : ""}
                    </div>
                  </div>
                  {/* 편집 1개만 inline 노출. 삭제는 편집 시트 내부에서 처리 (손가락 미스 → 데이터 손실 방지) */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span onClick={(e) => { e.stopPropagation(); setEditSession(s); setSessionFormOpen(true); }}
                      className="flex p-2 cursor-pointer" style={{ color: "var(--tc-text-muted)" }}>
                      <Pencil size={ICON.md} />
                    </span>
                    <ChevronRight />
                  </div>
                </button>
              );
            })}
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
          <Plus size={ICON.xs} /> 수강생 등록
        </button>
        {enrollments ? (
          enrollments.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {enrollments.map((e: any) => {
                const studentId = e.student_id ?? e.student?.id;
                const name = e.student_name ?? e.name ?? e.student?.name ?? "이름 없음";
                const parentPhone = e.parent_phone ?? e.parentPhone ?? e.student?.parent_phone;
                const studentPhone = e.student_phone ?? e.studentPhone ?? e.phone ?? e.student?.phone;
                const lectureInfo = lecture
                  ? [{
                      lectureName: lecture.title,
                      color: lecture.color,
                      chipLabel,
                    }]
                  : undefined;
                return (
                  <button
                    key={e.id}
                    onClick={() => studentId && navigate(`/teacher/students/${studentId}`)}
                    className="flex items-center gap-3 rounded-xl w-full text-left cursor-pointer"
                    style={{
                      padding: "var(--tc-space-3) var(--tc-space-4)",
                      background: "var(--tc-surface)",
                      border: "1px solid var(--tc-border)",
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <StudentNameWithLectureChip
                        name={name}
                        avatarSize={36}
                        chipSize={20}
                        className="text-sm"
                        lectures={lectureInfo}
                      />
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
        enrolledStudentIds={(enrollments ?? []).map((e: any) => e.student_id ?? e.student?.id).filter(Boolean)} />
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
