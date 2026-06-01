/* eslint-disable no-restricted-syntax, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
// PATH: src/app_teacher/domains/lectures/pages/SessionDetailPage.tsx
// 차시 상세 — 탭 구조: 학생 + 출석 + 성적 + 시험 + 과제 + 영상 (+ 클리닉 if section_mode)
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import LectureChip from "@/shared/ui/chips/LectureChip";
import StudentNameWithLectureChip, { type LectureInfo } from "@/shared/ui/chips/StudentNameWithLectureChip";
import { useSectionMode } from "@/shared/hooks/useSectionMode";
import { AchievementBadge } from "@teacher/shared/ui/Badge";
import { fetchSession, fetchSessionAttendance, fetchLectureEnrollments } from "../api";
import { fetchSessionExams, fetchExamResults } from "@teacher/domains/scores/api";
import {
  getExamResultMaxScore,
  getExamResultScore,
} from "@teacher/domains/results/examResultContract";
import { fetchVideos } from "@teacher/domains/videos/api";
import { fetchHomeworks } from "@teacher/domains/exams/api";
import { fetchSessionClinicLinks, type ClinicLinkRow } from "@teacher/domains/clinic/api";

type Tab = "students" | "attendance" | "scores" | "exams" | "homeworks" | "videos" | "clinic";

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
  const { sectionMode } = useSectionMode();
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

  // 차시 학생 탭은 enrollment 기준 list + attendance 매핑 — 출석 row 미생성 학생도 노출
  const lectureIdForEnrollments = session?.lecture_id ?? session?.lecture ?? null;
  const { data: enrollments } = useQuery({
    queryKey: ["lecture-enrollments", lectureIdForEnrollments],
    queryFn: () => fetchLectureEnrollments(lectureIdForEnrollments!),
    enabled: Number.isFinite(lectureIdForEnrollments),
  });

  const { data: exams } = useQuery({
    queryKey: ["session-exams-detail", sid],
    queryFn: () => fetchSessionExams(sid),
    enabled: Number.isFinite(sid) && (tab === "scores" || tab === "exams"),
  });

  const { data: homeworks } = useQuery({
    queryKey: ["session-homeworks", sid],
    queryFn: () => fetchHomeworks({ session_id: sid }),
    enabled: Number.isFinite(sid) && tab === "homeworks",
  });

  const { data: videos } = useQuery({
    queryKey: ["session-videos", sid],
    queryFn: () => fetchVideos({ session: sid }),
    enabled: Number.isFinite(sid) && tab === "videos",
  });

  // 차시 클리닉 탭 = ClinicLink (학생×차시 매핑) SSOT.
  // (이전: ClinicSession = 날짜의 클리닉 스케줄 — 차시 내 누가 클리닉 대상인지 못 봄)
  const { data: clinicLinks } = useQuery({
    queryKey: ["session-clinic-links", sid],
    queryFn: () => fetchSessionClinicLinks(sid),
    enabled: Number.isFinite(sid) && tab === "clinic" && sectionMode,
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;

  const title = session?.title || `${session?.order ?? ""}차시`;
  const sessionLectureInfo: LectureInfo | undefined = session
    ? {
        lectureName: session.lecture_title,
        color: session.lecture_color,
        chipLabel: session.lecture_chip_label,
      }
    : undefined;

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
              size={ICON.xl}
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

      {/* Tabs (가로 스크롤) */}
      <div
        className="flex overflow-x-auto"
        style={{ borderBottom: "1px solid var(--tc-border)", WebkitOverflowScrolling: "touch" }}
      >
        {([
          // 학생 카운트는 enrollment(차시 수강생 전체) 기준. attendance는 출석 상태가 매겨진 row만이라 학생 수와 다름.
          { key: "students" as Tab, label: `학생${enrollments?.length != null ? ` ${enrollments.length}` : ""}` },
          { key: "attendance" as Tab, label: "출석" },
          { key: "scores" as Tab, label: "성적" },
          { key: "exams" as Tab, label: "시험" },
          { key: "homeworks" as Tab, label: "과제" },
          { key: "videos" as Tab, label: "영상" },
          ...(sectionMode ? [{ key: "clinic" as Tab, label: "클리닉" }] : []),
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="shrink-0 text-[13px] cursor-pointer"
            style={{
              padding: "12px 14px",
              minHeight: "var(--tc-touch-min)",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--tc-primary)" : "2px solid transparent",
              color: tab === t.key ? "var(--tc-primary)" : "var(--tc-text-secondary)",
              fontWeight: tab === t.key ? 700 : 500,
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "students" && (
        <StudentsTab
          enrollments={enrollments ?? []}
          attendances={attendances ?? []}
          lectureInfo={sessionLectureInfo}
          navigate={navigate}
        />
      )}
      {tab === "attendance" && <AttendanceTab attendances={attendances ?? []} lectureInfo={sessionLectureInfo} />}
      {tab === "scores" && <ScoresTab exams={exams ?? []} sessionId={sid} lectureInfo={sessionLectureInfo} navigate={navigate} />}
      {tab === "exams" && <ExamsTab exams={exams ?? []} navigate={navigate} />}
      {tab === "homeworks" && <HomeworksTab homeworks={homeworks ?? []} navigate={navigate} />}
      {tab === "videos" && <VideosTab videos={videos ?? []} navigate={navigate} />}
      {tab === "clinic" && (
        <ClinicTab
          links={clinicLinks ?? []}
          enabled={!!sectionMode}
          lectureInfo={sessionLectureInfo}
          navigate={navigate}
        />
      )}
    </div>
  );
}

/* === Exams tab === */
function ExamsTab({ exams, navigate }: { exams: any[]; navigate: any }) {
  if (!exams.length) return <EmptyState scope="panel" tone="empty" title="이 차시에 등록된 시험이 없습니다" />;
  return (
    <div className="flex flex-col gap-1.5">
      {exams.map((e: any) => (
        <button
          key={e.id}
          onClick={() => navigate(`/teacher/exams/${e.id}`)}
          className="flex items-center gap-3 rounded-xl w-full text-left cursor-pointer"
          style={{
            padding: "var(--tc-space-3) var(--tc-space-4)",
            minHeight: "var(--tc-touch-min)",
            background: "var(--tc-surface)",
            border: "1px solid var(--tc-border)",
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>
              {e.title}
            </div>
            <div className="flex gap-2 text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
              {e.subject && <span>{e.subject}</span>}
              {e.max_score != null && <span>{e.max_score}점</span>}
            </div>
          </div>
          <ChevronRightIcon />
        </button>
      ))}
    </div>
  );
}

/* === Homeworks tab === */
function HomeworksTab({ homeworks, navigate }: { homeworks: any[]; navigate: any }) {
  if (!homeworks.length) return <EmptyState scope="panel" tone="empty" title="이 차시에 등록된 과제가 없습니다" />;
  return (
    <div className="flex flex-col gap-1.5">
      {homeworks.map((h: any) => {
        // backend schema: due_date/max_score 는 meta JSON 안. root-level 도 폴백.
        const due = h.due_date ?? h.meta?.due_date ?? null;
        const max = h.max_score ?? h.meta?.default_max_score ?? h.meta?.max_score ?? null;
        const submitted = h.submitted_count ?? h.submission_count ?? null;
        const total = h.total_count ?? h.enrolled_count ?? null;
        return (
        <button
          key={h.id}
          onClick={() => navigate(`/teacher/homeworks/${h.id}`)}
          className="flex items-center gap-3 rounded-xl w-full text-left cursor-pointer"
          style={{
            padding: "var(--tc-space-3) var(--tc-space-4)",
            minHeight: "var(--tc-touch-min)",
            background: "var(--tc-surface)",
            border: "1px solid var(--tc-border)",
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>
              {h.title}
            </div>
            <div className="flex gap-2 text-[11px] mt-0.5 flex-wrap" style={{ color: "var(--tc-text-muted)" }}>
              {due && <span>마감 {due}</span>}
              {max != null && <span>{max}점</span>}
              {submitted != null && total != null && (
                <span style={{ color: submitted >= total ? "var(--tc-success)" : "var(--tc-warn)" }}>
                  제출 {submitted}/{total}
                </span>
              )}
            </div>
          </div>
          <ChevronRightIcon />
        </button>
        );
      })}
    </div>
  );
}

/* === Clinic tab ===
   이 차시(session)의 ClinicLink 리스트.
   "어느 학생이 어느 사유로 클리닉 대상인지 + 해소됐는지" 를 한 화면에 표시.
   - reason: AUTO_FAILED / AUTO_RISK / MANUAL_REQUEST / TEACHER_RECOMMEND
   - resolution_type: 해소됐을 때 EXAM_PASS / HOMEWORK_PASS / MANUAL_OVERRIDE / WAIVED / CARRIED_OVER
   - cycle_no: 차수 (이월 시 +1)
*/
const REASON_LABEL: Record<string, string> = {
  AUTO_FAILED: "차시 미통과",
  AUTO_RISK: "위험 자동",
  MANUAL_REQUEST: "요청",
  TEACHER_RECOMMEND: "추천",
};
const RESOLUTION_LABEL: Record<string, { label: string; color: string }> = {
  EXAM_PASS: { label: "시험 통과", color: "var(--tc-success)" },
  HOMEWORK_PASS: { label: "과제 통과", color: "var(--tc-success)" },
  MANUAL_OVERRIDE: { label: "수동 해소", color: "var(--tc-info)" },
  WAIVED: { label: "면제", color: "var(--tc-text-muted)" },
  CARRIED_OVER: { label: "이월", color: "var(--tc-warn)" },
  BOOKING_LEGACY: { label: "예약(레거시)", color: "var(--tc-text-muted)" },
};

function ClinicTab({
  links,
  enabled,
  lectureInfo,
  navigate,
}: {
  links: ClinicLinkRow[];
  enabled: boolean;
  lectureInfo?: LectureInfo;
  navigate: any;
}) {
  if (!enabled) {
    return <EmptyState scope="panel" tone="empty" title="이 학원은 클리닉 기능을 사용하지 않습니다" />;
  }
  if (!links.length) {
    return <EmptyState scope="panel" tone="empty" title="이 차시에서 클리닉 대상 학생이 없습니다" />;
  }

  // 미해소 먼저, 그 안에서 cycle 큰 순(최근 이월), 그 다음 해소된 항목
  const sorted = [...links].sort((a, b) => {
    const aResolved = a.resolved_at ? 1 : 0;
    const bResolved = b.resolved_at ? 1 : 0;
    if (aResolved !== bResolved) return aResolved - bResolved;
    if (a.cycle_no !== b.cycle_no) return b.cycle_no - a.cycle_no;
    return 0;
  });

  const unresolvedCount = sorted.filter((l) => !l.resolved_at).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>
        미해소 {unresolvedCount} / 전체 {sorted.length}
      </div>
      <div className="flex flex-col gap-1.5">
        {sorted.map((l) => {
          const reasonLabel = REASON_LABEL[l.reason] ?? l.reason;
          const isResolved = !!l.resolved_at;
          const resolution = l.resolution_type ? RESOLUTION_LABEL[l.resolution_type] : null;
          return (
            <button
              key={l.id}
              onClick={() => navigate(`/teacher/clinic`)}
              className="flex items-center gap-3 rounded-xl w-full text-left cursor-pointer"
              style={{
                padding: "var(--tc-space-3) var(--tc-space-4)",
                minHeight: "var(--tc-touch-min)",
                background: "var(--tc-surface)",
                border: "1px solid var(--tc-border)",
                opacity: isResolved ? 0.7 : 1,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <StudentNameWithLectureChip
                    name={l.student_name || "학생"}
                    lectures={lectureInfo ? [lectureInfo] : undefined}
                    chipSize={18}
                  />
                  {l.cycle_no > 1 && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                      style={{ color: "var(--tc-warn)", background: "color-mix(in srgb, var(--tc-warn) 12%, transparent)" }}
                    >
                      {l.cycle_no}차
                    </span>
                  )}
                </div>
                <div className="flex gap-2 text-[11px] mt-0.5 flex-wrap" style={{ color: "var(--tc-text-muted)" }}>
                  <span>{reasonLabel}</span>
                  {l.is_auto && <span>자동</span>}
                  {l.memo && <span className="truncate max-w-[160px]">{l.memo}</span>}
                </div>
              </div>
              <div className="shrink-0">
                {isResolved && resolution ? (
                  <StatusBadge label={resolution.label} color={resolution.color} />
                ) : (
                  <StatusBadge label="미해소" color="var(--tc-danger)" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChevronRightIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--tc-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/* === Students tab === */
// enrollment(차시 수강생 전체)를 base로 하고 attendance를 매핑해 출석 상태 표시.
// 출석 row가 없는 학생도 "미체크" 상태로 노출되어 학원장이 누락된 학생을 확인 가능.
function StudentsTab({
  enrollments,
  attendances,
  lectureInfo,
  navigate,
}: { enrollments: any[]; attendances: any[]; lectureInfo?: LectureInfo; navigate: any }) {
  if (!enrollments.length) return <EmptyState scope="panel" tone="empty" title="수강생이 없습니다" />;

  // enrollment_id → attendance row 매핑
  const attendanceByEnrollment = new Map<number, any>();
  for (const a of attendances) {
    const enId = a.enrollment_id ?? a.enrollment;
    if (enId != null) attendanceByEnrollment.set(enId, a);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {enrollments.map((e: any) => {
        const name = e.student_name ?? e.student?.name ?? e.name ?? "이름 없음";
        const studentId = e.student_id ?? e.student?.id;
        const parentPhone = e.parent_phone ?? e.student?.parent_phone ?? e.parentPhone;
        const studentPhone = e.student_phone ?? e.student?.phone ?? e.studentPhone ?? e.phone;
        const att = attendanceByEnrollment.get(e.id);
        const st = att
          ? (STATUS_LABELS[att.status] ?? { label: att.status, color: "var(--tc-text-muted)" })
          : { label: "미체크", color: "var(--tc-text-muted)" };

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
                lectures={lectureInfo ? [lectureInfo] : undefined}
                avatarSize={32}
                chipSize={18}
              />
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
function AttendanceTab({ attendances, lectureInfo }: { attendances: any[]; lectureInfo?: LectureInfo }) {
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
              <StudentNameWithLectureChip
                name={name}
                lectures={lectureInfo ? [lectureInfo] : undefined}
                chipSize={18}
              />
              <StatusBadge label={st.label} color={st.color} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* === Scores tab === */
function ScoresTab({
  exams,
  sessionId,
  lectureInfo,
  navigate,
}: { exams: any[]; sessionId: number; lectureInfo?: LectureInfo; navigate: any }) {
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
          <>
            <div className="flex flex-col gap-1">
              {results.map((r: any) => {
                const name = r.student_name ?? "이름 없음";
                const examMaxScore = exams.find((e: any) => e.id === selectedExam)?.max_score ?? 100;
                const score = getExamResultScore(r);
                const maxScore = getExamResultMaxScore(r, examMaxScore);
                // 미응시 / 임시채점 / 미채점 / 정상점수 4-state 표시.
                // backend admin_exam_results_view 응답의 meta_status·is_provisional SSOT 반영.
                const isNotSubmitted = r.meta_status === "NOT_SUBMITTED";
                const isProvisional = !!r.is_provisional;
                let scoreText: string;
                if (isNotSubmitted) scoreText = "미응시";
                else if (score == null) scoreText = "미채점";
                else scoreText = isProvisional ? `${score}/${maxScore} (임시)` : `${score}/${maxScore}`;
                return (
                  <div
                    key={r.enrollment_id}
                    className="flex justify-between items-center py-2 border-b last:border-b-0"
                    style={{ borderColor: "var(--tc-border)" }}
                  >
                    <StudentNameWithLectureChip
                      name={name}
                      lectures={lectureInfo ? [lectureInfo] : undefined}
                      chipSize={18}
                      className="flex-1 min-w-0"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <AchievementBadge passed={r.final_pass ?? r.passed} achievement={r.achievement} />
                      <span
                        className="text-sm font-bold"
                        style={{ color: (isNotSubmitted || score == null) ? "var(--tc-text-muted)" : "var(--tc-text)" }}
                      >
                        {scoreText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => navigate(`/teacher/scores/${sessionId}`)}
              className="text-[13px] font-semibold py-2.5 rounded-xl cursor-pointer"
              style={{
                background: "var(--tc-primary)",
                color: "#fff",
                border: "none",
              }}
            >
              점수 입력 / 수정
            </button>
          </>
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

  // backend Video.Status SSOT (uppercase). 과거 소문자 enum 으로 lookup 실패하던 버그 fix.
  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    READY: { label: "시청 가능", color: "var(--tc-success)" },
    PROCESSING: { label: "인코딩 중", color: "var(--tc-warn)" },
    PENDING: { label: "대기", color: "var(--tc-text-muted)" },
    UPLOADED: { label: "업로드 완료", color: "var(--tc-text-muted)" },
    FAILED: { label: "실패", color: "var(--tc-danger)" },
  };

  return (
    <div className="flex flex-col gap-1.5">
      {videos.map((v: any) => {
        const st = STATUS_MAP[v.status ?? "PENDING"] ?? STATUS_MAP.PENDING;
        return (
          <button
            key={v.id}
            onClick={() => v.status === "READY" && navigate(`/teacher/videos/${v.id}`)}
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
