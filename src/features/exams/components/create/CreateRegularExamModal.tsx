// PATH: src/features/exams/components/create/CreateRegularExamModal.tsx
// ------------------------------------------------------------
// 시험 생성 모달 — 과제와 동일: 제목만 입력 후 생성. 템플릿·세부 설정은 시험 설정에서.
// ------------------------------------------------------------

import { useEffect, useState } from "react";
import api from "@/shared/api/axios";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  lectureId?: number;
  onCreated: (examId: number) => void;
};

export default function CreateRegularExamModal({
  open,
  onClose,
  sessionId,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setError(null);
    setSubmitting(false);
  }, [open]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("시험 제목을 입력하세요.");
      return;
    }
    if (!sessionId) {
      setError("세션 정보가 없습니다.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post("/exams/", {
        title: title.trim(),
        description: "",
        exam_type: "regular",
        session_id: sessionId,
      });
      const newExamId = Number(res.data?.id);
      if (!newExamId) throw new Error("생성 후 ID를 받지 못했습니다.");
      onCreated(newExamId);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "시험 생성 실패. 입력값을 확인하세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || !title.trim() || !(sessionId > 0);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && !disabled) {
        e.preventDefault();
        handleSubmit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, disabled]);

  if (!open) return null;

  return (
    <AdminModal open onClose={onClose} type="action" width={MODAL_WIDTH.default} onEnterConfirm={!disabled ? handleSubmit : undefined}>
      <ModalHeader
        type="action"
        title="시험 생성"
        description="이 차시에 배포할 시험 제목을 입력하세요. 템플릿·합격점·공개 기간은 생성 후 시험 설정에서 지정할 수 있습니다."
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact">
          {error && (
            <div className="modal-hint modal-hint--block" style={{ color: "var(--color-error)", fontWeight: 700 }}>
              {error}
            </div>
          )}

          <div className="modal-form-group">
            <label className="modal-section-label">제목 (필수)</label>
            <input
              className="ds-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 3월 모의고사"
              autoFocus
              aria-label="시험 제목"
            />
            <p className="modal-hint modal-hint--block">session_id: {sessionId}</p>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={submitting}>
              취소
            </Button>
            <Button intent="primary" onClick={handleSubmit} disabled={disabled}>
              {submitting ? "생성 중…" : "생성"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
