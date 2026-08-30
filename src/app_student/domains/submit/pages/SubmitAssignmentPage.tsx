/** 과제 제출 — 사진·동영상 여러 개를 파일별로 안전하게 제출한다. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";

import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import EmptyState from "@student/layout/EmptyState";
import { useMyGradesSummary } from "@student/domains/grades/hooks/useMyGradesSummary";
import type { MyExamGradeSummary, MyHomeworkGradeSummary } from "@student/domains/grades/api/grades.api";
import type { HomeworkMediaFile } from "@student/domains/submit/api/homeworkMedia.api";
import { fetchHomeworkMedia, removeHomeworkMedia } from "@student/domains/submit/api/homeworkMedia.api";
import studentApi from "@student/shared/api/student.api";
import { IconChevronRight, IconExam, IconClipboard, IconImage, IconVideo } from "@student/shared/ui/icons/Icons";
import { studentToast } from "@student/shared/ui/feedback/studentToast";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import { useAuthContext } from "@/auth/context/AuthContext";
import { useTrackedTask } from "@/shared/productAnalytics";
import { formatCompactFileSize } from "@/shared/utils/fileSize";
import styles from "./SubmitAssignmentPage.module.css";

const ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.avif,.mp4,.m4v,.mov,.webm,image/*,video/*";
const DEFAULT_LIMITS = {
  max_files: 20,
  max_file_size_bytes: 100 * 1024 * 1024,
  max_total_size_bytes: 500 * 1024 * 1024,
};

type SelectedTarget = { type: "homework"; id: number; title: string; enrollmentId: number };
type PendingMedia = {
  clientFileId: string;
  uploadBatchId: string;
  file: File;
  position: number;
  status: "queued" | "uploading" | "failed";
  progress: number;
  error: string | null;
};

function positiveId(value: string | null): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isSupportedSubmissionFile(file: File): boolean {
  return /\.(?:avif|gif|heic|heif|jpe?g|png|webp|m4v|mov|mp4|webm)$/i.test(file.name);
}

function apiErrorMessage(error: unknown, fallback = "제출에 실패했습니다."): string {
  const data = (error as { response?: { data?: Record<string, unknown> } } | null)?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (data && typeof data === "object") {
    const fields = Object.entries(data)
      .filter(([key]) => key !== "code")
      .flatMap(([key, value]) => Array.isArray(value)
        ? value.map((item) => `${key}: ${String(item)}`)
        : typeof value === "string" ? [`${key}: ${value}`] : []);
    if (fields.length > 0) return fields.join(" · ");
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function mediaStatusLabel(file: HomeworkMediaFile): string {
  if (file.status === "failed") return "업로드 실패";
  if (file.status === "uploading") return "저장 중";
  return "선생님 확인 대기";
}

function LocalMediaPreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const isVideo = file.type.startsWith("video/") || /\.(?:m4v|mov|mp4|webm)$/i.test(file.name);
  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setPreviewFailed(false);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);
  if (!previewUrl || previewFailed) {
    return <span className={styles.previewPlaceholder} aria-hidden="true">{isVideo ? <IconVideo /> : <IconImage />}</span>;
  }
  if (isVideo) return <video className={styles.localPreview} src={previewUrl} muted playsInline preload="metadata" onError={() => setPreviewFailed(true)} />;
  return <img className={styles.localPreview} src={previewUrl} alt="선택한 과제 사진 미리보기" onError={() => setPreviewFailed(true)} />;
}

export default function SubmitAssignmentPage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthContext();
  const runTrackedTask = useTrackedTask();
  const isParent = user?.tenantRole === "parent";
  const [selected, setSelected] = useState<SelectedTarget | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const gradesQ = useMyGradesSummary({ enabled: !isParent });
  const grades = gradesQ.data;
  const requestedSessionId = positiveId(searchParams.get("sessionId"));
  const requestedHomeworkId = positiveId(searchParams.get("homeworkId"));

  const unfinishedHomeworks = useMemo(
    () => (grades?.homeworks ?? []).filter((homework) => (
      (requestedSessionId == null || Number(homework.session_id) === requestedSessionId)
      && homework.lecture_active !== false
      && homework.teacher_resolved !== true
      && homework.passed !== true
    )),
    [grades?.homeworks, requestedSessionId],
  );
  const unfinishedExams = useMemo(
    () => (grades?.exams ?? []).filter((exam) => (
      (requestedSessionId == null || Number(exam.session_id) === requestedSessionId)
      && exam.lecture_active !== false
      && exam.achievement !== "REMEDIATED"
      && (exam.is_pass === false || exam.achievement === "FAIL" || exam.achievement === "NOT_SUBMITTED"
        || exam.meta_status === "NOT_SUBMITTED" || exam.total_score == null)
    )),
    [grades?.exams, requestedSessionId],
  );

  const mediaQ = useQuery({
    queryKey: studentQueryKeys.homeworkMedia(selected?.id, selected?.enrollmentId),
    queryFn: () => fetchHomeworkMedia(selected!.id, selected!.enrollmentId),
    enabled: selected != null,
    retry: 1,
  });
  const limits = mediaQ.data?.limits ?? DEFAULT_LIMITS;
  const pendingClientIds = useMemo(() => new Set(pendingFiles.map((file) => file.clientFileId)), [pendingFiles]);
  const visibleServerFiles = (mediaQ.data?.files ?? []).filter(
    (file) => !file.client_file_id || !pendingClientIds.has(file.client_file_id),
  );
  const updatePending = (clientFileId: string, changes: Partial<PendingMedia>) => {
    setPendingFiles((current) => current.map((item) => item.clientFileId === clientFileId ? { ...item, ...changes } : item));
  };

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (gradesQ.isError) throw new Error("제출 대상을 다시 불러온 뒤 제출해 주세요.");
      if (!selected) throw new Error("제출 대상을 선택해 주세요.");
      const candidates = pendingFiles.filter((item) => item.status === "queued" || item.status === "failed");
      if (candidates.length === 0) throw new Error("새로 제출할 파일을 선택해 주세요.");
      const succeeded: string[] = [];
      const failed: string[] = [];
      for (const item of candidates) {
        updatePending(item.clientFileId, { status: "uploading", progress: 0, error: null });
        const body = new FormData();
        body.append("enrollment_id", String(selected.enrollmentId));
        body.append("client_file_id", item.clientFileId);
        body.append("upload_batch_id", item.uploadBatchId);
        body.append("position", String(item.position));
        body.append("file", item.file);
        try {
          await runTrackedTask("assignments.student.submit", () => studentApi.post(
            `/submissions/submissions/homework/${selected.id}/media/`,
            body,
            {
              headers: { "Content-Type": "multipart/form-data" },
              onUploadProgress: (event) => {
                if (!event.total) return;
                updatePending(item.clientFileId, {
                  progress: Math.min(100, Math.round((event.loaded / event.total) * 100)),
                });
              },
            },
          ));
          succeeded.push(item.clientFileId);
        } catch (uploadError) {
          failed.push(item.clientFileId);
          updatePending(item.clientFileId, { status: "failed", error: apiErrorMessage(uploadError, "이 파일을 올리지 못했습니다.") });
        }
      }
      return { succeeded, failed };
    },
    onSuccess: async ({ succeeded, failed }) => {
      setPendingFiles((current) => current.filter((item) => !succeeded.includes(item.clientFileId)));
      await mediaQ.refetch();
      qc.invalidateQueries({ queryKey: studentQueryKeys.gradesSummary });
      if (failed.length === 0) {
        const title = selected?.title ?? "과제";
        setSelected(null);
        setPendingFiles([]);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        studentToast.success(`${title} 파일 ${succeeded.length}개를 제출했습니다.`);
      } else {
        setError(succeeded.length > 0
          ? `${succeeded.length}개는 제출됐고 ${failed.length}개는 실패했습니다. 실패한 파일만 다시 시도해 주세요.`
          : `${failed.length}개 파일을 올리지 못했습니다. 파일별 오류를 확인해 주세요.`);
      }
    },
    onError: (uploadError) => setError(apiErrorMessage(uploadError)),
  });

  const removeMut = useMutation({
    mutationFn: async (file: HomeworkMediaFile) => {
      if (!selected) throw new Error("제출 대상을 다시 선택해 주세요.");
      await removeHomeworkMedia(selected.id, selected.enrollmentId, file.id);
    },
    onSuccess: async () => {
      await mediaQ.refetch();
      qc.invalidateQueries({ queryKey: studentQueryKeys.gradesSummary });
      studentToast.success("파일을 제출 목록에서 뺐습니다.");
    },
    onError: (removeError) => setError(apiErrorMessage(removeError, "파일을 변경하지 못했습니다.")),
  });

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";
    setError(null);
    uploadMut.reset();
    if (incoming.length === 0) return;
    const existing = mediaQ.data?.files ?? [];
    const unmatchedServerFiles = existing.filter(
      (file) => !file.client_file_id || !pendingClientIds.has(file.client_file_id),
    );
    const occupiedPositions = new Set([
      ...unmatchedServerFiles.map((file) => file.position),
      ...pendingFiles.map((file) => file.position),
    ]);
    const localSignatures = new Set(pendingFiles.map(({ file }) => `${file.name}:${file.size}:${file.lastModified}`));
    let activeCount = unmatchedServerFiles.length + pendingFiles.length;
    let totalSize = unmatchedServerFiles.reduce((sum, file) => sum + file.file_size, 0)
      + pendingFiles.reduce((sum, item) => sum + item.file.size, 0);
    const batchId = uuid();
    const accepted: PendingMedia[] = [];
    const rejected: string[] = [];
    for (const file of incoming) {
      const signature = `${file.name}:${file.size}:${file.lastModified}`;
      if (localSignatures.has(signature)) { rejected.push(`${file.name}: 이미 선택됨`); continue; }
      if (!isSupportedSubmissionFile(file)) { rejected.push(`${file.name}: 지원하지 않는 형식`); continue; }
      if (file.size <= 0 || file.size > limits.max_file_size_bytes) { rejected.push(`${file.name}: 파일당 ${formatCompactFileSize(limits.max_file_size_bytes)} 초과`); continue; }
      const persistedRetry = existing.find((serverFile) => (
        serverFile.status === "failed"
        && serverFile.client_file_id != null
        && serverFile.original_filename === file.name
        && serverFile.file_size === file.size
        && !pendingClientIds.has(serverFile.client_file_id)
      ));
      if (persistedRetry?.client_file_id) {
        localSignatures.add(signature);
        accepted.push({
          clientFileId: persistedRetry.client_file_id,
          uploadBatchId: batchId,
          file,
          position: persistedRetry.position,
          status: "failed",
          progress: 0,
          error: "다시 제출할 파일을 선택했습니다.",
        });
        continue;
      }
      if (activeCount >= limits.max_files) { rejected.push(`${file.name}: 최대 ${limits.max_files}개 초과`); continue; }
      if (totalSize + file.size > limits.max_total_size_bytes) { rejected.push(`${file.name}: 전체 ${formatCompactFileSize(limits.max_total_size_bytes)} 초과`); continue; }
      let position = 0;
      while (occupiedPositions.has(position)) position += 1;
      if (position >= limits.max_files) { rejected.push(`${file.name}: 넣을 수 있는 순서가 없음`); continue; }
      occupiedPositions.add(position);
      localSignatures.add(signature);
      activeCount += 1;
      totalSize += file.size;
      accepted.push({ clientFileId: uuid(), uploadBatchId: batchId, file, position, status: "queued", progress: 0, error: null });
    }
    setPendingFiles((current) => [...current, ...accepted]);
    if (rejected.length > 0) setError(`${rejected.slice(0, 3).join(" · ")}${rejected.length > 3 ? ` 외 ${rejected.length - 3}개` : ""}`);
  };

  const removePending = (clientFileId: string) => {
    setPendingFiles((current) => current.filter((file) => file.clientFileId !== clientFileId));
  };
  const selectHomework = (homework: MyHomeworkGradeSummary) => {
    const next: SelectedTarget = { type: "homework", id: homework.homework_id, title: homework.title, enrollmentId: homework.enrollment_id };
    const changed = selected?.id !== next.id || selected?.enrollmentId !== next.enrollmentId;
    setSelected(next);
    void studentApi.post("/students/me/activity/homework-open/", { homework_id: homework.homework_id }).catch(() => undefined);
    setError(null);
    uploadMut.reset();
    if (changed) {
      setPendingFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  useEffect(() => {
    if (selected != null || requestedHomeworkId == null) return;
    const requestedHomework = unfinishedHomeworks.find(
      (homework) => homework.homework_id === requestedHomeworkId,
    );
    if (!requestedHomework) return;
    setSelected({
      type: "homework",
      id: requestedHomework.homework_id,
      title: requestedHomework.title,
      enrollmentId: requestedHomework.enrollment_id,
    });
    void studentApi.post(
      "/students/me/activity/homework-open/",
      { homework_id: requestedHomework.homework_id },
    ).catch(() => undefined);
  }, [requestedHomeworkId, selected, unfinishedHomeworks]);
  const retryableCount = pendingFiles.filter((file) => file.status !== "uploading").length;
  const canSubmit = selected != null && retryableCount > 0 && !uploadMut.isPending && !gradesQ.isError && !mediaQ.isError;
  const submitButtonLabel = uploadMut.isPending
    ? "파일별로 제출 중…"
    : retryableCount === 0
      ? "새 파일을 선택해 주세요"
      : pendingFiles.some((file) => file.status === "failed")
        ? `실패한 파일 ${retryableCount}개 다시 제출`
        : `파일 ${retryableCount}개 제출하기`;

  if (isParent) return (
    <StudentPageShell title="과제 제출" onBack={() => window.history.back()}>
      <EmptyState title="학부모 계정은 직접 제출할 수 없습니다." description="자녀 본인 계정으로 로그인 후 제출해 주세요. 자녀 진척 확인은 성적 페이지에서 가능합니다." />
    </StudentPageShell>
  );

  return (
    <StudentPageShell title="과제 제출" description="풀이 사진과 동영상을 제출하면 선생님이 직접 확인합니다." descriptionMode="help" onBack={() => window.history.back()}>
      <div className={`stu-section stu-section--nested ${styles.section}`}>
        {(uploadMut.isError || error) && <div role="alert" className={styles.errorMessage}>{error || apiErrorMessage(uploadMut.error)}</div>}
        {requestedSessionId != null && (
          <div className={styles.scopeNotice} role="status">
            <div><strong>현재 차시의 제출 항목만 표시합니다</strong><span>다른 수업의 파일을 잘못 제출하지 않도록 범위를 고정했습니다.</span></div>
            <Link to="/student/submit/assignment" className={styles.scopeLink}>전체 미완료 보기</Link>
          </div>
        )}
        {uploadMut.isSuccess && uploadMut.data?.failed.length === 0 && (
          <div className={styles.successMessage}><span>선택한 파일을 모두 제출했습니다. 선생님 확인을 기다려 주세요.</span><Link to="/student/grades" className={styles.successLink}>학습 현황<IconChevronRight className={styles.successLinkIcon} aria-hidden="true" /></Link></div>
        )}

        <div data-guide="submit-target">
          <div className={styles.stepLabel}>1. 제출 대상 선택</div>
          {gradesQ.isLoading && <div className={`stu-muted ${styles.loadingText}`}>불러오는 중…</div>}
          {gradesQ.isError && <EmptyState title="제출 대상을 불러오지 못했습니다." description="미완료 과제·시험이 없는 것으로 표시하지 않았습니다." onRetry={() => void gradesQ.refetch()} />}
          {!gradesQ.isLoading && !gradesQ.isError && unfinishedHomeworks.length === 0 && unfinishedExams.length === 0 && <div className={styles.emptyTarget}>{requestedSessionId == null ? "제출할 미완료 과제·시험이 없습니다." : "이 차시에 제출할 미완료 과제·시험이 없습니다."}</div>}
          {!gradesQ.isError && <div className={styles.targetList}>
            {unfinishedHomeworks.map((homework) => (
              <button key={`hw-${homework.homework_id}`} type="button" onClick={() => selectHomework(homework)} disabled={uploadMut.isPending} className={styles.targetItem} data-selected={selected?.id === homework.homework_id}>
                <span className={styles.targetIcon}><IconClipboard className={styles.targetIconSvg} /></span><span className={styles.targetBadge}>과제</span><span className={styles.targetTitle}>{homework.title}</span>{homework.lecture_title && <span className={`stu-muted ${styles.targetLecture}`}>{homework.lecture_title}</span>}
              </button>
            ))}
            {unfinishedExams.map((exam: MyExamGradeSummary) => (
              <Link key={`ex-${exam.exam_id}`} to={`/student/exams/${exam.exam_id}/submit`} className={styles.targetItem} aria-disabled={uploadMut.isPending} tabIndex={uploadMut.isPending ? -1 : undefined} onClick={(event) => { if (uploadMut.isPending) event.preventDefault(); }}>
                <span className={styles.targetIcon}><IconExam className={styles.targetIconSvg} /></span><span className={styles.targetBadge}>시험</span><span className={styles.targetTitle}>{exam.title}</span>{exam.lecture_title && <span className={`stu-muted ${styles.targetLecture}`}>{exam.lecture_title}</span>}
              </Link>
            ))}
          </div>}
        </div>

        {selected && (
          <div data-guide="submit-file" className={styles.mediaWorkspace}>
            <div className={styles.mediaHeading}>
              <div><div className={styles.stepLabel}>2. 사진·동영상 준비</div><p>한 번에 최대 {limits.max_files}개 · 파일당 {formatCompactFileSize(limits.max_file_size_bytes)} · 전체 {formatCompactFileSize(limits.max_total_size_bytes)}</p></div>
              <span className={styles.fileCount}>{visibleServerFiles.length + pendingFiles.length}/{limits.max_files}</span>
            </div>
            <input ref={fileInputRef} type="file" accept={ACCEPT} multiple onChange={onFileChange} className={styles.hiddenInput} />
            <button type="button" className={`stu-btn stu-btn--secondary ${styles.fileButton}`} onClick={() => fileInputRef.current?.click()} disabled={uploadMut.isPending || mediaQ.isLoading || mediaQ.isError}>사진·동영상 여러 개 선택</button>
            {mediaQ.isLoading && <div className={styles.mediaLoading}>현재 제출 파일을 확인하는 중…</div>}
            {mediaQ.isError && <div className={styles.mediaQueryError} role="alert"><span>현재 제출 파일을 불러오지 못해 새 업로드를 잠갔습니다.</span><button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={() => void mediaQ.refetch()}>다시 시도</button></div>}

            {visibleServerFiles.length > 0 && (
              <section className={styles.persistedSection} aria-label="이미 제출한 파일">
                <div className={styles.fileSectionTitle}>이미 제출한 파일 <b>{visibleServerFiles.length}</b></div>
                <div className={styles.persistedList}>{visibleServerFiles.map((file) => (
                  <div className={styles.persistedFile} key={file.id} data-status={file.status}>
                    <span className={styles.persistedIcon}>{file.media_kind === "video" ? <IconVideo /> : <IconImage />}</span>
                    <span className={styles.persistedInfo}><b>{file.original_filename}</b><small>{formatCompactFileSize(file.file_size)} · {mediaStatusLabel(file)}</small>{file.error_message && <em>{file.error_message}</em>}</span>
                    <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={() => removeMut.mutate(file)} disabled={uploadMut.isPending || removeMut.isPending}>빼기</button>
                  </div>
                ))}</div>
              </section>
            )}

            {pendingFiles.length > 0 && (
              <section className={styles.pendingSection} aria-label="이번에 제출할 파일">
                <div className={styles.fileSectionTitle}>이번에 제출할 파일 <b>{pendingFiles.length}</b></div>
                <div className={styles.pendingGrid}>{pendingFiles.map((item, index) => (
                  <article className={styles.pendingCard} key={item.clientFileId} data-status={item.status}>
                    <div className={styles.previewFrame}><LocalMediaPreview file={item.file} /><span className={styles.orderChip}>{index + 1}</span></div>
                    <div className={styles.pendingMeta}><b title={item.file.name}>{item.file.name}</b><span>{formatCompactFileSize(item.file.size)}</span>{item.status === "uploading" && <progress className={styles.progressTrack} aria-label={`${item.file.name} ${item.progress}% 업로드`} max={100} value={item.progress} />}{item.status === "failed" && <em>{item.error || "이 파일을 올리지 못했습니다."}</em>}</div>
                    <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={() => removePending(item.clientFileId)} disabled={item.status === "uploading" || uploadMut.isPending}>선택 취소</button>
                  </article>
                ))}</div>
              </section>
            )}
          </div>
        )}

        {selected && (
          <div className={styles.submitRow}>
            <div className={styles.submitSummary}><span>제출 대상</span><b>{selected.title}</b><small>파일별로 저장되어 일부 실패해도 성공한 파일은 유지됩니다.</small></div>
            <button type="button" data-guide="submit-btn" className={`stu-btn stu-btn--primary ${styles.submitButton}`} disabled={!canSubmit} onClick={() => uploadMut.mutate()}>
              {submitButtonLabel}
            </button>
          </div>
        )}
      </div>
    </StudentPageShell>
  );
}
