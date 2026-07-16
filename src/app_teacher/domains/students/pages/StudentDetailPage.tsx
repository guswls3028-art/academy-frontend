/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/students/pages/StudentDetailPage.tsx
// 학생 상세 — 데스크톱 오버레이 1:1 매칭 (5탭) + 편집/태그/메모/상태 관리
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import LectureChip from "@/shared/ui/chips/LectureChip";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import StudentScoreTrendChart from "@/shared/ui/assessment/StudentScoreTrendChart";
import { Pencil, Save, X, Tag, Plus, ToggleLeft, ToggleRight, Lock, MessageSquare } from "@teacher/shared/ui/Icons";
import { Card, BackButton, KpiCard, TabBar } from "@teacher/shared/ui/Card";
import { Badge, AchievementBadge, ClinicStatusBadge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { fetchStudent, fetchStudentAccountNotifications, fetchStudentGrades, updateStudent, toggleStudentActive, fetchTags, attachTag, detachTag, createTag, updateStudentMemo, deleteStudent, sendPasswordReset } from "../api";
import type { StudentAccountNotificationLog, TeacherStudentExamResult } from "../api";
import type { StudentExamTrendPoint, StudentHomeworkGrade } from "@/shared/api/contracts/studentGrades";
import { teacherStudentsQueryKeys } from "../queryKeys";
import type { ClientEnrollmentLite, ClientStudent, ClientStudentTag } from "@/shared/api/contracts/students";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";
import api from "@/shared/api/axios";
import { listFromApiResponse } from "@/shared/api/response";

type Tab = "enrollments" | "exams" | "homework" | "clinic" | "questions";

type ClinicParticipantRow = {
  id: number | string;
  session_title?: string | null;
  session_date?: string | null;
  session_start_time?: string | null;
  session_location?: string | null;
  clinic_reason?: string | null;
  status?: string | null;
};

type CommunityQuestionRow = {
  id: number | string;
  post_type?: string | null;
  title?: string | null;
  created_at?: string | null;
  replies_count?: number | null;
};

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const sid = Number(studentId);
  const [tab, setTab] = useState<Tab>("enrollments");

  // Edit states
  const [editOpen, setEditOpen] = useState(false);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [pwResetOpen, setPwResetOpen] = useState(false);

  const { data: student, isLoading } = useQuery({
    queryKey: teacherStudentsQueryKeys.student(sid),
    queryFn: () => fetchStudent(sid),
    enabled: Number.isFinite(sid),
  });

  const {
    data: gradesData,
    isLoading: gradesLoading,
    isError: gradesError,
    refetch: refetchGrades,
  } = useQuery({
    queryKey: teacherStudentsQueryKeys.studentExams(sid),
    queryFn: () => fetchStudentGrades(sid),
    enabled: Number.isFinite(sid),
    refetchOnMount: "always",
  });

  const { data: accountNotifications } = useQuery({
    queryKey: teacherStudentsQueryKeys.accountNotifications(sid),
    queryFn: () => fetchStudentAccountNotifications(sid),
    enabled: Number.isFinite(sid),
  });

  const { data: clinicData } = useQuery({
    queryKey: teacherStudentsQueryKeys.clinic(sid),
    queryFn: async () => {
      const res = await api.get("/clinic/participants/", { params: { student: sid, page_size: 100 } });
      return listFromApiResponse<ClinicParticipantRow>(res.data);
    },
    enabled: Number.isFinite(sid) && tab === "clinic",
  });

  const { data: questionsData } = useQuery({
    queryKey: teacherStudentsQueryKeys.questions(sid),
    queryFn: async () => {
      const res = await api.get("/community/posts/", { params: { created_by: sid, page_size: 50, ordering: "-created_at" } });
      return listFromApiResponse<CommunityQuestionRow>(res.data);
    },
    enabled: Number.isFinite(sid) && tab === "questions",
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!student)
    return <EmptyState scope="panel" tone="error" title="학생 정보를 찾을 수 없습니다" />;

  const name = student.name ?? student.displayName ?? "이름 없음";
  const parentPhone = student.parentPhone;
  const studentPhone = student.studentPhone;
  const enrollments: ClientEnrollmentLite[] = student.enrollments ?? [];
  const tags: ClientStudentTag[] = student.tags ?? [];
  const exams: TeacherStudentExamResult[] = gradesData?.exams ?? [];
  const homeworks = gradesData?.homeworks ?? [];
  const judgedExams = exams.filter((result) => result.achievement === "PASS" || result.achievement === "REMEDIATED" || result.achievement === "FAIL");
  const passCount = judgedExams.filter((result) => result.achievement === "PASS" || result.achievement === "REMEDIATED").length;
  const failCount = judgedExams.length - passCount;
  const averageScore = gradesData?.exam_summary.average_score_pct ?? undefined;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>학생 상세</h1>
      </div>

      {/* Profile */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <StudentNameWithLectureChip
              name={name}
              profilePhotoUrl={student.profilePhotoUrl}
              avatarSize={56}
              chipSize={ICON.lg}
              className="text-lg"
              lectures={enrollments.map((e) => ({
                lectureName: e.lectureName,
                color: e.lectureColor,
                chipLabel: e.lectureChipLabel,
              }))}
            />
            {student.psNumber && (
              <div className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
                ID: {student.psNumber}{student.omrCode ? ` · OMR: ${student.omrCode}` : ""}
              </div>
            )}
          </div>
          <button onClick={() => setEditOpen(true)}
            className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer shrink-0"
            style={{ padding: "5px 10px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
            <Pencil size={ICON.xs} /> 편집
          </button>
        </div>

        {/* Tags — with management */}
        <div className="flex flex-wrap items-center gap-1 mt-3">
          {tags.map((t) => (
            <Badge key={t.id} tone="neutral" pill>{t.name}</Badge>
          ))}
          <button onClick={() => setTagSheetOpen(true)}
            className="flex items-center gap-0.5 text-[11px] font-semibold cursor-pointer"
            style={{ padding: "3px 8px", borderRadius: "var(--tc-radius-full)", border: "1px dashed var(--tc-border-strong)", background: "none", color: "var(--tc-text-muted)" }}>
            <Tag size={10} /> 태그 관리
          </button>
        </div>

        {/* Quick actions + status toggle */}
        <div className="flex gap-2 mt-3">
          {parentPhone && <ContactBtn href={`tel:${parentPhone}`} label={`부모 ${formatPhone(parentPhone)}`} />}
          {studentPhone && <ContactBtn href={`tel:${studentPhone}`} label={`학생 ${formatPhone(studentPhone)}`} />}
        </div>
      </Card>

      {/* Info */}
      <Card>
        <h3 className="text-sm font-bold mb-2" style={{ color: "var(--tc-text)" }}>기본 정보</h3>
        {parentPhone && <InfoRow label="학부모 전화" value={formatPhone(parentPhone)} href={`tel:${parentPhone}`} />}
        {studentPhone && <InfoRow label="학생 전화" value={formatPhone(studentPhone)} href={`tel:${studentPhone}`} />}
        {student.gender && <InfoRow label="성별" value={student.gender === "M" ? "남" : student.gender === "F" ? "여" : student.gender} />}
        {student.registeredAt && <InfoRow label="등록일" value={new Date(student.registeredAt).toLocaleDateString("ko-KR")} />}
        {student.school && <InfoRow label="학교" value={student.school} />}
        {student.grade != null && <InfoRow label="학년" value={`${student.grade}학년`} />}
        {student.schoolClass && <InfoRow label="반" value={student.schoolClass} />}
        {student.major && <InfoRow label="계열" value={student.major} />}
        {student.address && <InfoRow label="주소" value={student.address} />}
      </Card>

      <AccountNotificationCard items={accountNotifications ?? []} />

      {/* Memo — editable */}
      <MemoSection studentId={sid} initialMemo={student.memo ?? ""} />

      {/* Summary KPI */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard label="수강" value={enrollments.filter((e) => e.status === "ACTIVE").length} sub={`/${enrollments.length}`} />
        <KpiCard
          label="시험"
          value={gradesLoading ? "…" : gradesError ? "-" : exams.length}
          sub={gradesLoading ? "불러오는 중" : gradesError ? "불러오기 실패" : averageScore != null ? `평균 ${averageScore}%` : undefined}
        />
        <KpiCard
          label="합격률"
          value={gradesLoading || gradesError ? "-" : judgedExams.length ? `${Math.round((passCount / judgedExams.length) * 100)}%` : "-"}
          sub={gradesLoading ? "불러오는 중" : gradesError ? "불러오기 실패" : undefined}
          color={!gradesLoading && !gradesError && passCount > failCount ? "var(--tc-success)" : undefined}
        />
      </div>

      {/* 5 Tabs */}
      <TabBar
        tabs={[
          { key: "enrollments" as Tab, label: "수강" },
          { key: "exams" as Tab, label: "시험" },
          { key: "homework" as Tab, label: "과제" },
          { key: "clinic" as Tab, label: "클리닉" },
          { key: "questions" as Tab, label: "질문" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Tab content */}
      {tab === "enrollments" && <EnrollmentList enrollments={enrollments} />}
      {tab === "exams" && (
        <ExamList
          results={exams}
          trend={gradesData?.exam_trend ?? []}
          isLoading={gradesLoading}
          isError={gradesError}
          onRetry={() => { void refetchGrades(); }}
        />
      )}
      {tab === "homework" && (
        <HomeworkList
          results={homeworks}
          isLoading={gradesLoading}
          isError={gradesError}
          onRetry={() => { void refetchGrades(); }}
        />
      )}
      {tab === "clinic" && <ClinicList items={clinicData ?? []} />}
      {tab === "questions" && <QuestionList items={questionsData ?? []} />}

      {/* Edit Student BottomSheet */}
      <EditStudentSheet open={editOpen} onClose={() => setEditOpen(false)} student={student} studentId={sid}
        onDelete={() => { deleteStudent(sid).then(() => { navigate(-1); }); }}
        onOpenPasswordReset={() => { setEditOpen(false); setPwResetOpen(true); }} />

      {/* Tag Management BottomSheet */}
      <TagManagementSheet open={tagSheetOpen} onClose={() => setTagSheetOpen(false)} studentId={sid} currentTags={tags} />

      {/* Password Reset BottomSheet */}
      <PasswordResetSheet open={pwResetOpen} onClose={() => setPwResetOpen(false)} student={student} />
    </div>
  );
}

/* === Tabs === */

function EnrollmentList({ enrollments }: { enrollments: ClientEnrollmentLite[] }) {
  if (!enrollments.length) {
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="수강 이력 없음"
        description="강의에 학생을 등록하면 현재 수강 상태가 표시됩니다."
      />
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {enrollments.map((e) => (
        <Card key={e.id ?? e.lectureId} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
          <div className="flex items-center gap-2">
            <LectureChip lectureName={e.lectureName ?? ""} color={e.lectureColor ?? undefined} chipLabel={e.lectureChipLabel ?? undefined} size={ICON.lg} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>{e.lectureName}</div>
              {e.enrolledAt && <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>{new Date(e.enrolledAt).toLocaleDateString("ko-KR")}</div>}
            </div>
            <Badge tone={e.status === "ACTIVE" ? "success" : "neutral"}>{e.status === "ACTIVE" ? "수강 중" : e.status === "PENDING" ? "대기" : "비활성"}</Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ExamList({
  results,
  trend,
  isLoading,
  isError,
  onRetry,
}: {
  results: TeacherStudentExamResult[];
  trend: StudentExamTrendPoint[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return <EmptyState scope="panel" tone="loading" title="성적 추이를 불러오는 중…" />;
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2">
        <EmptyState scope="panel" tone="error" title="성적 추이를 불러오지 못했습니다" description="잠시 후 다시 불러와 주세요." />
        <button type="button" onClick={onRetry} className="text-xs font-bold" style={{ color: "var(--tc-primary)" }}>다시 불러오기</button>
      </div>
    );
  }
  if (!results.length) {
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="시험 성적 없음"
        description="시험 채점이 완료되면 이 학생의 성적 이력이 쌓입니다."
      />
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <StudentScoreTrendChart points={trend} />
      {results.map((r) => (
        <Card key={r.exam_id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
          <div className="flex items-center gap-2">
            {r.lecture_color && <LectureChip lectureName={r.lecture_title ?? ""} color={r.lecture_color} chipLabel={r.lecture_chip_label ?? undefined} size={20} />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>{r.title}</div>
              <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                {r.session_title}{(r.retake_count ?? 1) > 1 ? ` · 재시험 ${(r.retake_count ?? 1) - 1}회` : ""}{r.submitted_at ? ` · ${new Date(r.submitted_at).toLocaleDateString("ko-KR")}` : ""}{r.archived ? " · 보관됨" : ""}
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>{r.total_score ?? "-"}/{r.max_score ?? 100}</span>
              <AchievementBadge passed={r.is_pass} achievement={r.achievement} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function HomeworkList({
  results,
  isLoading,
  isError,
  onRetry,
}: {
  results: StudentHomeworkGrade[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return <EmptyState scope="panel" tone="loading" title="과제 성적을 불러오는 중…" />;
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2">
        <EmptyState scope="panel" tone="error" title="과제 성적을 불러오지 못했습니다" description="잠시 후 다시 불러와 주세요." />
        <button type="button" onClick={onRetry} className="text-xs font-bold" style={{ color: "var(--tc-primary)" }}>다시 불러오기</button>
      </div>
    );
  }
  if (!results.length) {
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="과제 이력 없음"
        description="과제 제출 또는 채점 결과가 생기면 이곳에서 확인할 수 있습니다."
      />
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {results.map((r) => (
        <Card key={`${r.homework_id}-${r.session_id ?? "none"}-${r.enrollment_id}`} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
          <div className="flex items-center gap-2">
            {r.lecture_color && <LectureChip lectureName={r.lecture_title ?? ""} color={r.lecture_color} chipLabel={r.lecture_chip_label ?? undefined} size={20} />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>{r.title}</div>
              <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>{r.session_title}</div>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>{r.score ?? "-"}/{r.max_score ?? 100}</span>
              <AchievementBadge passed={r.passed} achievement={r.achievement} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ClinicList({ items }: { items: ClinicParticipantRow[] }) {
  if (!items.length) {
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="클리닉 이력 없음"
        description="클리닉 대상으로 지정되거나 참여하면 이력에 표시됩니다."
      />
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((c) => (
        <Card key={c.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{c.session_title ?? "클리닉"}</div>
              <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                {c.session_date}{c.session_start_time ? ` ${c.session_start_time.slice(0, 5)}` : ""}{c.session_location ? ` · ${c.session_location}` : ""}
                {c.clinic_reason ? ` · ${c.clinic_reason}` : ""}
              </div>
            </div>
            <ClinicStatusBadge status={c.status ?? ""} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function QuestionList({ items }: { items: CommunityQuestionRow[] }) {
  if (!items.length) {
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="질문 이력 없음"
        description="학생이 Q&A나 상담 글을 남기면 이곳에서 빠르게 추적할 수 있습니다."
      />
    );
  }
  const typeLabel: Record<string, string> = { qna: "질문", board: "게시글", notice: "공지", counsel: "상담", materials: "자료" };
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((p) => {
        const postType = p.post_type ?? "board";
        return (
        <Card key={p.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Badge tone="primary" size="xs">{typeLabel[postType] ?? postType}</Badge>
                <span className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>{p.title ?? "제목 없음"}</span>
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                {p.created_at ? new Date(p.created_at).toLocaleDateString("ko-KR") : ""}
                {(p.replies_count ?? 0) > 0 ? ` · 답변 ${p.replies_count ?? 0}개` : ""}
              </div>
            </div>
          </div>
        </Card>
        );
      })}
    </div>
  );
}

/* === Shared === */

function ContactBtn({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="flex-1 text-center text-[12px] font-semibold py-2 rounded-lg no-underline" style={{ background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
      {label}
    </a>
  );
}

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-[13px] shrink-0" style={{ color: "var(--tc-text-muted)" }}>{label}</span>
      {href ? (
        <a href={href} className="text-sm no-underline text-right" style={{ color: "var(--tc-primary)" }}>{value}</a>
      ) : (
        <span className="text-sm text-right truncate ml-3" style={{ color: "var(--tc-text)" }}>{value}</span>
      )}
    </div>
  );
}

function accountNotificationLabel(type: string): string {
  const labels: Record<string, string> = {
    registration_approved_student: "학생 아이디 안내",
    registration_approved_parent: "학부모 아이디 안내",
    password_reset_student: "학생 임시 비밀번호",
    password_reset_parent: "학부모 임시 비밀번호",
    "account.username_recovery": "아이디 안내",
    "account.password_recovery": "임시 비밀번호",
    "account.password_reset": "임시 비밀번호",
  };
  return labels[type] ?? (type || "계정 알림");
}

function isAccountNotificationSent(item: StudentAccountNotificationLog): boolean {
  const status = String(item.status || "").toLowerCase();
  return item.success === true || ["sent", "success", "delivered", "completed"].includes(status);
}

function AccountNotificationCard({ items }: { items: StudentAccountNotificationLog[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--tc-text)" }}>
          <MessageSquare size={ICON.sm} /> 계정 알림톡
        </h3>
        <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>최근 5건</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm m-0" style={{ color: "var(--tc-text-muted)" }}>
          최근 아이디/비밀번호 알림톡 이력이 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const sentAt = item.sent_at ? new Date(item.sent_at).toLocaleString("ko-KR", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }) : "";
            const ok = isAccountNotificationSent(item);
            return (
              <div key={item.id} className="flex items-start justify-between gap-2" style={{ borderTop: "1px solid var(--tc-border-subtle)", paddingTop: 8 }}>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate" style={{ color: "var(--tc-text)" }}>
                    {accountNotificationLabel(item.notification_type)}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: "var(--tc-text-muted)" }}>
                    {sentAt}{item.recipient_summary ? ` · ${item.recipient_summary}` : ""}
                  </div>
                  {!ok && item.failure_reason && (
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-danger)" }}>{item.failure_reason}</div>
                  )}
                </div>
                <Badge tone={ok ? "success" : "danger"}>{ok ? "발송완료" : "실패"}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ─── Memo Section (inline edit) ─── */
function MemoSection({ studentId, initialMemo }: { studentId: number; initialMemo: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initialMemo);

  const mutation = useMutation({
    mutationFn: () => updateStudentMemo(studentId, text),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.student(studentId) });
      teacherToast.success("메모가 저장되었습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "메모를 저장하지 못했습니다.")),
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>메모</h3>
        {!editing ? (
          <button onClick={() => { setEditing(true); setText(initialMemo); }}
            className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
            style={{ background: "none", border: "none", color: "var(--tc-primary)", padding: "2px 6px" }}>
            <Pencil size={ICON.xs} /> 편집
          </button>
        ) : (
          <div className="flex gap-1">
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
              className="flex items-center gap-0.5 text-[11px] font-bold cursor-pointer"
              style={{ background: "var(--tc-primary)", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "var(--tc-radius-sm)" }}>
              <Save size={10} /> 저장
            </button>
            <button onClick={() => setEditing(false)}
              className="flex items-center text-[11px] cursor-pointer"
              style={{ background: "var(--tc-surface-soft)", color: "var(--tc-text-muted)", border: "none", padding: "4px 8px", borderRadius: "var(--tc-radius-sm)" }}>
              취소
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
          className="w-full text-sm"
          style={{ padding: "8px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none", resize: "vertical" }} />
      ) : (
        <p className="text-sm m-0" style={{ color: initialMemo ? "var(--tc-text-secondary)" : "var(--tc-text-muted)", whiteSpace: "pre-wrap" }}>
          {initialMemo || "메모가 없습니다. 편집 버튼으로 추가하세요."}
        </p>
      )}
    </Card>
  );
}

/* ─── Edit Student BottomSheet ─── */
function EditStudentSheet({ open, onClose, student, studentId, onDelete, onOpenPasswordReset }: {
  open: boolean; onClose: () => void; student: ClientStudent; studentId: number; onDelete: () => void; onOpenPasswordReset: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [name, setName] = useState(student?.name ?? "");
  const [phone, setPhone] = useState(student?.studentPhone ?? "");
  const [parentPhone, setParentPhone] = useState(student?.parentPhone ?? "");
  const [school, setSchool] = useState(student?.school ?? "");
  const schoolType = student?.schoolType ?? "HIGH";
  const [grade, setGrade] = useState(student?.grade != null ? String(student.grade) : "");

  const mutation = useMutation({
    mutationFn: () => updateStudent(studentId, {
      name,
      phone,
      parent_phone: parentPhone,
      school_type: schoolType,
      school,
      school_class: student?.schoolClass ?? "",
      grade,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.student(studentId) });
      qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.students });
      qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.teacherStudents });
      teacherToast.success(`${name} 학생 정보가 수정되었습니다.`);
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, "학생 정보를 수정하지 못했습니다.")),
  });

  const toggleMut = useMutation({
    mutationFn: () => toggleStudentActive(studentId, !isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.student(studentId) });
      qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.students });
      qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.teacherStudents });
      teacherToast.success(isActive ? "학생이 비활성화되었습니다." : "학생이 활성화되었습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "상태를 변경하지 못했습니다.")),
  });

  const isActive = student?.active !== false;

  return (
    <BottomSheet open={open} onClose={onClose} title="학생 정보 편집">
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <EditField label="이름" value={name} onChange={setName} />
        <EditField label="학생 전화" value={phone} onChange={setPhone} type="tel" />
        <EditField label="학부모 전화" value={parentPhone} onChange={setParentPhone} type="tel" />
        <EditField label="학교" value={school} onChange={setSchool} />
        <EditField label="학년" value={grade} onChange={setGrade} />

        {/* Status toggle */}
        <div className="flex items-center justify-between py-2" style={{ borderTop: "1px solid var(--tc-border-subtle)" }}>
          <div>
            <span className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>학생 상태</span>
            <span className="text-[11px] ml-2" style={{ color: isActive ? "var(--tc-success)" : "var(--tc-text-muted)" }}>
              {isActive ? "활성" : "비활성"}
            </span>
          </div>
          <button onClick={async () => {
              const ok = await confirm({
                title: isActive ? "학생 비활성화" : "학생 활성화",
                message: isActive ? "이 학생을 비활성화하시겠습니까? 로그인이 차단됩니다." : "이 학생을 다시 활성화하시겠습니까?",
                confirmText: isActive ? "비활성화" : "활성화",
                danger: isActive,
              });
              if (ok) toggleMut.mutate();
            }}
            className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
            style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: isActive ? "var(--tc-success-bg)" : "var(--tc-danger-bg)", color: isActive ? "var(--tc-success)" : "var(--tc-danger)" }}>
            {isActive ? <ToggleRight size={ICON.xs} /> : <ToggleLeft size={ICON.xs} />}
            {isActive ? "활성" : "비활성"}
          </button>
        </div>

        <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim()}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff", opacity: mutation.isPending ? 0.6 : 1 }}>
          {mutation.isPending ? "저장 중…" : "저장"}
        </button>

        {/* Password reset */}
        <button onClick={onOpenPasswordReset}
          className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer"
          style={{ padding: "10px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text-secondary)" }}>
          <Lock size={ICON.sm} /> 비밀번호 초기화
        </button>

        {/* Delete */}
        <button onClick={async () => {
            const ok = await confirm({ title: "학생 삭제", message: "이 학생을 삭제하시겠습니까? 30일 이내 복구할 수 있습니다.", confirmText: "삭제", danger: true });
            if (ok) onDelete();
          }}
          className="w-full text-sm font-semibold cursor-pointer"
          style={{ padding: "10px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-danger)", background: "none", color: "var(--tc-danger)" }}>
          학생 삭제
        </button>
      </div>
    </BottomSheet>
  );
}

function EditField({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm"
        style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
    </div>
  );
}

/* ─── Tag Management BottomSheet ─── */
function TagManagementSheet({ open, onClose, studentId, currentTags }: {
  open: boolean; onClose: () => void; studentId: number; currentTags: ClientStudentTag[];
}) {
  const qc = useQueryClient();
  const [newTagName, setNewTagName] = useState("");

  const { data: allTags } = useQuery({
    queryKey: teacherStudentsQueryKeys.allTags,
    queryFn: fetchTags,
    enabled: open,
  });

  const attachMut = useMutation({
    mutationFn: (tagId: number) => attachTag(studentId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.student(studentId) }),
    onError: (e) => teacherToast.error(extractApiError(e, "태그를 추가하지 못했습니다.")),
  });

  const detachMut = useMutation({
    mutationFn: (tagId: number) => detachTag(studentId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.student(studentId) }),
    onError: (e) => teacherToast.error(extractApiError(e, "태그를 제거하지 못했습니다.")),
  });

  const createMut = useMutation({
    mutationFn: () => createTag(newTagName.trim()),
    onSuccess: (tag) => {
      setNewTagName("");
      qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.allTags });
      attachMut.mutate(tag.id);
    },
    onError: (e) => teacherToast.error(extractApiError(e, "태그를 생성하지 못했습니다.")),
  });

  const currentTagIds = new Set(currentTags.map((t) => t.id));
  const availableTags = (allTags ?? []).filter((t) => !currentTagIds.has(t.id));

  return (
    <BottomSheet open={open} onClose={onClose} title="태그 관리">
      <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-3) 0" }}>
        {/* Current tags */}
        <div>
          <div className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--tc-text-muted)" }}>현재 태그</div>
          <div className="flex flex-wrap gap-1">
            {currentTags.length === 0 && (
              <span className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>태그 없음</span>
            )}
            {currentTags.map((t) => (
              <button key={t.id} onClick={() => detachMut.mutate(t.id)}
                className="flex items-center gap-1 text-[12px] font-medium cursor-pointer"
                style={{ padding: "4px 10px", borderRadius: "var(--tc-radius-full)", border: "1px solid var(--tc-danger)", background: "var(--tc-danger-bg)", color: "var(--tc-danger)" }}>
                {t.name} <X size={10} />
              </button>
            ))}
          </div>
        </div>

        {/* Available tags to add */}
        {availableTags.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--tc-text-muted)" }}>추가 가능</div>
            <div className="flex flex-wrap gap-1">
              {availableTags.map((t) => (
                <button key={t.id} onClick={() => attachMut.mutate(t.id)}
                  className="flex items-center gap-1 text-[12px] font-medium cursor-pointer"
                  style={{ padding: "4px 10px", borderRadius: "var(--tc-radius-full)", border: "1px solid var(--tc-primary)", background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
                  <Plus size={10} /> {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Create new tag */}
        <div className="flex items-center gap-2" style={{ borderTop: "1px solid var(--tc-border-subtle)", paddingTop: "var(--tc-space-3)" }}>
          <input type="text" value={newTagName} onChange={(e) => setNewTagName(e.target.value)}
            placeholder="새 태그 이름"
            className="flex-1 text-sm"
            style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
          <button onClick={() => createMut.mutate()} disabled={!newTagName.trim() || createMut.isPending}
            className="text-xs font-bold cursor-pointer shrink-0"
            style={{ padding: "8px 14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff", opacity: !newTagName.trim() ? 0.5 : 1 }}>
            생성
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

/* ─── Password Reset BottomSheet ─── */
type PwTarget = "student" | "parent" | "both";

function PasswordResetSheet({ open, onClose, student }: {
  open: boolean; onClose: () => void; student: ClientStudent;
}) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<PwTarget>("student");
  const [tempPassword, setTempPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset form when opened
  useEffect(() => {
    if (open) { setTempPassword(""); setTarget("student"); }
  }, [open]);

  const name = student?.name ?? student?.displayName ?? "";
  const psNumber = student?.psNumber ?? "";
  const studentPhone = student?.studentPhone ?? "";
  const parentPhone = student?.parentPhone ?? "";
  const hasStudentAccount = !!psNumber || !!studentPhone;
  const hasParent = !!parentPhone;

  const handleSubmit = async () => {
    if (target === "student" && !hasStudentAccount) {
      teacherToast.error("학생 계정 정보가 없어 변경할 수 없습니다.");
      return;
    }
    if (target === "parent" && !hasParent) {
      teacherToast.error("학부모 번호가 없어 변경할 수 없습니다.");
      return;
    }
    setSubmitting(true);
    const targets: ("student" | "parent")[] = target === "both" ? ["student", "parent"] : [target];
    let ok = 0; let fail = 0; const failReasons: string[] = [];

    try {
      for (const t of targets) {
        try {
          if (t === "student") {
            if (!hasStudentAccount) { fail++; failReasons.push("학생 계정 정보 없음"); continue; }
            await sendPasswordReset({
              target: "student",
              student_name: name,
              ...(psNumber ? { student_ps_number: psNumber } : {}),
              ...(studentPhone ? { student_phone: studentPhone } : {}),
              ...(tempPassword.trim() ? { temp_password: tempPassword.trim() } : {}),
            });
          } else {
            if (!hasParent) { fail++; failReasons.push("학부모 번호 없음"); continue; }
            await sendPasswordReset({
              target: "parent",
              student_name: name,
              parent_phone: parentPhone,
              ...(tempPassword.trim() ? { temp_password: tempPassword.trim() } : {}),
            });
          }
          ok++;
        } catch {
          fail++;
        }
      }
      if (ok > 0) {
        teacherToast.success(`비밀번호 변경 완료 (${ok}건${fail > 0 ? `, 실패 ${fail}건` : ""}). 알림톡이 발송됩니다.`);
        qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.accountNotifications(student.id) });
        onClose();
      } else {
        teacherToast.error(`변경 실패${failReasons.length ? `: ${failReasons.join(", ")}` : ""}.`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const targetHelp =
    target === "student" ? "학생 로그인 비밀번호를 변경합니다." :
    target === "parent" ? "학부모 로그인 비밀번호를 변경합니다. (아이디 = 학부모 전화번호)" :
    "학생 + 학부모 비밀번호를 함께 변경합니다.";

  return (
    <BottomSheet open={open} onClose={onClose} title="비밀번호 초기화">
      <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-3) 0" }}>
        <div className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>
          <span style={{ color: "var(--tc-text-secondary)", fontWeight: 600 }}>{name}</span> 학생의 비밀번호를 변경합니다.
        </div>

        {/* 대상 선택 */}
        <div>
          <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--tc-text-muted)" }}>변경 대상</label>
          <div className="flex gap-1.5">
            {([
              { k: "student" as const, l: "학생", disabled: !hasStudentAccount },
              { k: "parent" as const, l: "학부모", disabled: !hasParent },
              { k: "both" as const, l: "둘 다", disabled: !hasStudentAccount || !hasParent },
            ]).map((opt) => (
              <button key={opt.k} onClick={() => !opt.disabled && setTarget(opt.k)} disabled={opt.disabled}
                className="flex-1 text-xs font-semibold cursor-pointer"
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--tc-radius-sm)",
                  border: `1px solid ${target === opt.k ? "var(--tc-primary)" : "var(--tc-border-strong)"}`,
                  background: target === opt.k ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                  color: opt.disabled ? "var(--tc-text-muted)" : target === opt.k ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                  opacity: opt.disabled ? 0.5 : 1,
                }}>
                {opt.l}
              </button>
            ))}
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: "var(--tc-text-muted)" }}>{targetHelp}</p>
        </div>

        {/* 임시 비밀번호 */}
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>임시 비밀번호</label>
          <input type="text" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)}
            placeholder="비워두면 자동 생성"
            className="w-full text-sm"
            style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
          <p className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
            입력하면 선택한 대상 모두에게 동일 비밀번호가 설정됩니다.
          </p>
        </div>

        {/* 알림톡 발송 안내 */}
        <div className="flex items-center justify-between py-1.5"
          style={{ padding: "10px 12px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-subtle)", background: "var(--tc-primary-bg)" }}>
          <div className="flex items-center gap-2">
            <MessageSquare size={ICON.xs} style={{ color: "var(--tc-primary)" }} />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--tc-text)" }}>임시 비밀번호 알림톡 자동 발송</div>
              <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                변경된 비밀번호 안내는 계정 보호를 위해 자동 발송됩니다.
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff", opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "변경 중…" : "비밀번호 변경"}
        </button>
      </div>
    </BottomSheet>
  );
}
