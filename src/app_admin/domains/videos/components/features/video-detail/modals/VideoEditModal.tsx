// PATH: src/app_admin/domains/videos/components/features/video-detail/modals/VideoEditModal.tsx
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateVideo } from "@admin/domains/videos/api/videos.api";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { feedback } from "@/shared/ui/feedback/feedback";
import "./VideoEditModal.css";

interface VideoEditModalProps {
  open: boolean;
  onClose: () => void;
  videoId: number;
  initialTitle: string;
  initialOrder: number;
  sessionId?: number;
}

export default function VideoEditModal({
  open,
  onClose,
  videoId,
  initialTitle,
  initialOrder,
}: VideoEditModalProps) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(initialTitle);
  const [order, setOrder] = useState(initialOrder);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setOrder(initialOrder);
    }
  }, [open, initialTitle, initialOrder]);

  const mutation = useMutation({
    mutationFn: () => updateVideo(videoId, { title: title.trim(), order }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-videos"] });
      qc.invalidateQueries({ queryKey: ["video-stats", videoId] });
      feedback.success("영상 정보를 수정했습니다.");
      onClose();
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ||
        (e as Error)?.message ||
        "수정에 실패했습니다.";
      feedback.error(msg);
    },
  });

  const hasChanges = title.trim() !== initialTitle || order !== initialOrder;
  const canSave = title.trim().length > 0 && hasChanges;

  const handleSave = () => {
    if (!canSave) return;
    mutation.mutate();
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      width={MODAL_WIDTH.sm}
      onEnterConfirm={canSave ? handleSave : undefined}
    >
      <ModalHeader title="영상 정보 수정" />
      <ModalBody>
        <div className="video-edit-form">
          <div>
            <label className="video-edit-label">
              영상 제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="video-edit-input video-edit-input--title"
            />
          </div>
          <div>
            <label className="video-edit-label">
              표시 순서
            </label>
            <div className="video-edit-order-row">
              <input
                type="number"
                min={1}
                value={order}
                onChange={(e) => setOrder(Math.max(1, parseInt(e.target.value) || 1))}
                className="video-edit-input video-edit-input--order"
              />
              <span className="video-edit-help">
                숫자가 작을수록 먼저 표시됩니다
              </span>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        left={
          <Button intent="secondary" onClick={onClose}>
            취소
          </Button>
        }
        right={
          <Button
            intent="primary"
            onClick={handleSave}
            disabled={!canSave || mutation.isPending}
          >
            {mutation.isPending ? "저장 중…" : "저장"}
          </Button>
        }
      />
    </AdminModal>
  );
}
