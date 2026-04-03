// PATH: src/features/students/components/EditStudentModal.tsx
// 디자인: StudentCreateModal(1명 등록)과 동일 구조·클래스 — 쌍둥이 UX

import { useEffect, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { PhoneInput010Blocks } from "@/shared/ui/PhoneInput010Blocks";
import { updateStudent } from "../api/students";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";

interface Props {
  open: boolean;
  initialValue: any;
  onClose: () => void;
  onSuccess: () => void;
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

  const [form, setForm] = useState({
    name: initialValue.name || "",
    gender: initialValue.gender || "",
    psNumber: initialValue.psNumber || "",
    studentPhone: initialValue.studentPhone || "",
    parentPhone: initialValue.parentPhone || "",
    schoolType: initialValue.schoolType || "HIGH",
    school: initialValue.school || "",
    grade: initialValue.grade ? String(initialValue.grade) : "",
    schoolClass: initialValue.schoolClass || "",
    major: initialValue.major || "",
    originMiddleSchool: initialValue.originMiddleSchool || "",
    address: initialValue.address || "",
    memo: initialValue.memo || "",
    active: !!initialValue.active,
  });

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setFieldErrors({});
    setForm({
      name: initialValue.name || "",
      gender: initialValue.gender || "",
      psNumber: initialValue.psNumber || "",
      studentPhone: initialValue.studentPhone || "",
      parentPhone: initialValue.parentPhone || "",
      schoolType: initialValue.schoolType || "HIGH",
      school: initialValue.school || "",
      grade: initialValue.grade ? String(initialValue.grade) : "",
      schoolClass: initialValue.schoolClass || "",
      major: initialValue.major || "",
      originMiddleSchool: initialValue.originMiddleSchool || "",
      address: initialValue.address || "",
      memo: initialValue.memo || "",
      active: !!initialValue.active,
    });
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
    } catch (raw: any) {
      const data = raw?.response?.data;
      if (raw?.response?.status === 400 && data && typeof data === "object") {
        const next: Record<string, string> = {};
        for (const [backendKey, val] of Object.entries(data)) {
          const msg = Array.isArray(val) ? val[0] : typeof val === "string" ? val : "";
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
        feedback.error(raw?.message || "저장에 실패했습니다.");
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
              <div style={{ minWidth: 0 }} aria-hidden />
              <div className="modal-actions-inline" style={{ height: 36 }}>
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
                placeholder="학교명 (XX고·XX중 입력 시 자동 선택)"
                value={form.school ?? ""}
                onChange={handleChange}
                className="ds-input"
                disabled={busy}
              />
              <div className="modal-actions-inline" style={{ height: 36 }}>
                {slm.schoolTypes.map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`ds-choice-btn ds-choice-btn--primary${form.schoolType === st ? " is-selected" : ""}`}
                    aria-pressed={form.schoolType === st}
                    onClick={() => setForm((p) => ({ ...p, schoolType: st, grade: "" }))}
                    disabled={busy}
                  >
                    {slm.getLabel(st)}
                  </button>
                ))}
              </div>
              <div className="modal-actions-inline" style={{ height: 36 }}>
                {slm.gradeRange(form.schoolType as any || slm.defaultSchoolType).map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`ds-choice-btn ds-choice-btn--primary${form.grade === String(g) ? " is-selected" : ""}`}
                    aria-pressed={form.grade === String(g)}
                    onClick={() => setForm((p) => ({ ...p, grade: String(g) }))}
                    disabled={busy}
                  >
                    {g}학년
                  </button>
                ))}
              </div>
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
              {slm.showTrack(form.schoolType as any) && (
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
            {slm.showOriginMiddleSchool(form.schoolType as any) && (
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
            <span className="modal-hint modal-hint--block" style={{ marginBottom: 0 }}>
              상세에서 태그/메모/상태를 관리할 수 있습니다.
            </span>
            <button
              type="button"
              className="ds-status-badge"
              data-status={form.active ? "active" : "inactive"}
              aria-pressed={form.active}
              onClick={() => setForm((p) => ({ ...p, active: !p.active }))}
              disabled={busy}
            >
              {form.active ? "활성" : "비활성"}
            </button>
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
