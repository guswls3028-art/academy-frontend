// PATH: src/app_teacher/domains/students/pages/StudentDetailPage.tsx
// 학생 상세 — 데스크톱 오버레이 1:1 매칭 (5탭)
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { Phone, Mail, User } from "@teacher/shared/ui/Icons";
import { Card, BackButton, KpiCard, TabBar } from "@teacher/shared/ui/Card";
import { Badge, AchievementBadge, AttendanceBadge, ClinicStatusBadge } from "@teacher/shared/ui/Badge";
import { fetchStudent, fetchStudentExamResults } from "../api";
import api from "@/shared/api/axios";

type Tab = "enrollments" | "exams" | "homework" | "clinic" | "questions";

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const sid = Number(studentId);
  const [tab, setTab] = useState<Tab>("enrollments");

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
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {tags.map((t: any) => (
              <Badge key={t.id} tone="neutral" pill>{t.name}</Badge>
            ))}
          </div>
        )}

        {/* Quick actions */}
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

      {/* Memo */}
      {student.memo && (
        <Card>
          <h3 className="text-sm font-bold mb-2" style={{ color: "var(--tc-text)" }}>메모</h3>
          <p className="text-sm m-0" style={{ color: "var(--tc-text-secondary)", whiteSpace: "pre-wrap" }}>{student.memo}</p>
        </Card>
      )}

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
