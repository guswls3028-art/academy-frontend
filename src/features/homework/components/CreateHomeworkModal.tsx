// PATH: src/features/homework/components/CreateHomeworkModal.tsx
// ------------------------------------------------------------
// CreateHomeworkModal — 전역 모달 SSOT(AdminModal + Header/Body/Footer) 적용
// ------------------------------------------------------------
// 책임: 과제 생성 UI, 생성 성공 시 onCreated(newId) 호출
// 상태(DRAFT/OPEN/CLOSED)는 사용자 노출 없음. 생성 시 항상 백엔드 기본값(DRAFT).
// ------------------------------------------------------------

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { createHomework } from "../api/homeworks";

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  onCreated: (newId: number) => void;
};

export default function CreateHomeworkModal({
  open,
  onClose,
  sessionId,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (open) setTitle("");
  }, [open]);

  const m = useMutation({
    mutationFn: async () => {
      const res = await createHomework({
        session_id: sessionId,
        title: title.trim(),
      });
      return res;
    },
    onSuccess: (data: any) => {
      const newId = Number(data?.id);
      if (Number.isFinite(newId) && newId > 0) {
        onCreated(newId);
        onClose();
        return;
      }
      const fallbackId = Number(data?.homework_id ?? data?.pk ?? NaN);
      if (Number.isFinite(fallbackId) && fallbackId > 0) {
        onCreated(fallbackId);
        onClose();
        return;
      }
      alert(
        "과제 생성은 성공했지만 응답에서 id를 찾지 못했습니다.\n백엔드 응답 포맷을 확인하세요."
      );
    },
    onError: (e: any) => {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "과제 생성 실패 (API 연결 확인 필요)";
      alert(detail);
    },
  });

  const disabled = m.isPending || title.trim().length === 0 || !(sessionId > 0);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && !disabled) {
        e.preventDefault();
        m.mutate();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, disabled]);

  if (!open) return null;

  return (
    <AdminModal open onClose={onClose} type="action" width={MODAL_WIDTH.default}>
      <ModalHeader
        type="action"
        title="과제 생성"
        description="이 차시에 배포할 과제 제목을 입력하세요. 생성 후 설정 탭에서 기본 설정을 하고 진행하기를 누르면 배포됩니다."
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact">
          <div className="modal-form-group">
            <label className="modal-section-label">제목 (필수)</label>
            <input
              className="ds-input"
              placeholder="예) 1주차 과제"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              aria-label="과제 제목"
            />
            <p className="modal-hint modal-hint--block">session_id: {sessionId}</p>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={m.isPending}>
              취소
            </Button>
            <Button intent="primary" onClick={() => m.mutate()} disabled={disabled}>
              {m.isPending ? "생성 중…" : "생성"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
