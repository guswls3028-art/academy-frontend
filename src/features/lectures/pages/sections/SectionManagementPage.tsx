// PATH: src/features/lectures/pages/sections/SectionManagementPage.tsx
/**
 * 반 편성 페이지 — 반 관리 + 학생 배정을 한 화면에서 처리.
 *
 * 좌측: 반 목록 (수업/클리닉)  +  반 추가/편집
 * 우측: 선택한 반의 학생 편성 목록  +  자동배정
 */
import { useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
import { EmptyState, Button } from "@/shared/ui/ds";
import { useSectionMode } from "@/shared/hooks/useSectionMode";

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
  day_of_week: 0,
  start_time: "17:00",
  end_time: "19:00",
  location: "",
  max_capacity: "",
};

export default function SectionManagementPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lecId = Number(lectureId);
  const qc = useQueryClient();
  const { sectionMode, clinicMode } = useSectionMode();
  const showClinic = clinicMode === "regular";

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<SectionForm>(EMPTY_FORM);

  // -- Data --
  const { data: sections = [], isLoading } = useQuery<Section[]>({
    queryKey: ["lecture-sections", lecId],
    queryFn: () => fetchSections(lecId),
    enabled: Number.isFinite(lecId),
  });

  const { data: assignments = [] } = useQuery<SectionAssignment[]>({
    queryKey: ["section-assignments", lecId],
    queryFn: () => fetchSectionAssignments(lecId),
    enabled: Number.isFinite(lecId),
  });

  // -- Mutations --
  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["lecture-sections", lecId] });
    qc.invalidateQueries({ queryKey: ["section-assignments", lecId] });
  }, [qc, lecId]);

  const createMut = useMutation({
    mutationFn: (data: Parameters<typeof createSection>[0]) => createSection(data),
    onSuccess: () => { invalidate(); setShowForm(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateSection>[1] }) =>
      updateSection(id, data),
    onSuccess: () => { invalidate(); setShowForm(false); setEditId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteSection(id),
    onSuccess: () => {
      invalidate();
      if (selectedId === deleteMut.variables) setSelectedId(null);
    },
  });

  const autoAssignMut = useMutation({
    mutationFn: (sectionType: "CLASS" | "CLINIC") =>
      autoAssignSections(lecId, sectionType),
    onSuccess: () => invalidate(),
  });

  // -- Derived --
  const classSections = useMemo(
    () => sections.filter((s) => s.section_type === "CLASS"),
    [sections],
  );
  const clinicSections = useMemo(
    () => sections.filter((s) => s.section_type === "CLINIC"),
    [sections],
  );

  const selectedSection = sections.find((s) => s.id === selectedId) ?? null;

  const selectedAssignments = useMemo(() => {
    if (!selectedId) return assignments;
    return assignments.filter(
      (a) => a.class_section === selectedId || a.clinic_section === selectedId,
    );
  }, [assignments, selectedId]);

  // 반 편성 모드가 꺼져 있으면 접근 차단 (hooks 뒤에 배치)
  if (!sectionMode) {
    return (
      <EmptyState
        scope="page"
        tone="empty"
        title="반 편성 모드가 비활성화되어 있습니다"
        description="설정 > 개발자 콘솔 > 운영 설정에서 반 편성 모드를 활성화하세요."
      />
    );
  }

  // -- Form handlers --
  const openCreate = (type: "CLASS" | "CLINIC") => {
    setForm({ ...EMPTY_FORM, section_type: type });
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (sec: Section) => {
    setForm({
      label: sec.label,
      section_type: sec.section_type,
      day_of_week: sec.day_of_week,
      start_time: sec.start_time?.slice(0, 5) ?? "17:00",
      end_time: sec.end_time?.slice(0, 5) ?? "",
      location: sec.location ?? "",
      max_capacity: sec.max_capacity != null ? String(sec.max_capacity) : "",
    });
    setEditId(sec.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    const payload = {
      lecture: lecId,
      label: form.label.trim(),
      section_type: form.section_type,
      day_of_week: form.day_of_week,
      start_time: form.start_time,
      end_time: form.end_time || null,
      location: form.location,
      max_capacity: form.max_capacity ? Number(form.max_capacity) : null,
    };
    if (!payload.label) return;
    if (editId) {
      updateMut.mutate({ id: editId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const handleDelete = (sec: Section) => {
    if (!confirm(`${sec.label}반을 삭제하시겠습니까? 편성된 학생이 있으면 삭제할 수 없습니다.`)) return;
    deleteMut.mutate(sec.id);
  };

  if (!Number.isFinite(lecId)) {
    return <div className="p-2 text-sm" style={{ color: "var(--color-error)" }}>강의 정보를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="flex gap-4" style={{ minHeight: 400 }}>
      {/* ===== 좌측: 반 목록 ===== */}
      <div className="w-[320px] shrink-0 flex flex-col gap-4">
        {/* 수업 반 */}
        <SectionGroup
          title="수업 반"
          sections={classSections}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEdit={openEdit}
          onDelete={handleDelete}
          onAdd={() => openCreate("CLASS")}
          isLoading={isLoading}
        />

        {/* 클리닉 반 — 정규형 클리닉 모드에서만 표시 */}
        {showClinic && (
          <SectionGroup
            title="클리닉 반 (필수)"
            sections={clinicSections}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onEdit={openEdit}
            onDelete={handleDelete}
            onAdd={() => openCreate("CLINIC")}
            isLoading={isLoading}
          />
        )}

        {/* 자동배정 */}
        <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--color-border-divider)" }}>
          <Button
            intent="secondary"
            size="sm"
            onClick={() => autoAssignMut.mutate("CLASS")}
            disabled={autoAssignMut.isPending || classSections.length === 0}
          >
            {autoAssignMut.isPending ? "배정 중..." : "수업 반 자동배정"}
          </Button>
          {showClinic && (
            <Button
              intent="secondary"
              size="sm"
              onClick={() => autoAssignMut.mutate("CLINIC")}
              disabled={autoAssignMut.isPending || clinicSections.length === 0}
            >
              {autoAssignMut.isPending ? "배정 중..." : "클리닉 반 자동배정"}
            </Button>
          )}
          {autoAssignMut.isSuccess && autoAssignMut.data && (
            <p className="text-[12px] mt-1" style={{ color: "var(--color-success, #16a34a)" }}>
              {autoAssignMut.data.message}
            </p>
          )}
          {autoAssignMut.isError && (
            <p className="text-[12px] mt-1" style={{ color: "var(--color-error)" }}>
              자동배정 실패
            </p>
          )}
        </div>
      </div>

      {/* ===== 우측: 학생 편성 목록 ===== */}
      <div className="flex-1 min-w-0">
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--color-border-default)", background: "var(--color-bg-surface)" }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ background: "var(--color-bg-surface-sunken)", borderBottom: "1px solid var(--color-border-default)" }}
          >
            <span className="text-[14px] font-bold" style={{ color: "var(--color-text-primary)" }}>
              {selectedSection
                ? `${selectedSection.label}반 편성 (${selectedAssignments.length}명)`
                : `전체 편성 (${assignments.length}명)`}
            </span>
          </div>

          {selectedAssignments.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px]" style={{ color: "var(--color-text-muted)" }}>
              {selectedSection ? "이 반에 편성된 학생이 없습니다." : "편성된 학생이 없습니다. 자동배정을 실행하세요."}
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border-divider)" }}>
                  <th className="px-4 py-2 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>학생</th>
                  <th className="px-3 py-2 text-center font-medium" style={{ color: "var(--color-text-muted)" }}>수업반</th>
                  {showClinic && <th className="px-3 py-2 text-center font-medium" style={{ color: "var(--color-text-muted)" }}>클리닉반</th>}
                  <th className="px-3 py-2 text-center font-medium" style={{ color: "var(--color-text-muted)" }}>배정방식</th>
                </tr>
              </thead>
              <tbody>
                {selectedAssignments.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-[var(--color-bg-surface-hover)]"
                    style={{ borderBottom: "1px solid var(--color-border-divider)" }}
                  >
                    <td className="px-4 py-2 font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {a.student_name}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className="px-2 py-0.5 rounded text-[12px] font-medium"
                        style={{ background: "var(--color-primary-light, #e0e7ff)", color: "var(--color-primary)" }}
                      >
                        {a.class_section_label}반
                      </span>
                    </td>
                    {showClinic && (
                      <td className="px-3 py-2 text-center">
                        {a.clinic_section_label ? (
                          <span
                            className="px-2 py-0.5 rounded text-[12px] font-medium"
                            style={{ background: "var(--color-warning-light, #fef3c7)", color: "var(--color-warning, #d97706)" }}
                          >
                            {a.clinic_section_label}반
                          </span>
                        ) : (
                          <span className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>-</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-center text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                      {a.source_display}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ===== 반 추가/편집 모달 ===== */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowForm(false)}
        >
          <div
            className="rounded-xl p-6 w-[400px] flex flex-col gap-4"
            style={{ background: "var(--color-bg-surface)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-bold" style={{ color: "var(--color-text-primary)" }}>
              {editId ? "반 수정" : "반 추가"}
            </h3>

            {/* 반 이름 */}
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium" style={{ color: "var(--color-text-muted)" }}>반 이름</span>
              <input
                className="ds-input"
                placeholder="A, B, C..."
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                maxLength={10}
                autoFocus
              />
            </label>

            {/* 타입 */}
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium" style={{ color: "var(--color-text-muted)" }}>타입</span>
              <select
                className="ds-input"
                value={form.section_type}
                onChange={(e) => setForm((f) => ({ ...f, section_type: e.target.value as "CLASS" | "CLINIC" }))}
              >
                <option value="CLASS">수업</option>
                <option value="CLINIC">클리닉</option>
              </select>
            </label>

            {/* 요일 + 시간 */}
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium" style={{ color: "var(--color-text-muted)" }}>요일</span>
                <select
                  className="ds-input"
                  value={form.day_of_week}
                  onChange={(e) => setForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))}
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium" style={{ color: "var(--color-text-muted)" }}>시작</span>
                <input
                  className="ds-input"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium" style={{ color: "var(--color-text-muted)" }}>종료</span>
                <input
                  className="ds-input"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                />
              </label>
            </div>

            {/* 장소 + 정원 */}
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium" style={{ color: "var(--color-text-muted)" }}>장소</span>
                <input
                  className="ds-input"
                  placeholder="선택사항"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium" style={{ color: "var(--color-text-muted)" }}>정원</span>
                <input
                  className="ds-input"
                  type="number"
                  placeholder="무제한"
                  value={form.max_capacity}
                  onChange={(e) => setForm((f) => ({ ...f, max_capacity: e.target.value }))}
                />
              </label>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-2 pt-2">
              <Button intent="secondary" size="sm" onClick={() => setShowForm(false)}>
                취소
              </Button>
              <Button
                intent="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={!form.label.trim() || createMut.isPending || updateMut.isPending}
              >
                {createMut.isPending || updateMut.isPending ? "저장 중..." : editId ? "수정" : "추가"}
              </Button>
            </div>

            {(createMut.isError || updateMut.isError || deleteMut.isError) && (
              <p className="text-[12px]" style={{ color: "var(--color-error)" }}>
                저장 실패. 같은 이름의 반이 이미 존재하거나, 편성된 학생이 있어 삭제할 수 없습니다.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 반 그룹 (수업/클리닉) */
function SectionGroup({
  title,
  sections,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onAdd,
  isLoading,
}: {
  title: string;
  sections: Section[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onEdit: (s: Section) => void;
  onDelete: (s: Section) => void;
  onAdd: () => void;
  isLoading: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-bold" style={{ color: "var(--color-text-primary)" }}>
          {title}
        </span>
        <button
          onClick={onAdd}
          className="text-[12px] font-medium px-2 py-0.5 rounded transition-colors"
          style={{ color: "var(--color-primary)" }}
        >
          + 추가
        </button>
      </div>

      {isLoading ? (
        <div className="text-[12px] py-4 text-center" style={{ color: "var(--color-text-muted)" }}>
          불러오는 중...
        </div>
      ) : sections.length === 0 ? (
        <div
          className="text-[12px] py-4 text-center rounded-lg"
          style={{ color: "var(--color-text-muted)", border: "1px dashed var(--color-border-divider)" }}
        >
          등록된 반이 없습니다
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {sections.map((sec) => {
            const isSelected = selectedId === sec.id;
            return (
              <div
                key={sec.id}
                onClick={() => onSelect(isSelected ? null : sec.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                style={{
                  background: isSelected ? "var(--color-primary-light, #e0e7ff)" : "var(--color-bg-surface)",
                  border: `1px solid ${isSelected ? "var(--color-primary)" : "var(--color-border-default)"}`,
                }}
              >
                <span
                  className="text-[14px] font-bold min-w-[32px]"
                  style={{ color: isSelected ? "var(--color-primary)" : "var(--color-text-primary)" }}
                >
                  {sec.label}반
                </span>
                <span className="text-[12px] flex-1" style={{ color: "var(--color-text-muted)" }}>
                  {sec.day_of_week_display} {sec.start_time?.slice(0, 5)}
                  {sec.end_time ? `~${sec.end_time.slice(0, 5)}` : ""}
                </span>
                <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                  {sec.assignment_count}명
                </span>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onEdit(sec)}
                    className="text-[11px] px-1.5 py-0.5 rounded"
                    style={{ color: "var(--color-text-muted)" }}
                    title="수정"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => onDelete(sec)}
                    className="text-[11px] px-1.5 py-0.5 rounded"
                    style={{ color: "var(--color-error)" }}
                    title="삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
