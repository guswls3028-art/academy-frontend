// PATH: src/app_teacher/domains/students/pages/StudentDetailPage.tsx
// 학생 상세 — 데스크톱 오버레이 정보 1:1 매칭
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { fetchStudent, fetchStudentExamResults } from "../api";

type Tab = "enrollments" | "exams" | "attendance";

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
    enabled: Number.isFinite(sid) && tab === "exams",
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!student)
    return <EmptyState scope="panel" tone="error" title="학생 정보를 찾을 수 없습니다" />;

  const name = student.name ?? student.displayName ?? "이름 없음";
  const parentPhone = student.parentPhone ?? student.parent_phone;
  const studentPhone = student.studentPhone ?? student.student_phone ?? student.phone;
  const enrollments = student.enrollments ?? [];
  const tags = student.tags ?? [];

  const sub = [
    student.grade != null ? `${student.grade}학년` : null,
    student.gender === "M" ? "남" : student.gender === "F" ? "여" : null,
    student.school,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>학생 상세</h1>
      </div>

      {/* Profile card */}
      <div
        className="rounded-xl"
        style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-5)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
            style={{ background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}
          >
            {name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-lg font-bold" style={{ color: "var(--tc-text)" }}>{name}</span>
              {enrollments.map((e: any) => (
                <LectureChip
                  key={e.id ?? e.lectureId}
                  lectureName={e.lectureName ?? e.lecture_title ?? ""}
                  color={e.lectureColor ?? e.lecture_color}
                  chipLabel={e.lectureChipLabel ?? e.lecture_chip_label}
                  size={18}
                />
              ))}
            </div>
            {sub && <div className="text-[13px] mt-0.5" style={{ color: "var(--tc-text-secondary)" }}>{sub}</div>}
            {student.psNumber && (
              <div className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
                ID: {student.psNumber}
                {student.omrCode ? ` · OMR: ${student.omrCode}` : ""}
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {tags.map((t: any) => (
              <span
                key={t.id}
                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: t.color ? `${t.color}22` : "var(--tc-surface-soft)",
                  color: t.color || "var(--tc-text-secondary)",
                }}
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div className="flex gap-2 mt-4">
          {parentPhone && (
            <ActionLink href={`tel:${parentPhone}`} label={`부모 ${formatPhone(parentPhone)}`} color="var(--tc-primary)" />
          )}
          {studentPhone && (
            <ActionLink href={`tel:${studentPhone}`} label={`학생 ${formatPhone(studentPhone)}`} color="var(--tc-success)" />
          )}
          {parentPhone && (
            <ActionLink href={`sms:${parentPhone}`} label="문자" color="var(--tc-info)" />
          )}
        </div>
      </div>

      {/* Contact + School info card */}
      <div
        className="rounded-xl"
        style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}
      >
        <h3 className="text-sm font-bold mb-2" style={{ color: "var(--tc-text)" }}>기본 정보</h3>
        {student.psNumber && <InfoRow label="아이디" value={student.psNumber} />}
        {student.omrCode && <InfoRow label="시험 식별코드" value={String(student.omrCode)} />}
        {parentPhone && <InfoRow label="학부모 전화" value={formatPhone(parentPhone)} href={`tel:${parentPhone}`} />}
        {studentPhone && <InfoRow label="학생 전화" value={formatPhone(studentPhone)} href={`tel:${studentPhone}`} />}
        {student.gender && <InfoRow label="성별" value={student.gender === "M" ? "남" : student.gender === "F" ? "여" : student.gender} />}
        {student.registeredAt && <InfoRow label="등록일" value={new Date(student.registeredAt).toLocaleDateString("ko-KR")} />}
        {student.address && <InfoRow label="주소" value={student.address} />}

        {/* School section */}
        {(student.school || student.grade != null) && (
          <>
            <div className="h-px mt-3 mb-2" style={{ background: "var(--tc-border)" }} />
            <h3 className="text-sm font-bold mb-2" style={{ color: "var(--tc-text)" }}>학교 정보</h3>
            {student.school && <InfoRow label="학교" value={student.school} />}
            {student.originMiddleSchool && <InfoRow label="출신중학교" value={student.originMiddleSchool} />}
            {student.grade != null && <InfoRow label="학년" value={`${student.grade}학년`} />}
            {student.schoolClass && <InfoRow label="반" value={student.schoolClass} />}
            {student.major && <InfoRow label="계열" value={student.major} />}
          </>
        )}
      </div>

      {/* Memo */}
      {student.memo && (
        <div
          className="rounded-xl"
          style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}
        >
          <h3 className="text-sm font-bold mb-2" style={{ color: "var(--tc-text)" }}>메모</h3>
          <p className="text-sm m-0" style={{ color: "var(--tc-text-secondary)", whiteSpace: "pre-wrap" }}>
            {student.memo}
          </p>
        </div>
      )}

      {/* Summary dashboard */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="수강" value={enrollments.filter((e: any) => e.status === "ACTIVE").length} total={enrollments.length} />
        <SummaryCard label="시험" value={examResults?.length ?? "-"} />
        <SummaryCard
          label="합격률"
          value={examResults?.length
            ? `${Math.round((examResults.filter((r: any) => r.is_pass).length / examResults.length) * 100)}%`
            : "-"
          }
          color={examResults?.length && examResults.filter((r: any) => r.is_pass).length > examResults.filter((r: any) => !r.is_pass).length ? "var(--tc-success)" : undefined}
        />
      </div>

      {/* Tabs */}
      <div
        className="flex rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--tc-border)", background: "var(--tc-surface-soft)" }}
      >
        {([
          { key: "enrollments" as Tab, label: "수강 이력" },
          { key: "exams" as Tab, label: "시험 성적" },
          { key: "attendance" as Tab, label: "출석" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 text-[13px] font-semibold py-2 cursor-pointer"
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
      {tab === "enrollments" && <EnrollmentTab enrollments={enrollments} />}
      {tab === "exams" && <ExamTab results={examResults ?? []} />}
      {tab === "attendance" && <AttendanceTab enrollments={enrollments} />}
    </div>
  );
}

/* === Tab panels === */

function EnrollmentTab({ enrollments }: { enrollments: any[] }) {
  if (!enrollments.length) return <EmptyState scope="panel" tone="empty" title="수강 이력이 없습니다" />;

  return (
    <div className="flex flex-col gap-1.5">
      {enrollments.map((e: any) => {
        const lecName = e.lectureName ?? e.lecture_title ?? "강의";
        const isActive = e.status === "ACTIVE";
        return (
          <div
            key={e.id ?? e.lectureId}
            className="flex items-center gap-3 rounded-xl"
            style={{ padding: "var(--tc-space-3) var(--tc-space-4)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
          >
            <LectureChip
              lectureName={lecName}
              color={e.lectureColor ?? e.lecture_color}
              chipLabel={e.lectureChipLabel ?? e.lecture_chip_label}
              size={24}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>{lecName}</div>
              {e.enrolledAt && (
                <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                  {new Date(e.enrolledAt).toLocaleDateString("ko-KR")} 등록
                </div>
              )}
            </div>
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
              style={{
                color: isActive ? "var(--tc-success)" : "var(--tc-text-muted)",
                background: isActive ? "var(--tc-success-bg)" : "var(--tc-surface-soft)",
              }}
            >
              {isActive ? "수강 중" : e.status === "PENDING" ? "대기" : "비활성"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ExamTab({ results }: { results: any[] }) {
  if (!results.length) return <EmptyState scope="panel" tone="empty" title="시험 성적이 없습니다" />;

  return (
    <div className="flex flex-col gap-1.5">
      {results.map((r: any) => {
        const passed = r.is_pass;
        const achievement = r.achievement;
        return (
          <div
            key={r.id}
            className="flex items-center gap-3 rounded-xl"
            style={{ padding: "var(--tc-space-3) var(--tc-space-4)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
          >
            {r.lecture_color && (
              <LectureChip
                lectureName={r.lecture_title ?? ""}
                color={r.lecture_color}
                chipLabel={r.lecture_chip_label}
                size={20}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>
                {r.exam_title ?? r.title ?? "시험"}
              </div>
              <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                {r.session_title && <span>{r.session_title}</span>}
                {r.retake_count > 0 && <span> · 재시험 {r.retake_count}회</span>}
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>
                {r.total_score ?? r.score ?? "-"}/{r.max_score ?? 100}
              </span>
              <AchievementBadge passed={passed} achievement={achievement} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AttendanceTab({ enrollments }: { enrollments: any[] }) {
  const activeEnrollments = enrollments.filter((e: any) => e.status === "ACTIVE");
  if (!activeEnrollments.length) return <EmptyState scope="panel" tone="empty" title="수강 중인 강의가 없습니다" />;

  return (
    <div className="flex flex-col gap-2">
      {activeEnrollments.map((e: any) => {
        const lecName = e.lectureName ?? e.lecture_title ?? "강의";
        return (
          <div
            key={e.id ?? e.lectureId}
            className="rounded-xl"
            style={{ padding: "var(--tc-space-3) var(--tc-space-4)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <LectureChip
                lectureName={lecName}
                color={e.lectureColor ?? e.lecture_color}
                chipLabel={e.lectureChipLabel ?? e.lecture_chip_label}
                size={18}
              />
              <span className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{lecName}</span>
            </div>
            <div className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>
              출석 정보는 각 차시에서 확인하세요
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* === Shared components === */

function AchievementBadge({ passed, achievement }: { passed?: boolean; achievement?: string }) {
  if (achievement === "REMEDIATED") {
    return <Badge label="보강합격" color="var(--tc-info)" />;
  }
  if (passed) {
    return <Badge label="합격" color="var(--tc-success)" />;
  }
  if (passed === false) {
    return <Badge label="불합격" color="var(--tc-danger)" />;
  }
  return null;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {label}
    </span>
  );
}

function SummaryCard({ label, value, total, color }: { label: string; value: number | string; total?: number; color?: string }) {
  return (
    <div
      className="rounded-xl flex flex-col items-center gap-0.5 py-3"
      style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
    >
      <span className="text-lg font-bold" style={{ color: color ?? "var(--tc-text)" }}>
        {value}
        {total != null && <span className="text-xs font-normal" style={{ color: "var(--tc-text-muted)" }}>/{total}</span>}
      </span>
      <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>{label}</span>
    </div>
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

function ActionLink({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <a
      href={href}
      className="flex-1 text-center text-[12px] font-semibold py-2 rounded-lg no-underline"
      style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
    >
      {label}
    </a>
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
