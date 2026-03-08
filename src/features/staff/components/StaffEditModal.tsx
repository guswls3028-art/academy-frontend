// PATH: src/features/staff/components/StaffEditModal.tsx
// 직원 수정 모달 — 전역 디자인 시스템(AdminModal + ModalHeader/Body/Footer) 적용.
// 학생 도메인 EditStudentModal과 동일한 구조·클래스 사용.

import { useEffect, useState } from "react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { patchStaffDetail, type StaffDetail } from "../api/staff.detail.api";
import { feedback } from "@/shared/ui/feedback/feedback";

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
    is_active: true,
  });

  useEffect(() => {
    if (!open || !staff) return;
    setForm({
      name: staff.name ?? "",
      phone: staff.phone ?? "",
      pay_type: staff.pay_type ?? "HOURLY",
      is_active: !!staff.is_active,
    });
  }, [open, staff]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleSubmit = async () => {
    if (!staff || busy) return;
    if (!String(form.name ?? "").trim()) {
      feedback.error("이름을 입력하세요.");
      return;
    }
    setBusy(true);
    try {
      await patchStaffDetail(staff.id, {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        pay_type: form.pay_type,
        is_active: form.is_active,
      });
      feedback.success("저장되었습니다.");
      onSuccess();
      onClose();
    } catch (e: any) {
      feedback.error(e?.response?.data?.detail ?? e?.message ?? "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <AdminModal open onClose={onClose} type="action" width={MODAL_WIDTH.default}>
      <ModalHeader
        type="action"
        title="직원 수정"
        description="이름·전화·급여유형·활성 상태를 수정할 수 있습니다."
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
            <div className="modal-form-row modal-form-row--1-auto" style={{ gap: 8 }}>
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
                onClick={() => setForm((p) => ({ ...p, pay_type: "MONTHLY" }))}
                disabled={busy}
              >
                월급
              </button>
            </div>
          </div>

          <div className="modal-form-group modal-form-group--neutral">
            <label className="modal-section-label">활성 상태</label>
            <button
              type="button"
              className="ds-status-badge"
              data-status={form.is_active ? "active" : "inactive"}
              aria-pressed={form.is_active}
              onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
              disabled={busy}
            >
              {form.is_active ? "활성" : "비활성"}
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
