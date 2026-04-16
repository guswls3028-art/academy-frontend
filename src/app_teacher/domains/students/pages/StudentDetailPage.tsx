// PATH: src/app_teacher/domains/students/pages/StudentDetailPage.tsx
// 학생 상세 — 데스크톱 오버레이 1:1 매칭 (5탭) + 편집/태그/메모/상태 관리
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { Phone, Mail, User, Pencil, Save, X, Tag, Plus, ToggleLeft, ToggleRight } from "@teacher/shared/ui/Icons";
import { Card, BackButton, KpiCard, TabBar } from "@teacher/shared/ui/Card";
import { Badge, AchievementBadge, AttendanceBadge, ClinicStatusBadge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { fetchStudent, fetchStudentExamResults, updateStudent, toggleStudentActive, fetchTags, attachTag, detachTag, createTag, updateStudentMemo } from "../api";
import api from "@/shared/api/axios";

type Tab = "enrollments" | "exams" | "homework" | "clinic" | "questions";

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sid = Number(studentId);
  const [tab, setTab] = useState<Tab>("enrollments");

  // Edit states
  const [editOpen, setEditOpen] = useState(false);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [memoEditing, setMemoEditing] = useState(false);
  const [memoText, setMemoText] = useState("");

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", sid],
    queryFn: () => fetchStudent(sid),
    enabled: Number.isFinite(sid),
  });

  const { data: examResults } = useQuery({
    queryKey: ["student-exams", sid],
    queryFn: () => fetchStudentExamResults(sid),
    enabled: Number.isFinite(sid),
  });

  const { data: clinicData } = useQuery({
    queryKey: ["student-clinic", sid],
    queryFn: async () => {
      const res = await api.get("/clinic/participants/", { params: { student: sid, page_size: 100 } });
      const raw = res.data;
      return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
    },
    enabled: Number.isFinite(sid) && tab === "clinic",
  });

  const { data: questionsData } = useQuery({
    queryKey: ["student-questions", sid],
    queryFn: async () => {
      const res = await api.get("/community/posts/", { params: { created_by: sid, page_size: 50, ordering: "-created_at" } });
      const raw = res.data;
      return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
    },
    enabled: Number.isFinite(sid) && tab === "questions",
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!student)
    return <EmptyState scope="panel" tone="error" title="학생 정보를 찾을 수 없습니다" />;

  const name = student.name ?? student.displayName ?? "이름 없음";
  const parentPhone = student.parentPhone ?? student.parent_phone;
  const studentPhone = student.studentPhone ?? student.student_phone ?? student.phone;
  const enrollments = student.enrollments ?? [];
  const tags = student.tags ?? [];
  const exams = examResults ?? [];
  const passCount = exams.filter((r: any) => r.is_pass).length;
  const failCount = exams.filter((r: any) => r.is_pass === false).length;

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
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0" style={{ background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
            {name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-lg font-bold" style={{ color: "var(--tc-text)" }}>{name}</span>
              {enrollments.map((e: any) => (
                <LectureChip key={e.id ?? e.lectureId} lectureName={e.lectureName ?? e.lecture_title ?? ""} color={e.lectureColor ?? e.lecture_color} chipLabel={e.lectureChipLabel ?? e.lecture_chip_label} size={18} />
              ))}
            </div>
            {student.psNumber && (
              <div className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
                ID: {student.psNumber}{student.omrCode ? ` · OMR: ${student.omrCode}` : ""}
              </div>
            )}
          </div>
          <button onClick={() => setEditOpen(true)}
            className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer shrink-0"
            style={{ padding: "5px 10px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
            <Pencil size={11} /> 편집
          </button>
        </div>

        {/* Tags — with management */}
        <div className="flex flex-wrap items-center gap-1 mt-3">
          {tags.map((t: any) => (
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
          {parentPhone && <ContactBtn href={`sms:${parentPhone}`} label="문자" />}
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

      {/* Memo — editable */}
      <MemoSection studentId={sid} initialMemo={student.memo ?? ""} />

      {/* Summary KPI */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard label="수강" value={enrollments.filter((e: any) => e.status === "ACTIVE").length} sub={`/${enrollments.length}`} />
        <KpiCard label="시험" value={exams.length} sub={exams.length > 0 ? `평균 ${Math.round(exams.reduce((s: number, r: any) => s + (r.total_score ?? r.score ?? 0), 0) / exams.length)}` : undefined} />
        <KpiCard label="합격률" value={exams.length ? `${Math.round((passCount / exams.length) * 100)}%` : "-"} color={passCount > failCount ? "var(--tc-success)" : undefined} />
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
      {tab === "exams" && <ExamList results={exams} />}
      {tab === "homework" && <HomeworkList results={exams.filter((r: any) => r.homework_id || r.type === "homework")} />}
      {tab === "clinic" && <ClinicList items={clinicData ?? []} />}
      {tab === "questions" && <QuestionList items={questionsData ?? []} />}

      {/* Edit Student BottomSheet */}
      <EditStudentSheet open={editOpen} onClose={() => setEditOpen(false)} student={student} studentId={sid} />

      {/* Tag Management BottomSheet */}
      <TagManagementSheet open={tagSheetOpen} onClose={() => setTagSheetOpen(false)} studentId={sid} currentTags={tags} />
    </div>
  );
}

/* === Tabs === */

function EnrollmentList({ enrollments }: { enrollments: any[] }) {
  if (!enrollments.length) return <EmptyState scope="panel" tone="empty" title="수강 이력 없음" />;
  return (
    <div className="flex flex-col gap-1.5">
      {enrollments.map((e: any) => (
        <Card key={e.id ?? e.lectureId} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
          <div className="flex items-center gap-2">
            <LectureChip lectureName={e.lectureName ?? e.lecture_title ?? ""} color={e.lectureColor ?? e.lecture_color} chipLabel={e.lectureChipLabel ?? e.lecture_chip_label} size={22} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>{e.lectureName ?? e.lecture_title}</div>
              {e.enrolledAt && <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>{new Date(e.enrolledAt).toLocaleDateString("ko-KR")}</div>}
            </div>
            <Badge tone={e.status === "ACTIVE" ? "success" : "neutral"}>{e.status === "ACTIVE" ? "수강 중" : e.status === "PENDING" ? "대기" : "비활성"}</Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ExamList({ results }: { results: any[] }) {
  if (!results.length) return <EmptyState scope="panel" tone="empty" title="시험 성적 없음" />;
  return (
    <div className="flex flex-col gap-1.5">
      {results.map((r: any) => (
        <Card key={r.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
          <div className="flex items-center gap-2">
            {r.lecture_color && <LectureChip lectureName={r.lecture_title ?? ""} color={r.lecture_color} chipLabel={r.lecture_chip_label} size={20} />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>{r.exam_title ?? r.title}</div>
              <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                {r.session_title}{r.retake_count > 0 ? ` · 재시험 ${r.retake_count}회` : ""}{r.submitted_at ? ` · ${new Date(r.submitted_at).toLocaleDateString("ko-KR")}` : ""}
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>{r.total_score ?? r.score ?? "-"}/{r.max_score ?? 100}</span>
              <AchievementBadge passed={r.is_pass} achievement={r.achievement} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function HomeworkList({ results }: { results: any[] }) {
  if (!results.length) return <EmptyState scope="panel" tone="empty" title="과제 이력 없음" />;
  return (
    <div className="flex flex-col gap-1.5">
      {results.map((r: any) => (
        <Card key={r.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
          <div className="flex items-center gap-2">
            {r.lecture_color && <LectureChip lectureName={r.lecture_title ?? ""} color={r.lecture_color} chipLabel={r.lecture_chip_label} size={20} />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>{r.title ?? r.homework_title}</div>
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

function ClinicList({ items }: { items: any[] }) {
  if (!items.length) return <EmptyState scope="panel" tone="empty" title="클리닉 이력 없음" />;
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((c: any) => (
        <Card key={c.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{c.session_title ?? "클리닉"}</div>
              <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                {c.session_date}{c.session_start_time ? ` ${c.session_start_time.slice(0, 5)}` : ""}{c.session_location ? ` · ${c.session_location}` : ""}
                {c.clinic_reason ? ` · ${c.clinic_reason}` : ""}
              </div>
            </div>
            <ClinicStatusBadge status={c.status} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function QuestionList({ items }: { items: any[] }) {
  if (!items.length) return <EmptyState scope="panel" tone="empty" title="질문 이력 없음" />;
  const typeLabel: Record<string, string> = { qna: "질문", board: "게시글", notice: "공지", counsel: "상담", materials: "자료" };
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((p: any) => (
        <Card key={p.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Badge tone="primary" size="xs">{typeLabel[p.post_type] ?? p.post_type}</Badge>
                <span className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>{p.title}</span>
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                {p.created_at ? new Date(p.created_at).toLocaleDateString("ko-KR") : ""}
                {p.replies_count > 0 ? ` · 답변 ${p.replies_count}` : ""}
              </div>
            </div>
          </div>
        </Card>
      ))}
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

/* ─── Memo Section (inline edit) ─── */
function MemoSection({ studentId, initialMemo }: { studentId: number; initialMemo: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initialMemo);

  const mutation = useMutation({
    mutationFn: () => updateStudentMemo(studentId, text),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["student", studentId] });
    },
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>메모</h3>
        {!editing ? (
          <button onClick={() => { setEditing(true); setText(initialMemo); }}
            className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
            style={{ background: "none", border: "none", color: "var(--tc-primary)", padding: "2px 6px" }}>
            <Pencil size={11} /> 편집
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
function EditStudentSheet({ open, onClose, student, studentId }: {
  open: boolean; onClose: () => void; student: any; studentId: number;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(student?.name ?? "");
  const [phone, setPhone] = useState(student?.studentPhone ?? student?.student_phone ?? student?.phone ?? "");
  const [parentPhone, setParentPhone] = useState(student?.parentPhone ?? student?.parent_phone ?? "");
  const [school, setSchool] = useState(student?.school ?? "");
  const [grade, setGrade] = useState(student?.grade ?? "");

  const mutation = useMutation({
    mutationFn: () => updateStudent(studentId, { name, phone, parent_phone: parentPhone, school, grade }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", studentId] });
      qc.invalidateQueries({ queryKey: ["teacher-students"] });
      onClose();
    },
  });

  const toggleMut = useMutation({
    mutationFn: () => toggleStudentActive(studentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", studentId] });
      qc.invalidateQueries({ queryKey: ["teacher-students"] });
    },
  });

  const isActive = student?.is_active !== false;

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
          <button onClick={() => { if (confirm(isActive ? "학생을 비활성화하시겠습니까?" : "학생을 다시 활성화하시겠습니까?")) toggleMut.mutate(); }}
            className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
            style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: isActive ? "var(--tc-success-bg)" : "var(--tc-danger-bg)", color: isActive ? "var(--tc-success)" : "var(--tc-danger)" }}>
            {isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            {isActive ? "활성" : "비활성"}
          </button>
        </div>

        <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim()}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff", opacity: mutation.isPending ? 0.6 : 1 }}>
          {mutation.isPending ? "저장 중..." : "저장"}
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
  open: boolean; onClose: () => void; studentId: number; currentTags: any[];
}) {
  const qc = useQueryClient();
  const [newTagName, setNewTagName] = useState("");

  const { data: allTags } = useQuery({
    queryKey: ["all-tags"],
    queryFn: fetchTags,
    enabled: open,
  });

  const attachMut = useMutation({
    mutationFn: (tagId: number) => attachTag(studentId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student", studentId] }),
  });

  const detachMut = useMutation({
    mutationFn: (tagId: number) => detachTag(studentId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student", studentId] }),
  });

  const createMut = useMutation({
    mutationFn: () => createTag(newTagName.trim()),
    onSuccess: (tag: any) => {
      setNewTagName("");
      qc.invalidateQueries({ queryKey: ["all-tags"] });
      attachMut.mutate(tag.id);
    },
  });

  const currentTagIds = new Set(currentTags.map((t: any) => t.id));
  const availableTags = (allTags ?? []).filter((t: any) => !currentTagIds.has(t.id));

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
            {currentTags.map((t: any) => (
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
              {availableTags.map((t: any) => (
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
