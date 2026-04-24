// PATH: src/app_admin/domains/lectures/pages/sections/SectionManagementPage.tsx
/**
 * 반 편성 — 수업 × 클리닉 매트릭스.
 *
 * 상단: 요약 바 (수업 N반 · 클리닉 M반 · 편성률)
 * 중단: 반 목록 (수업반 / 클리닉반 카드 리스트 + 편집/삭제 + 추가)
 * 하단: 편성 매트릭스 (수업반 × 클리닉반 셀 + 미배정 행/열)
 *
 * 기존 좌우 분할 UI 폐기 — 4조합을 한 눈에 볼 수 있도록 2차원 그리드로 재편.
 */
import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, BookOpen, Stethoscope, ArrowLeft, Wand2, UserPlus, AlertTriangle } from "lucide-react";
import api from "@/shared/api/axios";

import {
  fetchSections,
  createSection,
  updateSection,
  deleteSection,
  fetchSectionAssignments,
  autoAssignSections,
  type Section,
  type SectionAssignment,
} from "../../api/sections";
import { fetchLectureEnrollments } from "../../api/enrollments";
import { EmptyState, Button } from "@/shared/ui/ds";
import { DomainLayout } from "@/shared/ui/layout";
import { useSectionMode } from "@/shared/hooks/useSectionMode";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";

const DAY_OPTIONS = [
  { value: 0, label: "월" },
  { value: 1, label: "화" },
  { value: 2, label: "수" },
  { value: 3, label: "목" },
  { value: 4, label: "금" },
  { value: 5, label: "토" },
  { value: 6, label: "일" },
];

type SectionForm = {
  label: string;
  section_type: "CLASS" | "CLINIC";
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  max_capacity: string;
};

const EMPTY_FORM: SectionForm = {
  label: "",
  section_type: "CLASS",
  day_of_week: 2,
  start_time: "17:00",
  end_time: "",
  location: "",
  max_capacity: "",
};

/** 다음 반 이름 자동 제안: A, B, C ... */
function nextLabel(existing: Section[], type: "CLASS" | "CLINIC"): string {
  const used = new Set(existing.filter((s) => s.section_type === type).map((s) => s.label));
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (!used.has(ch)) return ch;
  return `${type === "CLASS" ? "수" : "클"}${used.size + 1}`;
}

type EnrollmentLite = {
  id: number;
  student: { id: number; name: string };
  status?: string;
};

