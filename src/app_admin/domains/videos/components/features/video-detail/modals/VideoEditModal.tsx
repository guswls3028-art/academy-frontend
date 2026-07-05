// PATH: src/app_admin/domains/videos/components/features/video-detail/modals/VideoEditModal.tsx
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateVideo } from "@admin/domains/videos/api/videos.api";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { feedback } from "@/shared/ui/feedback/feedback";
import { adminVideoQueryKeys } from "@admin/domains/videos/queryKeys";
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
  const initialOrderValue = normalizeOrder(initialOrder) ?? 1;
  const [orderInput, setOrderInput] = useState(String(initialOrderValue));
  const orderValue = normalizeOrder(orderInput);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setOrderInput(String(normalizeOrder(initialOrder) ?? 1));
    }
  }, [open, initialTitle, initialOrder]);

  const mutation = useMutation({
    mutationFn: () => updateVideo(videoId, { title: title.trim(), order: orderValue ?? initialOrderValue }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminVideoQueryKeys.sessionVideos });
      qc.invalidateQueries({ queryKey: adminVideoQueryKeys.statsForVideo(videoId) });
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

  const hasChanges = title.trim() !== initialTitle || orderValue !== initialOrderValue;
  const canSave = title.trim().length > 0 && orderValue != null && hasChanges && !mutation.isPending;

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
                value={orderInput}
                onChange={(e) => setOrderInput(e.target.value)}
                onBlur={() => {
                  if (orderValue == null) setOrderInput(String(initialOrderValue));
                }}
                aria-invalid={orderValue == null ? "true" : undefined}
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
            disabled={!canSave}
          >
            {mutation.isPending ? "저장 중…" : "저장"}
          </Button>
        }
      />
    </AdminModal>
  );
}

function normalizeOrder(value: number | string): number | null {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
}
