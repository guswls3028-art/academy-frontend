// PATH: src/features/sessions/components/SessionClinicTab.tsx
// 정규 클리닉 탭 — 차시별 클리닉 반 배정 현황 + 보강 대상 하이라이트
// section_mode=true일 때 CLINIC 섹션별 학생 그룹핑

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Stethoscope,
  Users,
  UserCheck,
  UserMinus,
  Calendar,
  MapPin,
  Clock,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

import {
  fetchSections,
  type Section,
  fetchSectionAssignments,
  type SectionAssignment,
} from "@/features/lectures/api/sections";
import { fetchSessions, type Session as LectureSession } from "@/features/lectures/api/sessions";
import {
  fetchSessionEnrollments,
  type SessionEnrollmentRow,
} from "@/features/lectures/api/enrollments";
import { useClinicTargets } from "@/features/clinic/hooks/useClinicTargets";
import type { ClinicTarget } from "@/features/clinic/api/clinicTargets";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { EmptyState, Button } from "@/shared/ui/ds";

/* ─── Constants ─── */

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

const REASON_LABEL: Record<string, string> = {
  exam: "시험 미통과",
  homework: "과제 미통과",
  both: "시험·과제 미통과",
};

/* ─── Types ─── */

interface ClinicSectionGroup {
  section: Section;
  clinicSession: LectureSession | null;
  students: EnrolledStudent[];
}

interface EnrolledStudent {
  enrollmentId: number;
  studentName: string;
  clinicTarget: ClinicTarget | null;
}

/* ─── Styles (CSS-in-module 패턴) ─── */

const styles = `
.clinic-tab__kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3, 12px);
}
@media (max-width: 1023px) {
  .clinic-tab__kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 639px) {
  .clinic-tab__kpi-grid { grid-template-columns: 1fr; }
}

.clinic-tab__kpi {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-radius: var(--radius-lg, 14px);
  border: 1px solid var(--color-border-divider);
  background: var(--color-bg-surface);
}
.clinic-tab__kpi-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--control-md, 32px);
  height: var(--control-md, 32px);
  border-radius: var(--radius-md, 10px);
  background: var(--color-bg-surface-sunken);
  flex-shrink: 0;
}
.clinic-tab__kpi-label {
  font-size: var(--text-sm, 12px);
  color: var(--color-text-muted);
  font-weight: 500;
  line-height: 1.3;
}
.clinic-tab__kpi-value {
  font-size: var(--text-xl, 18px);
  font-weight: 700;
  letter-spacing: -0.3px;
  line-height: 1.3;
  margin-top: 2px;
}
.clinic-tab__kpi-hint {
  font-size: var(--text-xs, 11px);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.clinic-tab__section {
  border-radius: var(--radius-xl, 18px);
  border: 1px solid var(--color-border-divider);
  background: var(--color-bg-surface);
  overflow: hidden;
  box-shadow: var(--elevation-1);
}
.clinic-tab__section--warn {
  border: 1px dashed var(--color-warning, #d97706);
}

.clinic-tab__section-header {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-bottom: 1px solid var(--color-border-divider);
  background: var(--color-bg-surface-sunken);
  flex-wrap: wrap;
}
.clinic-tab__section-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md, 10px);
  background: var(--color-brand-primary, #3b82f6);
  color: #fff;
  font-size: var(--text-sm, 12px);
  font-weight: 700;
  flex-shrink: 0;
}
.clinic-tab__section-badge--warn {
  background: var(--color-warning, #d97706);
}
.clinic-tab__section-info {
  flex: 1;
  min-width: 0;
}
.clinic-tab__section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  flex-wrap: wrap;
}
.clinic-tab__section-name {
  font-size: var(--text-md, 14px);
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
}
.clinic-tab__target-badge {
  font-size: var(--text-xs, 11px);
  font-weight: 600;
  padding: 1px 8px;
  border-radius: var(--radius-full, 999px);
  background: color-mix(in srgb, var(--color-error) 10%, transparent);
  color: var(--color-error, #ef4444);
  white-space: nowrap;
}
.clinic-tab__section-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  margin-top: 3px;
  font-size: var(--text-sm, 12px);
  color: var(--color-text-muted);
  flex-wrap: wrap;
}
.clinic-tab__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}
.clinic-tab__section-right {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  flex-shrink: 0;
}
.clinic-tab__count {
  font-size: var(--text-sm, 12px);
  font-weight: 500;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.clinic-tab__section-empty {
  padding: var(--space-6, 24px) var(--space-4, 16px);
  text-align: center;
  font-size: var(--text-sm, 12px);
  color: var(--color-text-muted);
}

/* Student row */
.clinic-tab__row {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-2, 8px) var(--space-4, 16px);
  border-bottom: 1px solid var(--color-border-divider);
  transition: background 120ms ease;
}
.clinic-tab__row:last-child {
  border-bottom: none;
}
.clinic-tab__row:hover {
  background: var(--color-bg-surface-hover, rgba(0,0,0,0.02));
}
.clinic-tab__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full, 999px);
  flex-shrink: 0;
}
.clinic-tab__dot--ok { background: var(--color-success, #10b981); }
.clinic-tab__dot--exam { background: var(--color-error, #ef4444); }
.clinic-tab__dot--hw { background: var(--color-warning, #d97706); }
.clinic-tab__dot--both { background: var(--color-error, #ef4444); }
.clinic-tab__name { flex: 1; min-width: 0; }

.clinic-tab__reason {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.clinic-tab__score {
  font-size: var(--text-sm, 12px);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.clinic-tab__score-fail {
  font-weight: 600;
  color: var(--color-error, #ef4444);
}
.clinic-tab__score-cut {
  color: var(--color-text-muted);
}
.clinic-tab__badge {
  font-size: var(--text-xs, 11px);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-full, 999px);
  white-space: nowrap;
}
.clinic-tab__badge--exam {
  background: color-mix(in srgb, var(--color-error) 8%, transparent);
  color: var(--color-error, #ef4444);
}
.clinic-tab__badge--hw {
  background: color-mix(in srgb, var(--color-warning) 8%, transparent);
  color: var(--color-warning, #d97706);
}
.clinic-tab__badge--both {
  background: color-mix(in srgb, var(--color-error) 8%, transparent);
  color: var(--color-error, #ef4444);
}
.clinic-tab__badge--ok {
  background: color-mix(in srgb, var(--color-success) 8%, transparent);
  color: var(--color-success, #10b981);
  font-weight: 500;
}

@media (max-width: 639px) {
  .clinic-tab__section-header { padding: var(--space-3, 12px); }
  .clinic-tab__row { padding: var(--space-2, 8px) var(--space-3, 12px); }
  .clinic-tab__reason { gap: var(--space-1, 4px); }
  .clinic-tab__score { font-size: var(--text-xs, 11px); }
}
`;