export default function SectionManagementPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lecId = Number(lectureId);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { sectionMode, clinicMode } = useSectionMode();
  const showClinic = clinicMode === "regular";

  const [formOpen, setFormOpen] = useState<null | { editId: number | null; form: SectionForm }>(null);

  // ===== Data =====
  const { data: lecture } = useQuery({
    queryKey: ["lecture", lecId],
    queryFn: async () => (await api.get(`/lectures/lectures/${lecId}/`)).data,
    enabled: Number.isFinite(lecId),
  });

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<Section[]>({
    queryKey: ["lecture-sections", lecId],
    queryFn: () => fetchSections(lecId),
    enabled: Number.isFinite(lecId),
  });

  const { data: assignments = [], isLoading: assignLoading } = useQuery<SectionAssignment[]>({
    queryKey: ["section-assignments", lecId],
    queryFn: () => fetchSectionAssignments(lecId),
    enabled: Number.isFinite(lecId),
  });

  const { data: enrollments = [], isLoading: enrollLoading } = useQuery<EnrollmentLite[]>({
    queryKey: ["lecture-enrollments", lecId],
    queryFn: () => fetchLectureEnrollments(lecId) as Promise<EnrollmentLite[]>,
    enabled: Number.isFinite(lecId),
  });

  // ===== Mutations =====
  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["lecture-sections", lecId] });
    qc.invalidateQueries({ queryKey: ["section-assignments", lecId] });
    qc.invalidateQueries({ queryKey: ["lecture-enrollments", lecId] });
  }, [qc, lecId]);

  const createMut = useMutation({
    mutationFn: (data: Parameters<typeof createSection>[0]) => createSection(data),
    onSuccess: () => { invalidate(); setFormOpen(null); feedback.success("반을 추가했습니다."); },
    onError: () => feedback.error("반 추가 실패. 같은 이름의 반이 이미 있을 수 있습니다."),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateSection>[1] }) =>
      updateSection(id, data),
    onSuccess: () => { invalidate(); setFormOpen(null); feedback.success("반을 수정했습니다."); },
    onError: () => feedback.error("반 수정 실패."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteSection(id),
    onSuccess: () => { invalidate(); feedback.success("반을 삭제했습니다."); },
    onError: () => feedback.error("편성된 학생이 있어 삭제할 수 없습니다."),
  });

  const autoAssignMut = useMutation({
    mutationFn: async () => {
      const r1 = await autoAssignSections(lecId, "CLASS");
      const r2 = showClinic ? await autoAssignSections(lecId, "CLINIC") : { assigned: 0, message: "" };
      return { classCount: r1.assigned ?? 0, clinicCount: r2.assigned ?? 0 };
    },
    onSuccess: (r) => {
      invalidate();
      const msg = showClinic
        ? `수업 ${r.classCount}명 · 클리닉 ${r.clinicCount}명 자동배정 완료`
        : `수업 ${r.classCount}명 자동배정 완료`;
      feedback.success(msg);
    },
    onError: () => feedback.error("자동배정 실패."),
  });

  const upsertAssignmentMut = useMutation({
    mutationFn: async (args: { enrollmentId: number; classSectionId: number | null; clinicSectionId: number | null }) => {
      const existing = assignments.find((a) => a.enrollment === args.enrollmentId);
      if (existing) {
        // PATCH
        const payload: Record<string, number | null | string> = { source: "MANUAL" };
        if (args.classSectionId !== null) payload.class_section = args.classSectionId;
        if (args.clinicSectionId !== undefined) payload.clinic_section = args.clinicSectionId;
        const res = await api.patch(`/lectures/section-assignments/${existing.id}/`, payload);
        return res.data;
      } else {
        if (args.classSectionId == null) {
          throw new Error("수업반이 먼저 지정되어야 합니다.");
        }
        const res = await api.post("/lectures/section-assignments/", {
          enrollment: args.enrollmentId,
          class_section: args.classSectionId,
          clinic_section: args.clinicSectionId,
          source: "MANUAL",
        });
        return res.data;
      }
    },
    onSuccess: () => { invalidate(); feedback.success("학생을 이동했습니다."); },
    onError: (e: any) => feedback.error(e?.message || "이동 실패"),
  });

  const deleteAssignmentMut = useMutation({
    mutationFn: async (enrollmentId: number) => {
      const existing = assignments.find((a) => a.enrollment === enrollmentId);
      if (!existing) return;
      await api.delete(`/lectures/section-assignments/${existing.id}/`);
    },
    onSuccess: () => { invalidate(); feedback.success("편성을 해제했습니다."); },
    onError: () => feedback.error("편성 해제 실패."),
  });

  // ===== Derived =====
  const classSections = useMemo(
    () => sections.filter((s) => s.section_type === "CLASS").sort((a, b) => a.label.localeCompare(b.label)),
    [sections],
  );
  const clinicSections = useMemo(
    () => sections.filter((s) => s.section_type === "CLINIC").sort((a, b) => a.label.localeCompare(b.label)),
    [sections],
  );

  const assignmentByEnrollment = useMemo(() => {
    const map = new Map<number, SectionAssignment>();
    for (const a of assignments) map.set(a.enrollment, a);
    return map;
  }, [assignments]);

  const totalStudents = enrollments.length;
  const classAssignedCount = enrollments.filter((e) => assignmentByEnrollment.get(e.id)?.class_section != null).length;
  const clinicAssignedCount = enrollments.filter((e) => assignmentByEnrollment.get(e.id)?.clinic_section != null).length;

  // ===== Access gate =====
  if (!sectionMode) {
    return (
      <DomainLayout
        title="반 편성"
        description="이 학원은 반 편성 모드를 사용하지 않습니다."
        breadcrumbs={[
          { label: "강의", to: "/admin/lectures" },
          { label: lecture?.title ?? lecture?.name ?? "강의", to: `/admin/lectures/${lecId}` },
          { label: "반 편성" },
        ]}
      >
        <EmptyState
          scope="page"
          tone="empty"
          title="반 편성 모드가 꺼져 있습니다"
          description="같은 강의를 A/B 반으로 나눠 운영하고 싶다면 운영자에게 반 편성 모드 활성화를 문의하세요."
          actions={
            <Button intent="secondary" onClick={() => navigate(`/admin/lectures/${lecId}`)}>
              강의로 돌아가기
            </Button>
          }
        />
      </DomainLayout>
    );
  }

  if (!Number.isFinite(lecId)) {
    return <div className="p-4 text-sm" style={{ color: "var(--color-error)" }}>강의 정보를 찾을 수 없습니다.</div>;
  }

  const isLoading = sectionsLoading || assignLoading || enrollLoading;

  // ===== Form handlers =====
  const openCreate = (type: "CLASS" | "CLINIC") => {
    setFormOpen({
      editId: null,
      form: {
        ...EMPTY_FORM,
        section_type: type,
        label: nextLabel(sections, type),
        day_of_week: type === "CLASS" ? 2 : 5,
        start_time: type === "CLASS" ? "17:00" : "19:00",
      },
    });
  };

  const openEdit = (sec: Section) => {
    setFormOpen({
      editId: sec.id,
      form: {
        label: sec.label,
        section_type: sec.section_type,
        day_of_week: sec.day_of_week,
        start_time: sec.start_time?.slice(0, 5) ?? "17:00",
        end_time: sec.end_time?.slice(0, 5) ?? "",
        location: sec.location ?? "",
        max_capacity: sec.max_capacity != null ? String(sec.max_capacity) : "",
      },
    });
  };

  const handleDelete = async (sec: Section) => {
    const ok = await confirm({
      title: `${sec.section_type === "CLASS" ? "수업" : "클리닉"} ${sec.label}반 삭제`,
      message: "편성된 학생이 있으면 삭제할 수 없습니다. 진행하시겠습니까?",
      confirmText: "삭제",
    });
    if (!ok) return;
    deleteMut.mutate(sec.id);
  };

  const submitForm = () => {
    if (!formOpen) return;
    const { editId, form } = formOpen;
    const label = form.label.trim();
    if (!label) return;
    const payload = {
      lecture: lecId,
      label,
      section_type: form.section_type,
      day_of_week: form.day_of_week,
      start_time: form.start_time,
      end_time: form.end_time || null,
      location: form.location,
      max_capacity: form.max_capacity ? Number(form.max_capacity) : null,
    };
    if (editId) updateMut.mutate({ id: editId, data: payload });
    else createMut.mutate(payload);
  };

  // ===== Cell build: (classSectionId or null, clinicSectionId or null) → EnrollmentLite[] =====
  type CellKey = string; // `${classId|'U'}__${clinicId|'U'}`
  const cellKey = (c: number | null, k: number | null): CellKey =>
    `${c ?? "U"}__${k ?? "U"}`;
  const matrix = useMemo(() => {
    const m = new Map<CellKey, EnrollmentLite[]>();
    for (const e of enrollments) {
      const a = assignmentByEnrollment.get(e.id);
      const key = cellKey(a?.class_section ?? null, a?.clinic_section ?? null);
      const arr = m.get(key) ?? [];
      arr.push(e);
      m.set(key, arr);
    }
    return m;
  }, [enrollments, assignmentByEnrollment]);

  const breadcrumbs = [
    { label: "강의", to: "/admin/lectures" },
    { label: lecture?.title ?? lecture?.name ?? "강의", to: `/admin/lectures/${lecId}` },
    { label: "반 편성" },
  ];

  return (
    <DomainLayout
      title="반 편성"
      description={`${lecture?.title ?? lecture?.name ?? "강의"} · 수업×클리닉 매트릭스`}
      breadcrumbs={breadcrumbs}
    >
      <div className="flex flex-col gap-6">
        {/* ===== 클리닉 미편성 경고 배너 (정규형 전용) ===== */}
        {showClinic && clinicSections.length > 0 && totalStudents > 0 && clinicAssignedCount < totalStudents && (
          <div
            className="rounded-xl p-3 flex items-center gap-3"
            style={{
              background: "color-mix(in srgb, var(--color-warning, #d97706) 8%, var(--color-bg-surface))",
              border: "1px solid color-mix(in srgb, var(--color-warning, #d97706) 35%, var(--color-border-divider))",
            }}
            role="alert"
          >
            <AlertTriangle size={18} style={{ color: "var(--color-warning, #d97706)", flexShrink: 0 }} />
            <div className="flex-1">
              <div className="text-[13px] font-bold" style={{ color: "var(--color-warning, #d97706)" }}>
                클리닉반 미편성 학생 {totalStudents - clinicAssignedCount}명
              </div>
              <div className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                정규형 클리닉은 모든 학생이 클리닉반에 편성되어야 합니다. 자동배정 또는 아래 매트릭스에서 수동 이동하세요.
              </div>
            </div>
            <Button
              intent="primary"
              size="sm"
              onClick={() => autoAssignMut.mutate()}
              disabled={autoAssignMut.isPending || classSections.length === 0}
              leftIcon={<Wand2 size={13} />}
            >
              자동배정
            </Button>
          </div>
        )}

        {/* ===== 요약 + 액션 ===== */}
        <div
          className="rounded-xl p-4 flex items-center justify-between flex-wrap gap-3"
          style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-divider)" }}
        >
          <div className="flex items-center gap-5 flex-wrap">
            <SummaryStat label="전체 학생" value={totalStudents} />
            <Divider />
            <SummaryStat
              label="수업반 편성"
              value={`${classAssignedCount}/${totalStudents}`}
              tone={classAssignedCount < totalStudents ? "warning" : "ok"}
            />
            {showClinic && (
              <>
                <Divider />
                <SummaryStat
                  label="클리닉반 편성"
                  value={`${clinicAssignedCount}/${totalStudents}`}
                  tone={clinicAssignedCount < totalStudents ? "warning" : "ok"}
                />
              </>
            )}
            <Divider />
            <SummaryStat label="수업반" value={`${classSections.length}개`} />
            {showClinic && <SummaryStat label="클리닉반" value={`${clinicSections.length}개`} />}
          </div>
          <div className="flex items-center gap-2">
            <Button
              intent="secondary"
              size="sm"
              onClick={() => navigate(`/admin/lectures/${lecId}`)}
              leftIcon={<ArrowLeft size={14} />}
            >
              강의로
            </Button>
            <Button
              intent="primary"
              size="sm"
              onClick={() => autoAssignMut.mutate()}
              disabled={autoAssignMut.isPending || classSections.length === 0}
              leftIcon={<Wand2 size={14} />}
            >
              {autoAssignMut.isPending ? "배정 중..." : "미편성 자동배정"}
            </Button>
          </div>
        </div>

        {/* ===== 반 카드 (수업/클리닉) ===== */}
        <div className="grid gap-4" style={{ gridTemplateColumns: showClinic ? "1fr 1fr" : "1fr" }}>
          <SectionListCard
            title="수업반"
            icon={<BookOpen size={16} />}
            tone="brand"
            sections={classSections}
            isLoading={isLoading}
            onAdd={() => openCreate("CLASS")}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
          {showClinic && (
            <SectionListCard
              title="클리닉반 (필수)"
              icon={<Stethoscope size={16} />}
              tone="warning"
              sections={clinicSections}
              isLoading={isLoading}
              onAdd={() => openCreate("CLINIC")}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        </div>

        {/* ===== 매트릭스 ===== */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-divider)" }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ background: "var(--color-bg-surface-sunken)", borderBottom: "1px solid var(--color-border-divider)" }}
          >
            <span className="text-[14px] font-bold" style={{ color: "var(--color-text-primary)" }}>
              편성 매트릭스
            </span>
            <span className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
              셀을 클릭하면 학생을 이동할 수 있습니다.
            </span>
          </div>

          {isLoading ? (
            <EmptyState scope="panel" tone="loading" title="불러오는 중..." />
          ) : classSections.length === 0 ? (
            <EmptyState
              scope="panel"
              tone="empty"
              title="수업반을 먼저 추가하세요"
              description="반을 1개 이상 만들면 여기에 편성 매트릭스가 나타납니다."
              actions={<Button intent="primary" size="sm" onClick={() => openCreate("CLASS")}>수업반 추가</Button>}
            />
          ) : (
            <MatrixGrid
              classSections={classSections}
              clinicSections={showClinic ? clinicSections : []}
              matrix={matrix}
              sections={sections}
              assignments={assignments}
              enrollments={enrollments}
              onMove={(enrollmentId, classId, clinicId) =>
                upsertAssignmentMut.mutate({ enrollmentId, classSectionId: classId, clinicSectionId: clinicId })
              }
              onClearAssignment={(enrollmentId) => deleteAssignmentMut.mutate(enrollmentId)}
              showClinic={showClinic}
              busy={upsertAssignmentMut.isPending || deleteAssignmentMut.isPending}
            />
          )}
        </div>
      </div>

      {/* ===== 반 추가/편집 모달 ===== */}
      {formOpen && (
        <SectionFormModal
          editId={formOpen.editId}
          form={formOpen.form}
          onChange={(f) => setFormOpen({ ...formOpen, form: f })}
          onSubmit={submitForm}
          onClose={() => setFormOpen(null)}
          pending={createMut.isPending || updateMut.isPending}
          showClinicType={showClinic}
        />
      )}
    </DomainLayout>
  );
}

