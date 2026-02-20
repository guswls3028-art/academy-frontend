// PATH: src/features/homework/components/CreateHomeworkModal.tsx
// ------------------------------------------------------------
// CreateHomeworkModal — 전역 모달 SSOT(AdminModal + Header/Body/Footer) 적용
// ------------------------------------------------------------
// 책임: 과제 생성 UI, 생성 성공 시 onCreated(newId) 호출
// 백엔드 편차: session_id / session 둘 다 전송
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

type HomeworkStatus = "DRAFT" | "OPEN" | "CLOSED";

export default function CreateHomeworkModal({
  open,
  onClose,
  sessionId,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<HomeworkStatus>("DRAFT");

  useEffect(() => {
    if (open) {
      setTitle("");
      setStatus("DRAFT");
    }
  }, [open]);

  const m = useMutation({
    mutationFn: async () => {
      const res = await createHomework({
        session_id: sessionId,
        title: title.trim(),
        status,
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

  if (!open) return null;

  const disabled = m.isPending || title.trim().length === 0 || !(sessionId > 0);

  return (
    <AdminModal open onClose={onClose} type="action" width={MODAL_WIDTH.default}>
      <ModalHeader
        type="action"
        title="과제 생성"
        description="이 차시에 배포할 과제 제목과 상태를 입력하세요."
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
            <label className="modal-section-label">상태</label>
            <select
              className="ds-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as HomeworkStatus)}
              aria-label="과제 상태"
            >
              <option value="DRAFT">DRAFT</option>
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
            </select>
            <p className="modal-hint modal-hint--block">session_id: {sessionId}</p>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        left={<span className="modal-hint">ESC 로 닫기</span>}
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
