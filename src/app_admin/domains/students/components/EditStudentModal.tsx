// PATH: src/app_admin/domains/students/components/EditStudentModal.tsx
// 디자인: StudentCreateModal(1명 등록)과 동일 구조·클래스 — 쌍둥이 UX

import { useEffect, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Badge, Button } from "@/shared/ui/ds";
import { PhoneInput010Blocks } from "@/shared/ui/PhoneInput010Blocks";
import { type ClientStudent, updateStudent } from "../api/students.api";
import { feedback } from "@/shared/ui/feedback/feedback";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { type SchoolType, useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";
import styles from "./EditStudentModal.module.css";

interface Props {
  open: boolean;
  initialValue: ClientStudent;
  onClose: () => void;
  onSuccess: () => void;
}

type StudentEditForm = {
  name: string;
  gender: string;
  psNumber: string;
  studentPhone: string;
  parentPhone: string;
  schoolType: SchoolType;
  school: string;
  grade: string;
  schoolClass: string;
  major: string;
  originMiddleSchool: string;
  address: string;
  memo: string;
  active: boolean;
};

type ApiErrorWithStatus = {
  response?: {
    status?: number;
    data?: unknown;
  };
};

const SCHOOL_TYPES = new Set<SchoolType>(["ELEMENTARY", "MIDDLE", "HIGH"]);

function normalizeSchoolType(value: unknown, fallback: SchoolType): SchoolType {
  return typeof value === "string" && SCHOOL_TYPES.has(value as SchoolType)
    ? value as SchoolType
    : fallback;
}

function toEditForm(student: ClientStudent, defaultSchoolType: SchoolType): StudentEditForm {
  return {
    name: student.name || "",
    gender: student.gender || "",
    psNumber: student.psNumber || "",
    studentPhone: student.studentPhone || "",
    parentPhone: student.parentPhone || "",
    schoolType: normalizeSchoolType(student.schoolType, defaultSchoolType),
    school: student.school || "",
    grade: student.grade ? String(student.grade) : "",
    schoolClass: student.schoolClass || "",
    major: student.major || "",
    originMiddleSchool: student.originMiddleSchool || "",
    address: student.address || "",
    memo: student.memo || "",
    active: !!student.active,
  };
}

function asErrorRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function fieldMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return typeof first === "string" ? first : "";
  }
  return "";
}