/* =================== Sub-components =================== */

function Divider() {
  return <span style={{ width: 1, height: 20, background: "var(--color-border-divider)" }} />;
}

function SummaryStat({ label, value, tone = "default" }: {
  label: string; value: string | number; tone?: "default" | "ok" | "warning";
}) {
  const valueColor =
    tone === "warning" ? "var(--color-warning, #d97706)" :
    tone === "ok" ? "var(--color-success, #16a34a)" :
    "var(--color-text-primary)";
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span className="text-[16px] font-bold tabular-nums" style={{ color: valueColor }}>{value}</span>
    </div>
  );
}

function SectionListCard({
  title, icon, tone, sections, isLoading, onAdd, onEdit, onDelete,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "brand" | "warning";
  sections: Section[];
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (s: Section) => void;
  onDelete: (s: Section) => void;
}) {
  const accent = tone === "brand" ? "var(--color-brand-primary)" : "var(--color-warning, #d97706)";
  const accentBg = `color-mix(in srgb, ${accent} 8%, var(--color-bg-surface))`;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-divider)" }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: accentBg, borderBottom: `1px solid color-mix(in srgb, ${accent} 15%, transparent)` }}
      >
        <div className="flex items-center gap-2" style={{ color: accent }}>
          <span>{icon}</span>
          <span className="text-[14px] font-bold">{title}</span>
          <span className="text-[12px] font-semibold" style={{ color: "var(--color-text-muted)" }}>
            {sections.length}개
          </span>
        </div>
        <Button intent="ghost" size="sm" onClick={onAdd} leftIcon={<Plus size={13} />}>반 추가</Button>
      </div>

      <div className="p-3 flex flex-col gap-2" style={{ minHeight: 120 }}>
        {isLoading ? (
          <div className="text-center py-6 text-[13px]" style={{ color: "var(--color-text-muted)" }}>불러오는 중...</div>
        ) : sections.length === 0 ? (
          <div
            className="text-center py-6 text-[13px] rounded-lg"
            style={{ color: "var(--color-text-muted)", border: "1px dashed var(--color-border-divider)" }}
          >
            등록된 반이 없습니다
          </div>
        ) : (
          sections.map((sec) => (
            <div
              key={sec.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ background: "var(--color-bg-surface-sunken)", border: "1px solid var(--color-border-divider)" }}
            >
              <span
                className="inline-flex items-center justify-center text-[13px] font-bold"
                style={{ minWidth: 32, height: 28, background: accent, color: "#fff", borderRadius: 6, padding: "0 8px" }}
              >
                {sec.label}
              </span>
              <div className="flex-1 flex flex-col">
                <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {sec.day_of_week_display} {sec.start_time?.slice(0, 5)}
                  {sec.end_time ? ` ~ ${sec.end_time.slice(0, 5)}` : ""}
                </span>
                <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                  {sec.location ? `${sec.location} · ` : ""}정원 {sec.max_capacity ?? "무제한"} · 현재 {sec.assignment_count}명
                </span>
              </div>
              <button
                onClick={() => onEdit(sec)}
                className="p-1.5 rounded hover:bg-[var(--color-bg-surface-hover)]"
                style={{ color: "var(--color-text-muted)" }}
                aria-label={`${sec.label}반 수정`}
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onDelete(sec)}
                className="p-1.5 rounded hover:bg-[var(--color-bg-surface-hover)]"
                style={{ color: "var(--color-error)" }}
                aria-label={`${sec.label}반 삭제`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MatrixGrid({
  classSections, clinicSections, matrix, sections, assignments, enrollments,
  onMove, onClearAssignment, showClinic, busy,
}: {
  classSections: Section[];
  clinicSections: Section[];
  matrix: Map<string, EnrollmentLite[]>;
  sections: Section[];
  assignments: SectionAssignment[];
  enrollments: EnrollmentLite[];
  onMove: (enrollmentId: number, classId: number | null, clinicId: number | null) => void;
  onClearAssignment: (enrollmentId: number) => void;
  showClinic: boolean;
  busy: boolean;
}) {
  const clinicCols: Array<Section | null> = showClinic
    ? clinicSections.length > 0
      ? [...clinicSections, null] // null = 미배정 열
      : [null]
    : [null];

  const rowSections: Array<Section | null> = [...classSections, null]; // null = 수업반 미배정

  const getCell = (classSec: Section | null, clinicSec: Section | null) =>
    matrix.get(`${classSec?.id ?? "U"}__${clinicSec?.id ?? "U"}`) ?? [];

  const assignmentByEnrollment = useMemo(() => {
    const m = new Map<number, SectionAssignment>();
    for (const a of assignments) m.set(a.enrollment, a);
    return m;
  }, [assignments]);

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full text-[13px]"
        style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: 560 }}
      >
        <thead>
          <tr>
            <th
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid var(--color-border-divider)",
                borderRight: "1px solid var(--color-border-divider)",
                background: "var(--color-bg-surface-sunken)",
                textAlign: "left",
                fontSize: 11,
                color: "var(--color-text-muted)",
                fontWeight: 600,
                width: 140,
              }}
            >
              수업 \ 클리닉
            </th>
            {clinicCols.map((c) => (
              <th
                key={c?.id ?? "U"}
                style={{
                  padding: "10px 8px",
                  borderBottom: "1px solid var(--color-border-divider)",
                  background: "var(--color-bg-surface-sunken)",
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: c == null ? "var(--color-text-muted)" : "var(--color-warning, #d97706)",
                  minWidth: 140,
                }}
              >
                {c == null
                  ? (showClinic ? "클리닉 미배정" : "학생")
                  : (<>
                      <span>{c.label}반</span>
                      <span style={{ marginLeft: 6, fontSize: 11, color: "var(--color-text-muted)", fontWeight: 500 }}>
                        {c.day_of_week_display} {c.start_time?.slice(0, 5)}
                      </span>
                    </>)
                }
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowSections.map((rowSec) => (
            <tr key={rowSec?.id ?? "U"}>
              <td
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--color-border-divider)",
                  borderRight: "1px solid var(--color-border-divider)",
                  background: "var(--color-bg-surface-sunken)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: rowSec == null ? "var(--color-text-muted)" : "var(--color-brand-primary)",
                  verticalAlign: "top",
                }}
              >
                {rowSec == null ? "수업 미배정" : (
                  <div className="flex flex-col">
                    <span>{rowSec.label}반</span>
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 500 }}>
                      {rowSec.day_of_week_display} {rowSec.start_time?.slice(0, 5)}
                    </span>
                  </div>
                )}
              </td>
              {clinicCols.map((clinicSec) => {
                const cell = getCell(rowSec, clinicSec);
                return (
                  <td
                    key={clinicSec?.id ?? "U"}
                    style={{
                      padding: 6,
                      borderBottom: "1px solid var(--color-border-divider)",
                      verticalAlign: "top",
                      background: rowSec == null || (showClinic && clinicSec == null)
                        ? "color-mix(in srgb, var(--color-warning) 4%, transparent)"
                        : "var(--color-bg-surface)",
                    }}
                  >
                    <MatrixCell
                      students={cell}
                      classSections={classSections}
                      clinicSections={clinicSections}
                      currentClassId={rowSec?.id ?? null}
                      currentClinicId={clinicSec?.id ?? null}
                      showClinic={showClinic}
                      assignmentByEnrollment={assignmentByEnrollment}
                      onMove={onMove}
                      onClearAssignment={onClearAssignment}
                      busy={busy}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixCell({
  students, classSections, clinicSections, currentClassId, currentClinicId,
  showClinic, assignmentByEnrollment, onMove, onClearAssignment, busy,
}: {
  students: EnrollmentLite[];
  classSections: Section[];
  clinicSections: Section[];
  currentClassId: number | null;
  currentClinicId: number | null;
  showClinic: boolean;
  assignmentByEnrollment: Map<number, SectionAssignment>;
  onMove: (enrollmentId: number, classId: number | null, clinicId: number | null) => void;
  onClearAssignment: (enrollmentId: number) => void;
  busy: boolean;
}) {
  const [openStudentId, setOpenStudentId] = useState<number | null>(null);

  if (students.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[12px]"
        style={{ minHeight: 60, color: "var(--color-text-muted)" }}
      >
        —
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1" style={{ minHeight: 60 }}>
      {students.map((s) => {
        const isOpen = openStudentId === s.id;
        const a = assignmentByEnrollment.get(s.id);
        return (
          <div key={s.id} className="relative">
            <button
              type="button"
              onClick={() => setOpenStudentId(isOpen ? null : s.id)}
              disabled={busy}
              className="w-full text-left px-2 py-1 rounded text-[12px] font-medium truncate"
              style={{
                background: isOpen ? "var(--color-primary-light, #e0e7ff)" : "var(--color-bg-surface-sunken)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-divider)",
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {s.student?.name ?? "이름없음"}
            </button>
            {isOpen && (
              <StudentMoveMenu
                enrollment={s}
                classSections={classSections}
                clinicSections={clinicSections}
                currentClassId={a?.class_section ?? currentClassId}
                currentClinicId={a?.clinic_section ?? currentClinicId}
                showClinic={showClinic}
                onPick={(classId, clinicId) => { setOpenStudentId(null); onMove(s.id, classId, clinicId); }}
                onClear={() => { setOpenStudentId(null); onClearAssignment(s.id); }}
                onClose={() => setOpenStudentId(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StudentMoveMenu({
  enrollment, classSections, clinicSections, currentClassId, currentClinicId,
  showClinic, onPick, onClear, onClose,
}: {
  enrollment: EnrollmentLite;
  classSections: Section[];
  clinicSections: Section[];
  currentClassId: number | null;
  currentClinicId: number | null;
  showClinic: boolean;
  onPick: (classId: number | null, clinicId: number | null) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [pickedClass, setPickedClass] = useState<number | null>(currentClassId);
  const [pickedClinic, setPickedClinic] = useState<number | null>(currentClinicId);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute left-0 top-full z-50 mt-1 rounded-lg p-3 flex flex-col gap-2"
        style={{
          minWidth: 220,
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-default)",
          boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[12px] font-bold" style={{ color: "var(--color-text-primary)" }}>
          {enrollment.student?.name} 이동
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>수업반</span>
          <select
            className="ds-input"
            value={pickedClass ?? ""}
            onChange={(e) => setPickedClass(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">미배정</option>
            {classSections.map((s) => (
              <option key={s.id} value={s.id}>{s.label}반 ({s.day_of_week_display} {s.start_time?.slice(0, 5)})</option>
            ))}
          </select>
        </label>

        {showClinic && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>클리닉반</span>
            <select
              className="ds-input"
              value={pickedClinic ?? ""}
              onChange={(e) => setPickedClinic(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">미배정</option>
              {clinicSections.map((s) => (
                <option key={s.id} value={s.id}>{s.label}반 ({s.day_of_week_display} {s.start_time?.slice(0, 5)})</option>
              ))}
            </select>
          </label>
        )}

        <div className="flex gap-2 mt-1">
          <Button intent="secondary" size="sm" onClick={onClose}>취소</Button>
          <Button
            intent="ghost"
            size="sm"
            onClick={onClear}
            style={{ color: "var(--color-error)" }}
          >
            편성 해제
          </Button>
          <Button
            intent="primary"
            size="sm"
            onClick={() => onPick(pickedClass, pickedClinic)}
            disabled={pickedClass == null && pickedClinic == null}
          >
            이동
          </Button>
        </div>
      </div>
    </>
  );
}

function SectionFormModal({
  editId, form, onChange, onSubmit, onClose, pending, showClinicType,
}: {
  editId: number | null;
  form: SectionForm;
  onChange: (f: SectionForm) => void;
  onSubmit: () => void;
  onClose: () => void;
  pending: boolean;
  showClinicType: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-5 w-[420px] flex flex-col gap-3"
        style={{ background: "var(--color-bg-surface)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-bold" style={{ color: "var(--color-text-primary)" }}>
          {editId ? "반 수정" : `${form.section_type === "CLASS" ? "수업반" : "클리닉반"} 추가`}
        </h3>

        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>반 이름</span>
            <input
              className="ds-input"
              placeholder="A"
              value={form.label}
              onChange={(e) => onChange({ ...form, label: e.target.value })}
              maxLength={10}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1 col-span-2">
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>타입</span>
            <select
              className="ds-input"
              value={form.section_type}
              onChange={(e) => onChange({ ...form, section_type: e.target.value as "CLASS" | "CLINIC" })}
              disabled={!showClinicType || !!editId}
            >
              <option value="CLASS">수업반</option>
              {showClinicType && <option value="CLINIC">클리닉반 (필수)</option>}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>요일</span>
            <select
              className="ds-input"
              value={form.day_of_week}
              onChange={(e) => onChange({ ...form, day_of_week: Number(e.target.value) })}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>시작</span>
            <input
              className="ds-input"
              type="time"
              value={form.start_time}
              onChange={(e) => onChange({ ...form, start_time: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>종료</span>
            <input
              className="ds-input"
              type="time"
              value={form.end_time}
              onChange={(e) => onChange({ ...form, end_time: e.target.value })}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>장소</span>
            <input
              className="ds-input"
              placeholder="선택 입력"
              value={form.location}
              onChange={(e) => onChange({ ...form, location: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>정원</span>
            <input
              className="ds-input"
              type="number"
              placeholder="무제한"
              value={form.max_capacity}
              onChange={(e) => onChange({ ...form, max_capacity: e.target.value })}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button intent="secondary" size="sm" onClick={onClose}>취소</Button>
          <Button
            intent="primary"
            size="sm"
            onClick={onSubmit}
            disabled={!form.label.trim() || pending}
            leftIcon={editId ? <Pencil size={13} /> : <UserPlus size={13} />}
          >
            {pending ? "저장 중..." : editId ? "수정" : "추가"}
          </Button>
        </div>
      </div>
    </div>
  );
}
