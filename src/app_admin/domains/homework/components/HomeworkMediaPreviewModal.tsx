import { useQuery } from "@tanstack/react-query";

import {
  fetchHomeworkMediaPreview,
  type HomeworkSubmissionMediaFile,
} from "@admin/domains/submissions/api/adminHomeworkSubmissions.api";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { QUERY_KEYS } from "../queryKeys";
import styles from "../panels/HomeworkSubmissionsPanel.module.css";

type Props = {
  open: boolean;
  homeworkId: number;
  file: HomeworkSubmissionMediaFile | null;
  onClose: () => void;
};

export default function HomeworkMediaPreviewModal({ open, homeworkId, file, onClose }: Props) {
  const previewQ = useQuery({
    queryKey: QUERY_KEYS.HOMEWORK_MEDIA_PREVIEW(homeworkId, file?.id),
    queryFn: () => fetchHomeworkMediaPreview(homeworkId, file!.id),
    enabled: open && file != null && file.status === "uploaded" && !file.removed_at,
    staleTime: 8 * 60 * 1000,
    retry: 1,
  });

  return (
    <AdminModal open={open} onClose={onClose} type="inspect" width={MODAL_WIDTH.xwide}>
      <ModalHeader
        type="inspect"
        title={file?.original_filename || "과제 파일 미리보기"}
        description={file ? `${file.media_kind === "video" ? "동영상" : "사진"} · 파일 ${file.position + 1}` : undefined}
      />
      <ModalBody>
        <div className={styles.previewBody}>
          {previewQ.isLoading && <div className={styles.previewState}>안전한 미리보기를 준비하는 중…</div>}
          {previewQ.isError && (
            <div className={styles.previewState} role="alert">
              <span>파일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</span>
              <Button type="button" intent="ghost" size="sm" onClick={() => previewQ.refetch()}>다시 시도</Button>
            </div>
          )}
          {previewQ.data && file?.media_kind === "image" && (
            <img src={previewQ.data.url} alt={`${file.original_filename} 과제 제출 미리보기`} />
          )}
          {previewQ.data && file?.media_kind === "video" && (
            <video src={previewQ.data.url} controls playsInline preload="metadata">
              브라우저에서 이 동영상을 재생할 수 없습니다.
            </video>
          )}
        </div>
      </ModalBody>
      <ModalFooter right={<Button type="button" intent="secondary" size="xl" onClick={onClose}>닫기</Button>} />
    </AdminModal>
  );
}
