import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHomeworkMediaPreview, type HomeworkMediaFile } from "../api/homeworkMedia.api";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import HomeworkMediaImage from "@/shared/ui/media/HomeworkMediaImage";
import HomeworkMediaVideo from "@/shared/ui/media/HomeworkMediaVideo";
import { getParentStudentId } from "@/shared/api/parentStudentSelection";
import styles from "./SubmitAssignmentPage.module.css";

export default function SavedHomeworkMediaPreview({ homeworkId, enrollmentId, file, onClose }: {
  homeworkId: number;
  enrollmentId: number;
  file: HomeworkMediaFile;
  onClose: () => void;
}) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const preview = useQuery({
    queryKey: studentQueryKeys.homeworkMediaPreview(homeworkId, enrollmentId, file.id),
    queryFn: () => fetchHomeworkMediaPreview(homeworkId, file.id),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const failed = preview.isError || mediaFailed || (preview.isSuccess && !preview.data.url);
  return (
    <section className={styles.savedPreview} aria-label="제출 파일 미리보기">
      <div className={styles.previewHeading}>
        <strong>{file.original_filename}</strong>
        <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={onClose}>미리보기 닫기</button>
      </div>
      {preview.isFetching ? <p role="status">미리보기를 불러오는 중…</p> : failed ? (
        <div role="alert">
          <p>파일 미리보기를 불러오지 못했습니다. 제출된 파일은 유지됩니다.</p>
          <button type="button" className="stu-btn stu-btn--secondary" onClick={() => { setMediaFailed(false); void preview.refetch(); }}>미리보기 다시 시도</button>
        </div>
      ) : preview.data?.url ? file.media_kind === "video" ? (
        <HomeworkMediaVideo key={preview.data.url} src={preview.data.url} homeworkId={homeworkId} fileId={file.id} filename={file.original_filename} studentId={getParentStudentId()} onError={() => setMediaFailed(true)} />
      ) : (
        <HomeworkMediaImage src={preview.data.url} filename={file.original_filename} mimeType={file.mime_type} alt={`${file.original_filename} 제출 파일`} onError={() => setMediaFailed(true)} />
      ) : null}
    </section>
  );
}
