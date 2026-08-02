// PATH: src/app_admin/domains/staff/components/StaffEditModal.tsx
// 직원 수정 모달 — 전역 디자인 시스템(AdminModal + ModalHeader/Body/Footer) 적용.
// 학생 도메인 EditStudentModal과 동일한 구조·클래스 사용.

import { useEffect, useState } from "react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Badge, Button } from "@/shared/ui/ds";
import { patchStaffDetail, type StaffDetail } from "../api/staff.detail.api";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import styles from "./StaffEditModal.module.css";

interface Props {
  open: boolean;
  staff: StaffDetail | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StaffEditModal({
  open,
  staff,
  onClose,
  onSuccess,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    pay_type: "HOURLY" as "HOURLY" | "MONTHLY",
    role: "ASSISTANT" as "TEACHER" | "ASSISTANT",
    is_active: true,
  });

  useEffect(() => {
    if (!open || !staff) return;
    setForm({
      name: staff.name ?? "",
      phone: staff.phone ?? "",
      pay_type: staff.pay_type ?? "HOURLY",
      role: staff.role === "TEACHER" ? "TEACHER" : "ASSISTANT",
      is_active: !!staff.is_active,
    });
  }, [open, staff]);

  const handleSubmit = async () => {
    if (!staff || busy) return;
    if (!String(form.name ?? "").trim()) {
      feedback.error("이름을 입력하세요.");
      return;
    }
    setBusy(true);
    try {
      const payload: Partial<StaffDetail> = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        pay_type: form.pay_type,
        is_active: form.is_active,
      };
      if (form.is_active) payload.role = form.role;
      await patchStaffDetail(staff.id, payload);
      feedback.success("저장되었습니다.");
      onSuccess();
      onClose();
    } catch (e: unknown) {
      feedback.error(extractApiError(e, "저장에 실패했습니다."));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <AdminModal open onClose={onClose} type="action" width={MODAL_WIDTH.default} closeDisabled={busy} onEnterConfirm={!busy ? handleSubmit : undefined}>
      <ModalHeader
        type="action"
        title="직원 수정"
        description="연락처·역할·재직 상태를 실제 인사 상태와 맞춰 주세요."
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact">
          <div className="modal-form-group">
            <label className="modal-section-label">이름 (필수)</label>
            <input
              className="ds-input"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="이름"
              disabled={busy}
              autoFocus
              aria-label="이름"
            />
          </div>

          <div className="modal-form-group">
            <label className="modal-section-label">전화번호</label>
            <input
              className="ds-input"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="010-0000-0000"
              disabled={busy}
              aria-label="전화번호"
            />
          </div>

          <div className="modal-form-group">
            <label className="modal-section-label">급여 유형</label>
            <div className={`modal-form-row modal-form-row--1-auto ${styles.payTypeRow}`}>
              <button
                type="button"
                className={`ds-choice-btn ds-choice-btn--primary${form.pay_type === "HOURLY" ? " is-selected" : ""}`}
                aria-pressed={form.pay_type === "HOURLY"}
                onClick={() => setForm((p) => ({ ...p, pay_type: "HOURLY" }))}
                disabled={busy}
              >
                시급
              </button>
              <button
                type="button"
                className={`ds-choice-btn ds-choice-btn--primary${form.pay_type === "MONTHLY" ? " is-selected" : ""}`}
                aria-pressed={form.pay_type === "MONTHLY"}
                disabled
                title="월 기본급·일할·공제 정책이 준비되기 전에는 새로 선택할 수 없습니다."
              >
                월급(수동 확인)
              </button>
            </div>
            <p className="staff-helper">
              현재 자동 정산은 시급만 지원합니다. 기존 월급 표시는 계산 기준으로 사용되지 않습니다.
            </p>
          </div>

          <div className="modal-form-group">
            <label className="modal-section-label">역할</label>
            <div className={`modal-form-row modal-form-row--1-auto ${styles.payTypeRow}`}>
              <button
                type="button"
                className={`ds-choice-btn ds-choice-btn--primary${form.role === "TEACHER" ? " is-selected" : ""}`}
                aria-pressed={form.role === "TEACHER"}
                onClick={() => setForm((p) => ({ ...p, role: "TEACHER" }))}
                disabled={busy}
              >
                강사
              </button>
              <button
                type="button"
                className={`ds-choice-btn ds-choice-btn--primary${form.role === "ASSISTANT" ? " is-selected" : ""}`}
                aria-pressed={form.role === "ASSISTANT"}
                onClick={() => setForm((p) => ({ ...p, role: "ASSISTANT" }))}
                disabled={busy}
              >
                조교
              </button>
            </div>
          </div>

          <div className="modal-form-group modal-form-group--neutral">
            <label className="modal-section-label">재직 상태</label>
            <Badge
              as="button"
              variant="solid"
              status={form.is_active ? "active" : "inactive"}
              ariaPressed={form.is_active}
              onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
              disabled={busy}
            >
              {form.is_active ? "재직" : "퇴사"}
            </Badge>
            <p className="staff-helper">
              퇴사 처리하면 로그인과 관리자 권한이 중지되며 기존 근무·비용·급여 이력은 보존됩니다.
            </p>
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
