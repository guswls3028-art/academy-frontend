import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileImage, FileText, Video } from "lucide-react";
import { fetchHomeworkMediaPreview, type HomeworkSubmissionMediaFile } from "@/shared/api/contracts/staffHomeworkFiles";
import { assessmentQueryKeys } from "@/shared/api/queryKeys/assessments";
import PhotoPreview from "@/shared/ui/media/PhotoPreview";
import { formatCompactFileSize } from "@/shared/utils/fileSize";
import styles from "./HomeworkFileGallery.module.css";

function FileTile({ homeworkId, fingerprint, file, onOpen }: {
  homeworkId: number;
  fingerprint: string | null;
  file: HomeworkSubmissionMediaFile;
  onOpen: (file: HomeworkSubmissionMediaFile) => void;
}) {
  const descriptionId = useId();
  const tile = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const ready = file.status === "uploaded" && !file.removed_at;
  const pdf = file.mime_type === "application/pdf";
  const photo = file.media_kind === "image" && !pdf;
  useEffect(() => {
    if (!ready || !photo || !tile.current || visible) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true);
    }, { rootMargin: "450px 0px" });
    observer.observe(tile.current);
    return () => observer.disconnect();
  }, [ready, photo, visible]);
  const preview = useQuery({
    queryKey: assessmentQueryKeys.homeworkMediaPreview(homeworkId, file.id, fingerprint),
    queryFn: () => fetchHomeworkMediaPreview(homeworkId, file.id),
    enabled: ready && photo && visible,
    staleTime: 8 * 60 * 1000,
    retry: false,
  });
  const kind = pdf ? "PDF" : photo ? "사진" : "동영상";
  const Icon = pdf ? FileText : photo ? FileImage : Video;
  const url = preview.data?.url;
  const broken = preview.isError || Boolean(url && failedUrl === url);
  const status = file.removed_at || file.status === "removed" ? "교체됨"
    : file.status === "failed" ? "업로드 실패" : file.status === "uploading" ? "저장 중" : ready ? "검수 가능" : "확인 필요";
  return (
    <div ref={tile} className={styles.fileRow} data-status={file.status}>
      <button type="button" className={styles.tile} aria-label="미리보기" aria-describedby={descriptionId + "-number " + descriptionId}
        title={`${file.position + 1}번 ${file.original_filename} 미리보기`} disabled={!ready}
        onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onOpen(file); }}>
        <span className={styles.picture}>
          {ready && photo && url && !broken
            ? <PhotoPreview src={url} filename={file.original_filename} mimeType={file.mime_type}
                alt={`${file.position + 1}번 제출 사진`} thumbnail onError={() => setFailedUrl(url)} />
            : ready && photo && !broken ? <span className={styles.photoLoading}>사진 불러오는 중…</span>
            : <Icon aria-hidden="true" size={25} />}
          <span id={descriptionId + "-number"} className={styles.number}>{file.position + 1}</span>
        </span>
        <strong id={descriptionId} className={styles.filename}>{file.original_filename}</strong>
        <span className={styles.detail}>{kind} · {formatCompactFileSize(file.file_size) || status}</span>
      </button>
      {!ready && <span className={styles.detail}>{status}{file.error_message && <> · <span>{file.error_message}</span></>}</span>}
      {ready && photo && broken && <button type="button" className={styles.retry} onClick={() => {
        setFailedUrl(null);
        void preview.refetch();
      }}>사진 다시 불러오기</button>}
    </div>
  );
}

export default function HomeworkFileGallery({ homeworkId, files, fingerprint, onOpen }: {
  homeworkId: number;
  files: HomeworkSubmissionMediaFile[];
  fingerprint: string | null;
  onOpen: (file: HomeworkSubmissionMediaFile) => void;
}) {
  return (
    <div className={styles.gallery} role="group" aria-label="제출 파일">
      {files.map((file) => <FileTile key={file.id} homeworkId={homeworkId} fingerprint={fingerprint} file={file} onOpen={onOpen} />)}
    </div>
  );
}
