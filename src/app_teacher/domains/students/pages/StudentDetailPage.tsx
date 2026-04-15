// PATH: src/app_teacher/domains/students/pages/StudentDetailPage.tsx
// 학생 상세 — 카드 기반 + 퀵 액션(전화/문자)
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import { fetchStudent } from "../api";

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const sid = Number(studentId);

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", sid],
    queryFn: () => fetchStudent(sid),
    enabled: Number.isFinite(sid),
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!student)
    return <EmptyState scope="panel" tone="error" title="학생 정보를 찾을 수 없습니다" />;

  const name = student.name ?? student.displayName ?? "이름 없음";
  const phone = student.studentPhone ?? student.phone;
  const parentPhone = student.parentPhone ?? student.parent_phone;
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
        <h1 className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>
          학생 상세
        </h1>
      </div>

      {/* Profile */}
      <div
        className="flex flex-col items-center gap-3 rounded-xl"
        style={{
          background: "var(--tc-surface)",
          border: "1px solid var(--tc-border)",
          padding: "var(--tc-space-5)",
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
          style={{ background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}
        >
          {name[0]}
        </div>
        <div className="text-center">
          <div className="text-lg font-bold" style={{ color: "var(--tc-text)" }}>{name}</div>
          {sub && <div className="text-[13px] mt-0.5" style={{ color: "var(--tc-text-secondary)" }}>{sub}</div>}
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 mt-2">
          {phone && <ActionLink href={`tel:${phone}`} label="전화" color="var(--tc-primary)" bgColor="var(--tc-primary-bg)" />}
          {phone && <ActionLink href={`sms:${phone}`} label="문자" color="var(--tc-success)" bgColor="var(--tc-success-bg)" />}
          {parentPhone && <ActionLink href={`tel:${parentPhone}`} label="학부모" color="var(--tc-info)" bgColor="var(--tc-info-bg)" />}
        </div>
      </div>

      {/* Enrollments */}
      {student.enrollments?.length > 0 && (
        <div
          className="rounded-xl"
          style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}
        >
          <h3 className="text-sm font-bold mb-3" style={{ color: "var(--tc-text)" }}>수강 현황</h3>
          <div className="flex flex-col gap-2">
            {student.enrollments.map((e: any) => (
              <div key={e.id ?? e.lectureId} className="flex justify-between items-center py-1">
                <span className="text-sm" style={{ color: "var(--tc-text)" }}>{e.lectureName ?? e.lecture_title}</span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: e.status === "ACTIVE" ? "var(--tc-success)" : "var(--tc-text-muted)" }}
                >
                  {e.status === "ACTIVE" ? "수강 중" : "종료"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact */}
      <div
        className="rounded-xl"
        style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}
      >
        <h3 className="text-sm font-bold mb-3" style={{ color: "var(--tc-text)" }}>연락처</h3>
        {phone && <InfoRow label="학생" value={formatPhone(phone)} href={`tel:${phone}`} />}
        {parentPhone && <InfoRow label="학부모" value={formatPhone(parentPhone)} href={`tel:${parentPhone}`} />}
      </div>
    </div>
  );
}

function ActionLink({ href, label, color, bgColor }: { href: string; label: string; color: string; bgColor: string }) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-1 rounded-lg text-xs font-semibold no-underline"
      style={{ padding: "10px 20px", background: bgColor, color }}
    >
      {label}
    </a>
  );
}

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-[13px]" style={{ color: "var(--tc-text-muted)" }}>{label}</span>
      {href ? (
        <a href={href} className="text-sm no-underline" style={{ color: "var(--tc-primary)" }}>{value}</a>
      ) : (
        <span className="text-sm" style={{ color: "var(--tc-text)" }}>{value}</span>
      )}
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