/* ─── Component ─── */

export default function SessionClinicTab({
  sessionId,
  lectureId,
}: {
  sessionId: number;
  lectureId: number;
}) {
  const navigate = useNavigate();

  const { data: currentSession, isLoading: sessionLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const { default: api } = await import("@/shared/api/axios");
      return (await api.get(`/lectures/sessions/${sessionId}/`)).data as LectureSession;
    },
    enabled: Number.isFinite(sessionId),
  });

  const { data: allSections = [], isLoading: sectionsLoading, isError: sectionsError } = useQuery<Section[]>({
    queryKey: ["lecture-sections", lectureId],
    queryFn: () => fetchSections(lectureId),
    enabled: Number.isFinite(lectureId),
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<SectionAssignment[]>({
    queryKey: ["section-assignments", lectureId],
    queryFn: () => fetchSectionAssignments(lectureId),
    enabled: Number.isFinite(lectureId),
  });

  const { data: sessionEnrollments = [], isLoading: enrollmentsLoading } = useQuery<SessionEnrollmentRow[]>({
    queryKey: ["session-enrollments", sessionId],
    queryFn: () => fetchSessionEnrollments(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  const { data: allSessions = [] } = useQuery<LectureSession[]>({
    queryKey: ["lecture-sessions", lectureId],
    queryFn: () => fetchSessions(lectureId),
    enabled: Number.isFinite(lectureId),
  });

  const { data: allTargets = [], isLoading: targetsLoading } = useClinicTargets();

  const isLoading = sessionLoading || sectionsLoading || assignmentsLoading || enrollmentsLoading;

  // ── 데이터 가공 ──

  const clinicSections = useMemo(
    () => allSections.filter((s) => s.section_type === "CLINIC" && s.is_active).sort((a, b) => a.label.localeCompare(b.label)),
    [allSections],
  );

  const currentOrder = currentSession?.order ?? 0;

  const clinicSessionMap = useMemo(() => {
    const map = new Map<number, LectureSession>();
    if (!currentOrder) return map;
    const ids = new Set(clinicSections.map((s) => s.id));
    for (const s of allSessions) {
      if (s.section && ids.has(s.section) && s.order === currentOrder) map.set(s.section, s);
    }
    return map;
  }, [allSessions, clinicSections, currentOrder]);

  const enrollClinicMap = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const a of assignments) map.set(a.enrollment, a.clinic_section);
    return map;
  }, [assignments]);

  const sessionTargetMap = useMemo(() => {
    const map = new Map<number, ClinicTarget>();
    for (const t of allTargets) {
      if (t.session_id === sessionId) {
        const existing = map.get(t.enrollment_id);
        if (existing) {
          if (existing.clinic_reason !== t.clinic_reason) {
            map.set(t.enrollment_id, { ...existing, clinic_reason: "both", exam_score: undefined, cutline_score: undefined, source_type: null });
          }
        } else {
          map.set(t.enrollment_id, t);
        }
      }
    }
    return map;
  }, [allTargets, sessionId]);

  const enrolledStudents: EnrolledStudent[] = useMemo(
    () => sessionEnrollments.map((se) => ({
      enrollmentId: se.enrollment,
      studentName: se.student_name,
      clinicTarget: targetsLoading ? null : (sessionTargetMap.get(se.enrollment) ?? null),
    })),
    [sessionEnrollments, sessionTargetMap, targetsLoading],
  );

  const sortStudents = (arr: EnrolledStudent[]) =>
    [...arr].sort((a, b) => {
      const at = a.clinicTarget ? 0 : 1;
      const bt = b.clinicTarget ? 0 : 1;
      return at !== bt ? at - bt : a.studentName.localeCompare(b.studentName);
    });

  const sectionGroups: ClinicSectionGroup[] = useMemo(
    () => clinicSections.map((section) => ({
      section,
      clinicSession: clinicSessionMap.get(section.id) ?? null,
      students: sortStudents(enrolledStudents.filter((s) => enrollClinicMap.get(s.enrollmentId) === section.id)),
    })),
    [clinicSections, enrolledStudents, enrollClinicMap, clinicSessionMap],
  );

  const unassignedStudents = useMemo(() => {
    const ids = new Set(clinicSections.map((s) => s.id));
    return sortStudents(enrolledStudents.filter((s) => {
      const cs = enrollClinicMap.get(s.enrollmentId);
      return cs == null || !ids.has(cs);
    }));
  }, [enrolledStudents, enrollClinicMap, clinicSections]);

  const stats = useMemo(() => {
    const total = enrolledStudents.length;
    const assigned = enrolledStudents.filter((s) => {
      const cs = enrollClinicMap.get(s.enrollmentId);
      return cs != null && clinicSections.some((sec) => sec.id === cs);
    }).length;
    const targets = enrolledStudents.filter((s) => s.clinicTarget != null).length;
    return { total, assigned, unassigned: total - assigned, targets };
  }, [enrolledStudents, enrollClinicMap, clinicSections]);

  // ── 로딩 / 에러 / 빈 상태 ──

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중..." />;
  if (sectionsError) return <EmptyState scope="panel" tone="error" title="데이터를 불러올 수 없습니다" description="새로고침해 주세요." />;
  if (clinicSections.length === 0) return <EmptyState scope="panel" tone="empty" title="클리닉 반이 설정되지 않았습니다" description="강의 상세 > 반 편성 관리에서 클리닉 반을 추가하세요." />;
  if (enrolledStudents.length === 0) return <EmptyState scope="panel" tone="empty" title="이 차시에 등록된 수강생이 없습니다" />;

  return (
    <>
      <style>{styles}</style>
      <div className="flex flex-col gap-5">
        {/* KPI */}
        <div className="clinic-tab__kpi-grid">
          <KPICard icon={<Users size={16} />} label="전체 수강생" value={stats.total} tone="default" />
          <KPICard icon={<UserCheck size={16} />} label="클리닉반 배정" value={stats.assigned} tone="success" />
          <KPICard icon={<UserMinus size={16} />} label="미배정" value={stats.unassigned} tone={stats.unassigned > 0 ? "warning" : "muted"} />
          <KPICard icon={<Stethoscope size={16} />} label="클리닉 대상" value={stats.targets} tone={stats.targets > 0 ? "error" : "muted"} hint={targetsLoading ? "확인 중..." : undefined} />
        </div>

        {/* 섹션별 그룹 */}
        {sectionGroups.map((g) => (
          <SectionCard key={g.section.id} group={g} lectureId={lectureId} navigate={navigate} />
        ))}

        {/* 미배정 학생 */}
        {unassignedStudents.length > 0 && (
          <div className="clinic-tab__section clinic-tab__section--warn">
            <div className="clinic-tab__section-header" style={{ background: "color-mix(in srgb, var(--color-warning) 4%, transparent)" }}>
              <div className="clinic-tab__section-badge clinic-tab__section-badge--warn">
                <AlertCircle size={14} />
              </div>
              <div className="clinic-tab__section-info">
                <div className="clinic-tab__section-name" style={{ color: "var(--color-warning, #d97706)" }}>
                  클리닉반 미배정
                </div>
              </div>
              <div className="clinic-tab__section-right">
                <span className="clinic-tab__count">{unassignedStudents.length}명</span>
              </div>
            </div>
            <div>
              {unassignedStudents.map((s) => <StudentRow key={s.enrollmentId} student={s} />)}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Sub-components ─── */

const TONE_COLORS: Record<string, string> = {
  default: "var(--color-text-primary)",
  success: "var(--color-success, #10b981)",
  warning: "var(--color-warning, #d97706)",
  error: "var(--color-error, #ef4444)",
  muted: "var(--color-text-muted)",
};

function KPICard({ icon, label, value, tone, hint }: {
  icon: React.ReactNode; label: string; value: number; tone: string; hint?: string;
}) {
  const color = TONE_COLORS[tone] ?? TONE_COLORS.default;
  return (
    <div className="clinic-tab__kpi">
      <div className="clinic-tab__kpi-icon" style={{ color }}>{icon}</div>
      <div>
        <div className="clinic-tab__kpi-label">{label}</div>
        <div className="clinic-tab__kpi-value" style={{ color }}>{value}</div>
        {hint && <div className="clinic-tab__kpi-hint">{hint}</div>}
      </div>
    </div>
  );
}

function SectionCard({ group, lectureId, navigate }: {
  group: ClinicSectionGroup; lectureId: number; navigate: ReturnType<typeof useNavigate>;
}) {
  const { section, clinicSession, students } = group;
  const targetCount = students.filter((s) => s.clinicTarget != null).length;

  return (
    <div className="clinic-tab__section">
      <div className="clinic-tab__section-header">
        <div className="clinic-tab__section-badge">{section.label}</div>
        <div className="clinic-tab__section-info">
          <div className="clinic-tab__section-title">
            <span className="clinic-tab__section-name">클리닉 {section.label}반</span>
            {targetCount > 0 && <span className="clinic-tab__target-badge">대상 {targetCount}명</span>}
          </div>
          <div className="clinic-tab__section-meta">
            <span className="clinic-tab__meta-item">
              <Calendar size={11} />{DAY_LABELS[section.day_of_week] ?? "?"}요일
            </span>
            <span className="clinic-tab__meta-item">
              <Clock size={11} />{section.start_time?.slice(0, 5)}{section.end_time ? ` ~ ${section.end_time.slice(0, 5)}` : ""}
            </span>
            {section.location && (
              <span className="clinic-tab__meta-item"><MapPin size={11} />{section.location}</span>
            )}
          </div>
        </div>
        <div className="clinic-tab__section-right">
          <span className="clinic-tab__count">{students.length}명</span>
          {clinicSession && (
            <Button
              intent="ghost"
              size="sm"
              rightIcon={<ChevronRight size={12} />}
              onClick={() => navigate(`/admin/lectures/${lectureId}/sessions/${clinicSession.id}/attendance`)}
            >
              클리닉 차시
            </Button>
          )}
        </div>
      </div>

      {students.length === 0 ? (
        <div className="clinic-tab__section-empty">배정된 학생이 없습니다</div>
      ) : (
        <div>{students.map((s) => <StudentRow key={s.enrollmentId} student={s} />)}</div>
      )}
    </div>
  );
}

function StudentRow({ student }: { student: EnrolledStudent }) {
  const t = student.clinicTarget;
  const isTarget = t != null;
  const reason = t?.clinic_reason ?? "";

  const dotClass = `clinic-tab__dot ${isTarget ? `clinic-tab__dot--${reason === "homework" ? "hw" : reason || "exam"}` : "clinic-tab__dot--ok"}`;

  const badgeClass = isTarget
    ? `clinic-tab__badge ${reason === "homework" ? "clinic-tab__badge--hw" : reason === "both" ? "clinic-tab__badge--both" : "clinic-tab__badge--exam"}`
    : "clinic-tab__badge clinic-tab__badge--ok";

  return (
    <div className="clinic-tab__row">
      <div className={dotClass} />
      <div className="clinic-tab__name">
        <StudentNameWithLectureChip
          name={student.studentName}
          clinicHighlight={isTarget}
          enrollmentId={student.enrollmentId}
          avatarSize={24}
        />
      </div>
      <div className="clinic-tab__reason">
        {isTarget && reason !== "both" && t.exam_score != null && t.cutline_score != null && (
          <span className="clinic-tab__score">
            {t.source_type === "homework" ? "과제" : "시험"}{" "}
            <span className="clinic-tab__score-fail">{t.exam_score}</span>
            <span className="clinic-tab__score-cut"> / {t.cutline_score}</span>
          </span>
        )}
        <span className={badgeClass}>
          {isTarget ? (REASON_LABEL[reason] ?? reason) : "정상"}
        </span>
      </div>
    </div>
  );
}
