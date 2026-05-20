// PATH: src/app_admin/domains/students/components/StudentFilterModal.tsx
import { useEffect, useMemo, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";
import type { StudentFilters } from "../api/students.api";

interface Props {
  open: boolean;
  onClose: () => void;
  filters: StudentFilters;
  onApply: (next: StudentFilters) => void;
}

function normalize(next: StudentFilters): StudentFilters {
  Object.keys(next).forEach((k) => {
    const v = next[k];
    if (v === "" || v == null) delete next[k];
  });

  if (typeof next.is_managed === "string") {
    if (next.is_managed === "true") next.is_managed = true;
    else if (next.is_managed === "false") next.is_managed = false;
    else delete next.is_managed;
  }

  if (typeof next.grade === "string" && next.grade.trim()) {
    const n = Number(next.grade);
    if (Number.isFinite(n)) next.grade = n;
    else delete next.grade;
  }

  if (typeof next.school_type === "string" && !next.school_type.trim()) {
    delete next.school_type;
  }

  return next;
}

function inputValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function managedValue(value: unknown): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return typeof value === "string" ? value : "";
}

export default function StudentFilterModal({
  open,
  onClose,
  filters,
  onApply,
}: Props) {
  const slm = useSchoolLevelMode();
  const [local, setLocal] = useState<StudentFilters>(filters || {});
  const title = useMemo(() => "고급 필터", []);

  useEffect(() => {
    if (!open) return;
    setLocal(filters || {});
  }, [open, filters]);

  function update(key: string, value: unknown) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function apply() {
    const next = normalize({ ...local });
    onApply(next);
  }

  function reset() {
    setLocal({});
  }

  return (
    <AdminModal open={open} onClose={onClose} type="action" width={MODAL_WIDTH.md} onEnterConfirm={apply}>
      <ModalHeader
        type="action"
        title={title}
        description="조건에 맞는 학생만 조회합니다."
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact">
          <div className="modal-form-row modal-form-row--3">
            <input
              className="ds-input"
              placeholder="이름"
              value={inputValue(local.name)}
              onChange={(e) => update("name", e.target.value)}
            />
            <input
              className="ds-input"
              placeholder="아이디"
              value={inputValue(local.ps_number)}
              onChange={(e) => update("ps_number", e.target.value)}
            />
            <select
              className="ds-select"
              value={inputValue(local.gender)}
              onChange={(e) => update("gender", e.target.value)}
            >
              <option value="">성별 전체</option>
              <option value="M">남</option>
              <option value="F">여</option>
            </select>
          </div>
          <div className="modal-form-row modal-form-row--3">
            <input
              className="ds-input"
              placeholder="학생 전화번호"
              value={inputValue(local.student_phone)}
              onChange={(e) => update("student_phone", e.target.value)}
            />
            <input
              className="ds-input"
              placeholder="학부모 전화번호"
              value={inputValue(local.parent_phone)}
              onChange={(e) => update("parent_phone", e.target.value)}
            />
            <select
              className="ds-select"
              value={managedValue(local.is_managed)}
              onChange={(e) => update("is_managed", e.target.value)}
            >
              <option value="">상태 전체</option>
              <option value="true">활성</option>
              <option value="false">비활성</option>
            </select>
          </div>
          <div className="modal-form-row modal-form-row--3">
            <select
              className="ds-select"
              value={inputValue(local.school_type)}
              onChange={(e) => update("school_type", e.target.value)}
            >
              <option value="">학교급 전체</option>
              {slm.schoolTypes.map((st) => (
                <option key={st} value={st}>{slm.labels[st]}</option>
              ))}
            </select>
            {slm.mode === "elementary_middle" ? (
              <input
                className="ds-input"
                placeholder="초등학교"
                value={inputValue(local.elementary_school)}
                onChange={(e) => update("elementary_school", e.target.value)}
              />
            ) : (
              <input
                className="ds-input"
                placeholder="고등학교"
                value={inputValue(local.high_school)}
                onChange={(e) => update("high_school", e.target.value)}
              />
            )}
            <input
              className="ds-input"
              placeholder="중학교"
              value={inputValue(local.middle_school)}
              onChange={(e) => update("middle_school", e.target.value)}
            />
          </div>
          <div className="modal-form-row modal-form-row--3">
            <select
              className="ds-select"
              value={inputValue(local.grade)}
              onChange={(e) => update("grade", e.target.value)}
            >
              <option value="">학년 전체</option>
              {(() => {
                const maxGrade = slm.mode === "elementary_middle" ? 6 : 3;
                return Array.from({ length: maxGrade }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={String(g)}>{g}학년</option>
                ));
              })()}
            </select>
            {slm.mode !== "elementary_middle" && (
              <input
                className="ds-input"
                placeholder="계열"
                value={inputValue(local.major)}
                onChange={(e) => update("major", e.target.value)}
              />
            )}
            <span />
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <Button intent="ghost" onClick={reset}>
            초기화
          </Button>
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose}>
              취소
            </Button>
            <Button intent="primary" onClick={apply}>
              적용
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