export default function EditStudentModal({
  open,
  initialValue,
  onClose,
  onSuccess,
}: Props) {
  const slm = useSchoolLevelMode();
  const [busy, setBusy] = useState(false);
  /** 400 응답 시 백엔드 필드별 에러 (backend key -> message). setFields 개념으로 매핑 */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<StudentEditForm>(() =>
    toEditForm(initialValue, slm.defaultSchoolType)
  );

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setFieldErrors({});
    setForm(toEditForm(initialValue, slm.defaultSchoolType));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValue?.id]);

  /** 백엔드 필드명 -> 프론트 필드명 (setFields 매핑) */
  const backendToFrontendField: Record<string, string> = {
    ps_number: "psNumber",
    phone: "studentPhone",
    parent_phone: "parentPhone",
    name: "name",
  };

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((p) => {
      const next = { ...p, [name]: value };
      if (name === "school") {
        const t = String(value ?? "").trim();
        if (t.endsWith("고")) next.schoolType = "HIGH";
        else if (t.endsWith("중")) next.schoolType = "MIDDLE";
        else if (t.endsWith("초")) next.schoolType = "ELEMENTARY";
      }
      return next;
    });
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function handlePhoneChange(name: "studentPhone" | "parentPhone", value: string) {
    setForm((p) => ({ ...p, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function validate(): string | null {
    if (!String(form.name || "").trim()) return "이름은 필수 입력입니다.";
    if (!String(form.psNumber || "").trim()) return "아이디(PS 번호)는 필수 입력입니다.";

    // 학생 전화번호는 선택사항 (식별자 학생은 전화번호 없음)
    const phone = String(form.studentPhone || "").trim();
    if (phone && !/^010\d{8}$/.test(phone)) return "학생 전화번호는 010 뒤 8자리 숫자여야 합니다.";

    const parent = String(form.parentPhone || "").trim();
    if (!parent || parent.length !== 11) return "학부모 전화(010 뒤 8자리)를 입력해 주세요.";
    if (!/^010\d{8}$/.test(parent)) return "학부모 전화번호는 010 뒤 8자리 숫자여야 합니다.";

    return null;
  }

  async function handleSubmit() {
    if (busy) return;

    const err = validate();
    if (err) {
      feedback.error(err);
      return;
    }

    setBusy(true);
    setFieldErrors({});
    try {
      const noPhone = !String(form.studentPhone || "").trim();
      await updateStudent(initialValue.id, { ...form, noPhone });
      onSuccess();
      onClose();
    } catch (raw: unknown) {
      const apiError = raw as ApiErrorWithStatus;
      const data = asErrorRecord(apiError.response?.data);
      if (apiError.response?.status === 400 && data) {
        const next: Record<string, string> = {};
        for (const [backendKey, val] of Object.entries(data)) {
          const msg = fieldMessage(val);
          if (!msg) continue;
          const frontKey = backendToFrontendField[backendKey] ?? backendKey;
          next[frontKey] = msg;
        }
        setFieldErrors(next);
        const messages = Object.entries(next)
          .map(([k, v]) => (k === "name" ? "이름" : k === "psNumber" ? "아이디" : k === "studentPhone" ? "학생 전화" : k === "parentPhone" ? "학부모 전화" : k) + ": " + v)
          .join("\n");
        feedback.error(messages);
      } else {
        feedback.error(getApiErrorMessage(raw, "저장에 실패했습니다."));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModal open={open} onClose={onClose} type="action" width={MODAL_WIDTH.md} onEnterConfirm={!busy ? handleSubmit : undefined}>
      <ModalHeader
        type="action"
        title="학생 수정"
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact">
          {/* 필수 입력 — StudentCreateModal과 동일 구조·입체감 */}
          <div className="modal-form-group">
            <span className="modal-section-label">필수 입력</span>
            <input
              name="name"
              placeholder="이름"
              value={form.name ?? ""}
              onChange={handleChange}
              className="ds-input"
              data-required="true"
              data-invalid={!String(form.name || "").trim() ? "true" : "false"}
              disabled={busy}
              autoFocus
            />
            <input
              name="psNumber"
              placeholder="아이디(PS 번호)"
              value={form.psNumber ?? ""}
              onChange={handleChange}
              className="ds-input"
              data-required="true"
              data-invalid={!String(form.psNumber || "").trim() ? "true" : "false"}
              disabled={busy}
            />
            <div className="modal-phone-row">
              <span className="modal-phone-label">학부모 전화번호 (필수)</span>
              <span className="modal-phone-desc">문자·연락 수신용입니다.</span>
              <PhoneInput010Blocks
                value={form.parentPhone ?? ""}
                onChange={(v) => handlePhoneChange("parentPhone", v)}
                disabled={busy}
                blockClassName="modal-phone-block"
                inputClassName="modal-phone-block-input"
                data-invalid={!String(form.parentPhone || "").trim()}
                data-required="true"
                aria-label="학부모 전화"
              />
            </div>
            <div className="modal-phone-row">
              <span className="modal-phone-label">학생 전화번호</span>
              <span className="modal-phone-desc">학생 본인 번호(010 포함 11자리)를 입력하세요.</span>
              <PhoneInput010Blocks
                value={form.studentPhone ?? ""}
                onChange={(v) => handlePhoneChange("studentPhone", v)}
                disabled={busy}
                blockClassName="modal-phone-block"
                inputClassName="modal-phone-block-input"
                aria-label="학생 전화"
              />
            </div>
          </div>

          {/* 선택 입력 — 강조색 없음, 입체감만 유지 (Create와 동일) */}
          <div className="modal-form-group modal-form-group--neutral">
            <span className="modal-section-label">선택 입력</span>
            <div className="modal-form-row modal-form-row--1-auto">
              <div className={styles.genderSpacer} aria-hidden />
              <div className={`modal-actions-inline ${styles.genderActions}`}>
                {[{ key: "M", label: "남자" }, { key: "F", label: "여자" }].map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    className={`student-gender-btn student-gender-btn--${g.key === "M" ? "m" : "f"}${form.gender === g.key ? " is-selected" : ""}`}
                    aria-pressed={form.gender === g.key}
                    onClick={() => setForm((p) => ({ ...p, gender: g.key }))}
                    disabled={busy}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-form-row modal-form-row--1-auto-auto">
              <input
                name="school"
                placeholder={slm.mode === "elementary_middle" ? "학교명 (XX초·XX중 입력 시 자동 선택)" : "학교명 (XX고·XX중 입력 시 자동 선택)"}
                value={form.school ?? ""}
                onChange={handleChange}
                className="ds-input"
                disabled={busy}
              />
              <select
                className={`ds-select ${styles.schoolSelect}`}
                value={form.schoolType || slm.defaultSchoolType}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    schoolType: normalizeSchoolType(e.target.value, p.schoolType),
                    grade: "",
                  }))
                }
                disabled={busy}
              >
                {slm.schoolTypes.map((st) => (
                  <option key={st} value={st}>{slm.getLabel(st)}</option>
                ))}
              </select>
              <select
                className={`ds-select ${styles.schoolSelect}`}
                value={form.grade}
                onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value }))}
                disabled={busy}
              >
                <option value="">학년</option>
                {slm.gradeRange(form.schoolType || slm.defaultSchoolType).map((g) => (
                  <option key={g} value={String(g)}>{g}학년</option>
                ))}
              </select>
            </div>
            <div className="modal-form-row modal-form-row--2">
              <input
                name="schoolClass"
                placeholder="반"
                value={form.schoolClass ?? ""}
                onChange={handleChange}
                className="ds-input"
                disabled={busy}
              />
              {slm.showTrack(form.schoolType) && (
                <input
                  name="major"
                  placeholder="계열"
                  value={form.major ?? ""}
                  onChange={handleChange}
                  className="ds-input"
                  disabled={busy}
                />
              )}
            </div>
            {slm.showOriginMiddleSchool(form.schoolType) && (
              <input
                name="originMiddleSchool"
                placeholder="출신중학교 (선택)"
                value={form.originMiddleSchool ?? ""}
                onChange={handleChange}
                className="ds-input"
                disabled={busy}
              />
            )}
            <input
              name="address"
              placeholder="주소 (선택)"
              value={form.address ?? ""}
              onChange={handleChange}
              className="ds-input"
              disabled={busy}
            />
            <textarea
              name="memo"
              rows={2}
              placeholder="메모"
              value={form.memo ?? ""}
              onChange={handleChange}
              className="ds-textarea"
              disabled={busy}
            />
          </div>

          <div className="modal-form-row modal-form-row--1-auto">
            <span className={`modal-hint modal-hint--block ${styles.managementHint}`}>
              상세에서 태그/메모/상태를 관리할 수 있습니다.
            </span>
            <Badge
              as="button"
              variant="solid"
              status={form.active ? "active" : "inactive"}
              ariaPressed={form.active}
              onClick={() => setForm((p) => ({ ...p, active: !p.active }))}
              disabled={busy}
            >
              {form.active ? "활성" : "비활성"}
            </Badge>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={busy}>
              취소
            </Button>
            <Button intent="primary" onClick={handleSubmit} disabled={busy}>
              {busy ? "저장 중…" : "저장"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
