import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { updateVideoPolicyBulk } from "@admin/domains/videos/api/videos.api";
import VideoPolicyFields from "../components/VideoPolicyFields";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { feedback } from "@/shared/ui/feedback/feedback";
import "./VideoBulkPolicyModal.css";


type Props = {
  open: boolean;
  sessionId: number;
  videoIds: number[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

function errorMessage(error: unknown): string {
  return (
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    || (error as Error)?.message
    || "영상 재생 설정을 저장하지 못했습니다."
  );
}

export default function VideoBulkPolicyModal({
  open,
  sessionId,
  videoIds,
  onClose,
  onSaved,
}: Props) {
  const [allowSkipValue, setAllowSkipValue] = useState("");
  const [maxSpeedValue, setMaxSpeedValue] = useState("");
  const [error, setError] = useState("");
  const canSave = (
    (allowSkipValue !== "" || maxSpeedValue !== "")
    && videoIds.length > 0
  );

  const mutation = useMutation({
    mutationFn: () => updateVideoPolicyBulk({
      session_id: sessionId,
      video_ids: videoIds,
      ...(allowSkipValue !== "" ? { allow_skip: allowSkipValue === "true" } : {}),
      ...(maxSpeedValue !== "" ? { max_speed: Number(maxSpeedValue) } : {}),
    }),
    onMutate: () => setError(""),
    onSuccess: async () => {
      await onSaved();
      feedback.success(`${videoIds.length}개 영상의 재생 설정을 변경했습니다.`);
    },
    onError: (mutationError: unknown) => {
      const message = errorMessage(mutationError);
      setError(message);
      feedback.error(message);
    },
  });

  const save = () => {
    if (canSave && !mutation.isPending) mutation.mutate();
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      width={MODAL_WIDTH.md}
      className="video-bulk-policy-modal"
      onEnterConfirm={canSave && !mutation.isPending ? save : undefined}
      closeDisabled={mutation.isPending}
    >
      <ModalHeader title="영상 일괄 재생 설정" />
      <ModalBody>
        <p className="video-bulk-policy-modal__summary">
          선택한 {videoIds.length}개 영상에서 바꿀 항목만 고르세요.
        </p>
        <VideoPolicyFields
          allowSkipValue={allowSkipValue}
          maxSpeedValue={maxSpeedValue}
          onAllowSkipChange={setAllowSkipValue}
          onMaxSpeedChange={setMaxSpeedValue}
          allowUnchanged
          disabled={mutation.isPending}
        />
        {error && (
          <div className="video-bulk-policy-modal__error" role="alert">
            {error}
          </div>
        )}
      </ModalBody>
      <ModalFooter
        left={(
          <Button intent="secondary" onClick={onClose} disabled={mutation.isPending}>
            취소
          </Button>
        )}
        right={(
          <Button
            intent="primary"
            onClick={save}
            disabled={!canSave || mutation.isPending}
            loading={mutation.isPending}
          >
            {videoIds.length}개 영상에 적용
          </Button>
        )}
      />
    </AdminModal>
  );
}
