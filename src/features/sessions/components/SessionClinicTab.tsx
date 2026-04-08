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
import { EmptyState } from "@/shared/ui/ds";

/* ─── Constants ─── */

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

const REASON_LABEL: Record<string, string> = {
  exam: "시험 미통과",
  homework: "과제 미통과",
  both: "시험·과제 미통과",
};

const REASON_COLOR: Record<string, string> = {
  exam: "var(--color-error, #ef4444)",
  homework: "var(--color-warning, #d97706)",
  both: "var(--color-error, #ef4444)",
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

/* ─── Component ─── */

export default function SessionClinicTab({
  sessionId,
  lectureId,
}: {
  sessionId: number;
  lectureId: number;
}) {
  const navigate = useNavigate();

  // 현재 세션 정보
  const { data: currentSession, isLoading: sessionLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const { default: api } = await import("@/shared/api/axios");
      return (await api.get(`/lectures/sessions/${sessionId}/`)).data as LectureSession;
    },
    enabled: Number.isFinite(sessionId),
  });

  // 강의 전체 섹션 목록
  const { data: allSections = [], isLoading: sectionsLoading, isError: sectionsError } = useQuery<Section[]>({
    queryKey: ["lecture-sections", lectureId],
    queryFn: () => fetchSections(lectureId),
    enabled: Number.isFinite(lectureId),
  });

  // 섹션 배정 현황
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<SectionAssignment[]>({
    queryKey: ["section-assignments", lectureId],
    queryFn: () => fetchSectionAssignments(lectureId),
    enabled: Number.isFinite(lectureId),
  });

  // 차시 수강생 목록
  const { data: sessionEnrollments = [], isLoading: enrollmentsLoading } = useQuery<SessionEnrollmentRow[]>({
    queryKey: ["session-enrollments", sessionId],
    queryFn: () => fetchSessionEnrollments(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  // 강의 전체 세션 목록 (CLINIC 세션 매칭용)
  const { data: allSessions = [] } = useQuery<LectureSession[]>({
    queryKey: ["lecture-sessions", lectureId],
    queryFn: () => fetchSessions(lectureId),
    enabled: Number.isFinite(lectureId),
  });

  // 클리닉 대상자 (전체 → 이 세션 필터)
  const { data: allTargets = [], isLoading: targetsLoading } = useClinicTargets();

  // ── 로딩 상태 (P1/P2 fix: 데이터 로딩 중 잘못된 상태 표시 방지) ──
  const isLoading = sessionLoading || sectionsLoading || assignmentsLoading || enrollmentsLoading;

  // ── 데이터 가공 ──

  const clinicSections = useMemo(
    () =>
      allSections
        .filter((s) => s.section_type === "CLINIC" && s.is_active)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [allSections],
  );

  const currentOrder = currentSession?.order ?? 0;

  // 같은 차시(order)의 CLINIC 세션 매핑 (section_id → session)
  const clinicSessionMap = useMemo(() => {
    const map = new Map<number, LectureSession>();
    if (!currentOrder) return map;
    const sectionIdSet = new Set(clinicSections.map((s) => s.id));
    for (const s of allSessions) {
      if (s.section && sectionIdSet.has(s.section) && s.order === currentOrder) {
        map.set(s.section, s);
      }
    }
    return map;
  }, [allSessions, clinicSections, currentOrder]);

  // enrollment → clinic_section 매핑
  const enrollmentClinicSectionMap = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const a of assignments) {
      map.set(a.enrollment, a.clinic_section);
    }
    return map;
  }, [assignments]);

  // 이 세션의 클리닉 대상자 맵 (enrollment_id → target)
  // P6 fix: "both" 일 때 점수 표시 안 하도록 score 제거
  const sessionTargetMap = useMemo(() => {
    const map = new Map<number, ClinicTarget>();
    for (const t of allTargets) {
      if (t.session_id === sessionId) {
        const existing = map.get(t.enrollment_id);
        if (existing) {
          if (existing.clinic_reason !== t.clinic_reason) {
            map.set(t.enrollment_id, {
              ...existing,
              clinic_reason: "both",
              exam_score: undefined, // P6: "both"일 때 개별 점수 의미 없음
              cutline_score: undefined,
              source_type: null,
            });
          }
        } else {
          map.set(t.enrollment_id, t);
        }
      }
    }
    return map;
  }, [allTargets, sessionId]);

  // 수강생을 EnrolledStudent으로 변환
  const enrolledStudents: EnrolledStudent[] = useMemo(
    () =>
      sessionEnrollments.map((se) => ({
        enrollmentId: se.enrollment,
        studentName: se.student_name,
        clinicTarget: targetsLoading ? null : (sessionTargetMap.get(se.enrollment) ?? null),
      })),
    [sessionEnrollments, sessionTargetMap, targetsLoading],
  );

  // 섹션별 그룹핑
  const sectionGroups: ClinicSectionGroup[] = useMemo(() => {
    return clinicSections.map((section) => {
      const students = enrolledStudents.filter(
        (s) => enrollmentClinicSectionMap.get(s.enrollmentId) === section.id,
      );
      students.sort((a, b) => {
        const aTarget = a.clinicTarget ? 0 : 1;
        const bTarget = b.clinicTarget ? 0 : 1;
        if (aTarget !== bTarget) return aTarget - bTarget;
        return a.studentName.localeCompare(b.studentName);
      });
      return {
        section,
        clinicSession: clinicSessionMap.get(section.id) ?? null,
        students,
      };
    });
  }, [clinicSections, enrolledStudents, enrollmentClinicSectionMap, clinicSessionMap]);

  // 미배정 학생
  const unassignedStudents = useMemo(() => {
    const clinicSectionIds = new Set(clinicSections.map((s) => s.id));
    return enrolledStudents
      .filter((s) => {
        const cs = enrollmentClinicSectionMap.get(s.enrollmentId);
        return cs == null || !clinicSectionIds.has(cs);
      })
      .sort((a, b) => {
        const aTarget = a.clinicTarget ? 0 : 1;
        const bTarget = b.clinicTarget ? 0 : 1;
        if (aTarget !== bTarget) return aTarget - bTarget;
        return a.studentName.localeCompare(b.studentName);
      });
  }, [enrolledStudents, enrollmentClinicSectionMap, clinicSections]);

  // KPI 통계
  const stats = useMemo(() => {
    const total = enrolledStudents.length;
    const assigned = enrolledStudents.filter((s) => {
      const cs = enrollmentClinicSectionMap.get(s.enrollmentId);
      return cs != null && clinicSections.some((sec) => sec.id === cs);
    }).length;
    const targets = enrolledStudents.filter((s) => s.clinicTarget != null).length;
    return { total, assigned, unassigned: total - assigned, targets };
  }, [enrolledStudents, enrollmentClinicSectionMap, clinicSections]);

  // ── 로딩 / 에러 / 빈 상태 ── (P2 fix: 로딩 중 잘못된 empty state 방지)

  if (isLoading) {
    return <EmptyState scope="panel" tone="loading" title="불러오는 중..." />;
  }

  if (sectionsError) {
    return <EmptyState scope="panel" tone="error" title="데이터를 불러올 수 없습니다" description="새로고침해 주세요." />;
  }

  if (clinicSections.length === 0) {
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="클리닉 반이 설정되지 않았습니다"
        description="강의 상세 > 반 편성 관리에서 클리닉 반을 추가하세요."
      />
    );
  }

  if (enrolledStudents.length === 0) {
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="이 차시에 등록된 수강생이 없습니다"
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── KPI 요약 ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        <KPICard
          icon={<Users size={16} />}
          label="전체 수강생"
          value={stats.total}
          color="var(--color-text-primary)"
        />
        <KPICard
          icon={<UserCheck size={16} />}
          label="클리닉반 배정"
          value={stats.assigned}
          color="var(--color-success, #10b981)"
        />
        <KPICard
          icon={<UserMinus size={16} />}
          label="미배정"
          value={stats.unassigned}
          color={stats.unassigned > 0 ? "var(--color-warning, #d97706)" : "var(--color-text-muted)"}
        />
        <KPICard
          icon={<Stethoscope size={16} />}
          label="클리닉 대상"
          value={stats.targets}
          color={stats.targets > 0 ? "var(--color-error, #ef4444)" : "var(--color-text-muted)"}
          hint={targetsLoading ? "확인 중..." : undefined}
        />
      </div>

      {/* ── 섹션별 그룹 ── */}
      {sectionGroups.map((group) => (
        <SectionGroupCard
          key={group.section.id}
          group={group}
          lectureId={lectureId}
          onNavigateToClinicSession={(sid) =>
            navigate(`/admin/lectures/${lectureId}/sessions/${sid}/attendance`)
          }
        />
      ))}

      {/* ── 미배정 학생 ── */}
      {unassignedStudents.length > 0 && (
        <div
          style={{
            borderRadius: "var(--radius-xl, 12px)",
            border: "1px dashed var(--color-warning, #d97706)",
            background: "var(--color-bg-surface, #fff)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 18px",
              borderBottom: "1px solid var(--color-border-divider)",
              background: "rgba(217,119,6,0.04)",
            }}
          >
            <AlertCircle size={16} style={{ color: "var(--color-warning, #d97706)" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-warning, #d97706)" }}>
              클리닉반 미배정
            </span>
            <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>
              {unassignedStudents.length}명
            </span>
          </div>
          <div style={{ padding: "4px 0" }}>
            {unassignedStudents.map((student) => (
              <StudentRow key={student.enrollmentId} student={student} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function KPICard({
  icon,
  label,
  value,
  color,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderRadius: "var(--radius-lg, 10px)",
        border: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface, #fff)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "var(--color-bg-surface-sunken)",
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 500, lineHeight: 1.3 }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color,
            letterSpacing: "-0.3px",
            lineHeight: 1.3,
            marginTop: 2,
          }}
        >
          {value}
        </div>
        {hint && (
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>{hint}</div>
        )}
      </div>
    </div>
  );
}

function SectionGroupCard({
  group,
  lectureId,
  onNavigateToClinicSession,
}: {
  group: ClinicSectionGroup;
  lectureId: number;
  onNavigateToClinicSession: (sessionId: number) => void;
}) {
  const { section, clinicSession, students } = group;
  const targetCount = students.filter((s) => s.clinicTarget != null).length;

  return (
    <div
      style={{
        borderRadius: "var(--radius-xl, 12px)",
        border: "1px solid var(--color-border-default)",
        background: "var(--color-bg-surface, #fff)",
        overflow: "hidden",
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          borderBottom: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface-sunken)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--color-primary, #3b82f6)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {section.label}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>
              클리닉 {section.label}반
            </span>
            {targetCount > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "1px 7px",
                  borderRadius: 10,
                  background: "rgba(239,68,68,0.1)",
                  color: "var(--color-error, #ef4444)",
                }}
              >
                대상 {targetCount}명
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 3,
              fontSize: 12,
              color: "var(--color-text-muted)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Calendar size={11} />
              {DAY_LABELS[section.day_of_week] ?? "?"}요일
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Clock size={11} />
              {section.start_time?.slice(0, 5)}
              {section.end_time ? ` ~ ${section.end_time.slice(0, 5)}` : ""}
            </span>
            {section.location && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <MapPin size={11} />
                {section.location}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>
            {students.length}명
          </span>
          {clinicSession && (
            <button
              onClick={() => onNavigateToClinicSession(clinicSession.id)}
              className="ds-btn-ghost"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid var(--color-border-default)",
                background: "var(--color-bg-surface)",
                color: "var(--color-primary, #3b82f6)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
              title="클리닉 차시로 이동"
            >
              클리닉 차시
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Student List */}
      {students.length === 0 ? (
        <div style={{ padding: "24px 18px", textAlign: "center", fontSize: 13, color: "var(--color-text-muted)" }}>
          배정된 학생이 없습니다
        </div>
      ) : (
        <div style={{ padding: "4px 0" }}>
          {students.map((student) => (
            <StudentRow key={student.enrollmentId} student={student} />
          ))}
        </div>
      )}
    </div>
  );
}

function StudentRow({ student }: { student: EnrolledStudent }) {
  const target = student.clinicTarget;
  const isTarget = target != null;

  return (
    <div
      className="session-clinic-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 18px",
        borderBottom: "1px solid var(--color-border-divider)",
      }}
    >
      {/* 클리닉 대상 인디케이터 */}
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: isTarget
            ? (target.clinic_reason ? REASON_COLOR[target.clinic_reason] : "var(--color-error)")
            : "var(--color-success, #10b981)",
          flexShrink: 0,
        }}
      />

      {/* 학생 이름 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <StudentNameWithLectureChip
          name={student.studentName}
          clinicHighlight={isTarget}
          enrollmentId={student.enrollmentId}
          avatarSize={24}
        />
      </div>

      {/* 클리닉 사유 + 점수 */}
      {isTarget && target.clinic_reason && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* 점수 표시 — "both"일 때는 개별 점수 의미 없으므로 생략 */}
          {target.clinic_reason !== "both" && target.exam_score != null && target.cutline_score != null && (
            <span
              style={{
                fontSize: 12,
                color: "var(--color-text-secondary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {target.source_type === "homework" ? "과제" : "시험"}{" "}
              <span style={{ fontWeight: 600, color: "var(--color-error, #ef4444)" }}>
                {target.exam_score}
              </span>
              <span style={{ color: "var(--color-text-muted)" }}> / {target.cutline_score}</span>
            </span>
          )}

          {/* 사유 뱃지 */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 10,
              background:
                target.clinic_reason === "both"
                  ? "rgba(239,68,68,0.08)"
                  : target.clinic_reason === "homework"
                    ? "rgba(217,119,6,0.08)"
                    : "rgba(239,68,68,0.08)",
              color: REASON_COLOR[target.clinic_reason] ?? "var(--color-error)",
              whiteSpace: "nowrap",
            }}
          >
            {REASON_LABEL[target.clinic_reason] ?? target.clinic_reason}
          </span>
        </div>
      )}

      {/* 정상 뱃지 */}
      {!isTarget && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: 10,
            background: "rgba(16,185,129,0.08)",
            color: "var(--color-success, #10b981)",
          }}
        >
          정상
        </span>
      )}
    </div>
  );
}
