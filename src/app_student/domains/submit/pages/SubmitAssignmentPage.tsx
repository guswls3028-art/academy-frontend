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
import { useTrackedTask } from "@/shared/productAnalytics";
import { useAuthContext } from "@/auth/context/AuthContext";
import { formatCompactFileSize } from "@/shared/utils/fileSize";
import { createRandomUuid as uuid } from "@/shared/utils/randomUuid";
import HomeworkMediaImage from "@/shared/ui/media/HomeworkMediaImage";
import styles from "./SubmitAssignmentPage.module.css";
import SavedHomeworkMediaPreview from "./SavedHomeworkMediaPreview";
import { useHomeworkDraft, type PendingMedia } from "../hooks/useHomeworkDraft";
import { uploadHomeworkFile } from "../api/uploadHomeworkFile";

const ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.avif,.mp4,.m4v,.mov,.webm,image/*,video/*";
const DEFAULT_LIMITS = {
  max_files: 20,
  max_file_size_bytes: 100 * 1024 * 1024,
  max_total_size_bytes: 500 * 1024 * 1024,
};

type SelectedTarget = { type: "homework"; id: number; title: string; enrollmentId: number };

function positiveId(value: string | null): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function acceptsHomeworkFiles(homework: MyHomeworkGradeSummary): boolean {
  return homework.lecture_active !== false && homework.submission_state !== "reviewed"
    && (homework.submission_media_locked == null
      ? homework.teacher_resolved !== true && homework.passed !== true
      : homework.submission_media_locked !== true);
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

function apiErrorCode(error: unknown): string {
  const data = (error as { response?: { data?: Record<string, unknown> } } | null)?.response?.data;
  return typeof data?.code === "string" ? data.code : "";
}

function mediaStatusLabel(file: HomeworkMediaFile): string {
  if (file.status === "failed") return "업로드 실패";
  if (file.status === "uploading") return "저장 중";
  if (file.status === "done") return "검사됨";
  return "제출됨";
}

function LocalMediaPreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const isVideo = file.type.startsWith("video/") || /\.(?:m4v|mov|mp4|webm)$/i.test(file.name);
  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setPreviewFailed(false);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);
  if (previewFailed) return <span className={styles.previewRecovery}><span>미리보기를 열지 못했습니다</span><button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={() => { setAttempt((value) => value + 1); setPreviewFailed(false); }}>미리보기 재시도</button><small>원본 파일은 그대로 제출됩니다.</small></span>;
  if (!previewUrl) {
    return <span className={styles.previewPlaceholder} aria-hidden="true">{isVideo ? <IconVideo /> : <IconImage />}</span>;
  }
  if (isVideo) return <video key={attempt} className={styles.localPreview} src={previewUrl} muted playsInline preload="metadata" onError={() => setPreviewFailed(true)} />;
  return <HomeworkMediaImage key={attempt} thumbnail className={styles.localPreview} src={previewUrl} blob={file} filename={file.name} mimeType={file.type} alt="선택한 과제 사진 미리보기" onError={() => setPreviewFailed(true)} />;
}

export default function SubmitAssignmentPage() {
  const qc = useQueryClient();
  const { user } = useAuthContext();
  const recordsStudentActivity = user?.tenantRole === "student";
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const runTrackedTask = useTrackedTask();
  const [selected, setSelected] = useState<SelectedTarget | null>(null);
  const { files: pendingFiles, setFiles: setPendingFiles, draftStatus } = useHomeworkDraft(selected, user?.id);
  const uploadController = useRef<AbortController | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [isPreparingFiles, setIsPreparingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewLocked, setReviewLocked] = useState(false);
  const [previewFile, setPreviewFile] = useState<HomeworkMediaFile | null>(null);
  const gradesQ = useMyGradesSummary();
  const grades = gradesQ.data;
  const requestedSessionId = positiveId(searchParams.get("sessionId"));
  const requestedHomeworkId = positiveId(searchParams.get("homeworkId"));

  const unfinishedHomeworks = useMemo(
    () => (grades?.homeworks ?? []).filter((homework) => (
      (requestedSessionId == null || Number(homework.session_id) === requestedSessionId)
      && acceptsHomeworkFiles(homework)
    )),
    [grades?.homeworks, requestedSessionId],
  );
  const unfinishedExams = useMemo(
    () => (grades?.exams ?? []).filter((exam) => (
      (requestedSessionId == null || Number(exam.session_id) === requestedSessionId)
      && exam.lecture_active !== false
      && exam.submission_pending !== true
      && exam.grading_status !== "subjective_pending"
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
    staleTime: 0,
  });
  const limits = mediaQ.data?.limits ?? DEFAULT_LIMITS;
  const pendingClientIds = useMemo(() => new Set(pendingFiles.map((file) => file.clientFileId)), [pendingFiles]);
  const visibleServerFiles = (mediaQ.data?.files ?? []).filter(
    (file) => !file.client_file_id || !pendingClientIds.has(file.client_file_id),
  );
  const updatePending = (clientFileId: string, changes: Partial<PendingMedia>) => {
    setPendingFiles((current) => current.map((item) => item.clientFileId === clientFileId ? { ...item, ...changes } : item));
  };

  useEffect(() => {
    const connectionChanged = () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) uploadController.current?.abort();
    };
    window.addEventListener("online", connectionChanged);
    window.addEventListener("offline", connectionChanged);
    return () => {
      window.removeEventListener("online", connectionChanged);
      window.removeEventListener("offline", connectionChanged);
      uploadController.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!pendingFiles.length) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (draftStatus === "saved" && !uploadController.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [pendingFiles.length, draftStatus]);
  useEffect(() => {
    if (!mediaQ.data || mediaQ.isError || draftStatus === "loading" || uploadController.current) return;
    const savedIds = new Set(mediaQ.data.files.filter((file) => file.status === "uploaded" || file.status === "done").map((file) => file.client_file_id));
    if (pendingFiles.some((item) => savedIds.has(item.clientFileId))) {
      setPendingFiles((current) => current.filter((item) => !savedIds.has(item.clientFileId)));
    }
  }, [mediaQ.data, mediaQ.isError, draftStatus, pendingFiles, setPendingFiles]);

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (gradesQ.isError) throw new Error("제출 대상을 다시 불러온 뒤 제출해 주세요.");
      if (!selected) throw new Error("제출 대상을 선택해 주세요.");
      if (!navigator.onLine) throw new Error("인터넷 연결이 돌아오면 이어서 제출해 주세요.");
      const target = selected;
      const candidates = pendingFiles.filter((item) => item.status === "queued" || item.status === "failed");
      if (candidates.length === 0) throw new Error("새로 제출할 파일을 선택해 주세요.");
      const controller = new AbortController();
      uploadController.current = controller;
      const succeeded: string[] = [];
      const failed: string[] = [];
      let reviewLocked = false;
      let paused = false;
      const readSaved = async () => {
        const collection = await fetchHomeworkMedia(target.id, target.enrollmentId, controller.signal);
        qc.setQueryData(studentQueryKeys.homeworkMedia(target.id, target.enrollmentId), collection);
        return collection;
      };
      const uploadOne = async (item: PendingMedia, position: number) => {
        updatePending(item.clientFileId, { position, status: "uploading", progress: 0, error: null });
        await runTrackedTask("assignments.student.submit", () => uploadHomeworkFile(target, { ...item, position }, controller.signal, (progress) => {
          updatePending(item.clientFileId, { progress, status: progress === 100 ? "saving" : "uploading" });
        }));
      };
      try {
        // Reload/pause/network loss may hide a successful response. Read before POST.
        let collection = await readSaved();
        for (const item of candidates) {
          if (controller.signal.aborted) { paused = true; break; }
          let persisted = collection.files.find((file) => file.client_file_id === item.clientFileId);
          if (persisted?.status === "uploaded" || persisted?.status === "done") {
            succeeded.push(item.clientFileId);
            continue;
          }
          if (persisted?.status === "uploading") {
            updatePending(item.clientFileId, { status: "saving", progress: 100, error: null });
            // Do not race a previous request that is still committing.
            const deadline = Date.now() + 30_000;
            while (persisted?.status === "uploading" && Date.now() < deadline) {
              await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => { controller.signal.removeEventListener("abort", abort); resolve(); }, 2000);
                const abort = () => { clearTimeout(timer); reject(new DOMException("Paused", "AbortError")); };
                controller.signal.addEventListener("abort", abort, { once: true });
                if (controller.signal.aborted) abort();
              });
              collection = await readSaved();
              persisted = collection.files.find((file) => file.client_file_id === item.clientFileId);
            }
            if (persisted?.status === "uploaded" || persisted?.status === "done") {
              succeeded.push(item.clientFileId);
              continue;
            }
            // A legacy/crashed upload can remain "uploading" indefinitely.
            // Reuse its client ID after this bounded read: the API serializes
            // assignment writes and deduplicates an already committed file.
          }
          let position = persisted?.position ?? item.position;
          try {
            try {
              await uploadOne(item, position);
            } catch (firstError) {
              if (apiErrorCode(firstError) !== "HOMEWORK_MEDIA_POSITION_CONFLICT") throw firstError;
              collection = await readSaved();
              const existing = collection.files.find((file) => file.client_file_id === item.clientFileId);
              if (existing?.status === "uploaded" || existing?.status === "done") {
                succeeded.push(item.clientFileId);
                continue;
              }
              const occupied = new Set(collection.files.filter((file) => file.status !== "removed").map((file) => file.position));
              position = existing?.position ?? 0;
              if (!existing) while (occupied.has(position)) position += 1;
              if (position >= collection.limits.max_files) throw new Error("현재 제출 파일 수가 가득 찼습니다. 목록을 확인해 주세요.");
              // One conflict retry only; a concurrent edit may race again.
              await uploadOne(item, position);
            }
            succeeded.push(item.clientFileId);
          } catch (uploadError) {
            if (controller.signal.aborted || !navigator.onLine) { paused = true; break; }
            if (apiErrorCode(uploadError) === "HOMEWORK_MEDIA_REVIEWED") { reviewLocked = true; break; }
            try {
              collection = await readSaved();
              const saved = collection.files.find((file) => file.client_file_id === item.clientFileId);
              if (saved?.status === "uploaded" || saved?.status === "done") {
                succeeded.push(item.clientFileId);
                continue;
              }
            } catch { /* Keep the original file and ID until an authoritative read. */ }
            failed.push(item.clientFileId);
            updatePending(item.clientFileId, { status: "failed", error: apiErrorMessage(uploadError, "이 파일을 올리지 못했습니다.") });
          }
        }
      } catch (readError) {
        if (!controller.signal.aborted) throw readError;
        paused = true;
      } finally {
        if (uploadController.current === controller) uploadController.current = null;
        setPendingFiles((current) => current.map((item) => (
          item.status === "uploading" || item.status === "saving" ? { ...item, status: "queued", progress: 0 } : item
        )));
      }
      return { succeeded, failed, reviewLocked, paused };
    },
    onSuccess: async ({ succeeded, failed, reviewLocked, paused }) => {
      setPendingFiles((current) => current.filter((item) => !succeeded.includes(item.clientFileId)));
      void qc.invalidateQueries({ queryKey: studentQueryKeys.gradesSummary });
      if (paused) {
        setError(navigator.onLine
          ? "제출을 잠시 멈췄습니다. 이어서 제출하면 이미 저장된 파일을 확인하고 남은 파일만 보냅니다."
          : "인터넷 연결이 끊겨 잠시 멈췄습니다. 연결이 돌아오면 이어서 제출해 주세요.");
        return;
      }
      await mediaQ.refetch();
      if (reviewLocked) {
        setReviewLocked(true);
        setError("선생님 확인으로 제출이 잠겼습니다. 아직 제출하지 못한 파일은 보관했습니다. 선생님이 제출을 다시 열면 상태를 확인하고 이어서 제출할 수 있습니다.");
        return;
      }
      if (failed.length === 0) {
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        studentToast.success((selected?.title ?? "과제") + " 파일 " + succeeded.length + "개를 제출했습니다.");
      } else {
        setError(succeeded.length > 0
          ? succeeded.length + "개는 제출됐고 " + failed.length + "개는 실패했습니다. 실패한 파일만 다시 시도해 주세요."
          : failed.length + "개 파일을 올리지 못했습니다. 파일별 오류를 확인해 주세요.");
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
      setPreviewFile(null);
      await mediaQ.refetch();
      await qc.invalidateQueries({ queryKey: studentQueryKeys.gradesSummary });
      studentToast.success("파일을 제출 목록에서 뺐습니다.");
    },
    onError: (removeError) => setError(apiErrorMessage(removeError, "파일을 변경하지 못했습니다.")),
  });

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";
    setError(null);
    uploadMut.reset();
    if (incoming.length === 0) return;
    setIsPreparingFiles(true);
    const refreshed = await mediaQ.refetch().catch(() => null);
    setIsPreparingFiles(false);
    if (!refreshed?.data || refreshed.isError) {
      setError("현재 제출 파일을 다시 확인하지 못했습니다. 연결을 확인한 뒤 다시 선택해 주세요.");
      return;
    }
    const existing = refreshed.data.files;
    const currentLimits = refreshed.data.limits ?? DEFAULT_LIMITS;
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
      if (file.size <= 0) { rejected.push(`${file.name}: 빈 파일`); continue; }
      if (file.size > currentLimits.max_file_size_bytes) { rejected.push(`${file.name}: 파일당 ${formatCompactFileSize(currentLimits.max_file_size_bytes)} 초과`); continue; }
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
      if (activeCount >= currentLimits.max_files) { rejected.push(`${file.name}: 최대 ${currentLimits.max_files}개 초과`); continue; }
      if (totalSize + file.size > currentLimits.max_total_size_bytes) { rejected.push(`${file.name}: 전체 ${formatCompactFileSize(currentLimits.max_total_size_bytes)} 초과`); continue; }
      let position = 0;
      while (occupiedPositions.has(position)) position += 1;
      if (position >= currentLimits.max_files) { rejected.push(`${file.name}: 넣을 수 있는 순서가 없음`); continue; }
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
    if (recordsStudentActivity) {
      void studentApi.post("/students/me/activity/homework-open/", { homework_id: homework.homework_id }).catch(() => undefined);
    }
    setError(null);
    uploadMut.reset();
    if (changed) {
      setReviewLocked(false);
      setPreviewFile(null);
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
    if (recordsStudentActivity) {
      void studentApi.post(
        "/students/me/activity/homework-open/",
        { homework_id: requestedHomework.homework_id },
      ).catch(() => undefined);
    }
  }, [recordsStudentActivity, requestedHomeworkId, selected, unfinishedHomeworks]);
  const retryableCount = pendingFiles.filter((file) => file.status === "queued" || file.status === "failed").length;
  const refreshReviewStatus = async () => {
    if (!selected) return;
    const refreshed = await gradesQ.refetch();
    const target = refreshed.data?.homeworks.find((homework) => homework.homework_id === selected.id
      && homework.enrollment_id === selected.enrollmentId);
    if (refreshed.isError || !target) {
      setError("제출 가능 상태를 확인하지 못했습니다. 선택한 파일은 유지됩니다. 다시 확인해 주세요.");
    } else if (acceptsHomeworkFiles(target)) {
      setReviewLocked(false);
      setError(null);
      uploadMut.reset();
    } else {
      setError("아직 선생님 확인 상태입니다. 선택한 파일을 유지하고 있습니다.");
    }
  };
  const canSubmit = selected != null && retryableCount > 0 && online && draftStatus !== "loading" && !reviewLocked && !uploadMut.isPending && !isPreparingFiles && !mediaQ.isFetching && !gradesQ.isError && !mediaQ.isError;
  const submitButtonLabel = uploadMut.isPending
    ? "파일별로 제출 중…"
    : !online ? "연결 후 이어서 제출"
    : reviewLocked ? "선생님 확인으로 제출 잠김"
    : retryableCount === 0
      ? "새 파일을 선택해 주세요"
      : uploadMut.data?.paused ? `남은 파일 ${retryableCount}개 이어서 제출`
      : pendingFiles.some((file) => file.status === "failed")
        ? `실패한 파일 ${retryableCount}개 다시 제출`
        : `파일 ${retryableCount}개 제출하기`;

  return (
    <StudentPageShell title="과제 제출" description="풀이 사진과 동영상을 제출하고 선생님 확인 결과를 학습 현황에서 확인하세요." descriptionMode="help" onBack={() => window.history.back()}>
      <div className={`stu-section stu-section--nested ${styles.section}`}>
        {(uploadMut.isError || error) && <div role="alert" className={styles.errorMessage}>{error || apiErrorMessage(uploadMut.error)}</div>}
        {reviewLocked && <div className={styles.scopeNotice}>
          <span>아래 임시 보관 상태를 확인해 주세요.</span>
          <button type="button" className="stu-btn stu-btn--secondary" disabled={gradesQ.isFetching} onClick={() => void refreshReviewStatus()}>제출 가능 상태 다시 확인</button>
        </div>}
        {requestedSessionId != null && (
          <div className={styles.scopeNotice} role="status">
            <div><strong>현재 차시의 제출 항목만 표시합니다</strong><span>다른 수업의 파일을 잘못 제출하지 않도록 범위를 고정했습니다.</span></div>
            <Link to="/student/submit/assignment" className={styles.scopeLink}>전체 제출 대상 보기</Link>
          </div>
        )}
        {uploadMut.isSuccess && uploadMut.data?.failed.length === 0 && !uploadMut.data.paused && uploadMut.data.reviewLocked !== true && (
          <div className={styles.successMessage}><span><span>선택한 파일을 모두 제출했습니다.</span> 확인 결과는 학습 현황에서 확인하세요.</span><Link to="/student/grades" className={styles.successLink}>학습 현황<IconChevronRight className={styles.successLinkIcon} aria-hidden="true" /></Link></div>
        )}

        <div data-guide="submit-target">
          <div className={styles.stepLabel}>1. 제출 대상 선택</div>
          {gradesQ.isLoading && <div className={`stu-muted ${styles.loadingText}`}>불러오는 중…</div>}
          {gradesQ.isError && <EmptyState title="제출 대상을 불러오지 못했습니다." description="제출 상태를 확인할 수 없습니다." onRetry={() => void gradesQ.refetch()} />}
          {!gradesQ.isLoading && !gradesQ.isError && unfinishedHomeworks.length === 0 && unfinishedExams.length === 0 && <div className={styles.emptyTarget}>{requestedSessionId == null ? "제출할 미완료 과제·시험이 없습니다." : "이 차시에 제출할 미완료 과제·시험이 없습니다."}</div>}
          {!gradesQ.isError && <div className={styles.targetList}>
            {unfinishedHomeworks.map((homework) => (
              <button key={`hw-${homework.homework_id}`} type="button" onClick={() => selectHomework(homework)} disabled={uploadMut.isPending || isPreparingFiles || (reviewLocked && gradesQ.isFetching)} className={styles.targetItem} data-selected={selected?.id === homework.homework_id}>
                <span className={styles.targetIcon}><IconClipboard className={styles.targetIconSvg} /></span><span className={styles.targetBadge}>{homework.submission_state === "awaiting_review" ? "제출됨 · 파일 수정 가능" : "과제"}</span><span className={styles.targetTitle}>{homework.title}</span>{homework.lecture_title && <span className={`stu-muted ${styles.targetLecture}`}>{homework.lecture_title}</span>}
              </button>
            ))}
            {unfinishedExams.map((exam: MyExamGradeSummary) => (
              <Link key={`ex-${exam.exam_id}`} to={`/student/exams/${exam.exam_id}/submit`} className={styles.targetItem} aria-disabled={uploadMut.isPending || isPreparingFiles} tabIndex={uploadMut.isPending || isPreparingFiles ? -1 : undefined} onClick={(event) => { if (uploadMut.isPending || isPreparingFiles) event.preventDefault(); }}>
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
            <button type="button" className={`stu-btn stu-btn--secondary ${styles.fileButton}`} onClick={() => fileInputRef.current?.click()} disabled={draftStatus === "loading" || reviewLocked || uploadMut.isPending || isPreparingFiles || mediaQ.isFetching || mediaQ.isError}>사진·동영상 여러 개 선택</button>
            {draftStatus === "loading" && <div className={styles.mediaLoading} role="status">이전에 선택한 파일을 확인하는 중…</div>}
            {!online && <div className={styles.draftNotice} role="status">인터넷 연결을 기다리고 있습니다. 선택한 파일은 유지됩니다.</div>}
            {(isPreparingFiles || mediaQ.isFetching) && <div className={styles.mediaLoading}>현재 제출 파일을 최신 상태로 확인하는 중…</div>}
            {mediaQ.isError && <div className={styles.mediaQueryError} role="alert"><span>현재 제출 파일을 불러오지 못해 새 업로드를 잠갔습니다.</span><button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={() => void mediaQ.refetch()}>다시 시도</button></div>}

            {visibleServerFiles.length > 0 && (
              <section className={styles.persistedSection} aria-label="이미 제출한 파일">
                <div className={styles.fileSectionTitle}>이미 제출한 파일 <b>{visibleServerFiles.length}</b></div>
                <div className={styles.persistedList}>{visibleServerFiles.map((file) => (
                  <div className={styles.persistedFile} key={file.id} data-status={file.status}>
                    <span className={styles.persistedIcon}>{file.media_kind === "video" ? <IconVideo /> : <IconImage />}</span>
                    <span className={styles.persistedInfo}><b>{file.original_filename}</b><small>{formatCompactFileSize(file.file_size)} · {mediaStatusLabel(file)}</small>{file.error_message && <em>{file.error_message}</em>}</span>
                    <div className={styles.persistedActions}>
                      <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={() => setPreviewFile(file)}>미리보기</button>
                      <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={() => removeMut.mutate(file)} disabled={reviewLocked || uploadMut.isPending || isPreparingFiles || removeMut.isPending}>빼기</button>
                    </div>
                  </div>
                ))}</div>
              </section>
            )}

            {previewFile && <SavedHomeworkMediaPreview key={`${selected.id}:${selected.enrollmentId}:${previewFile.id}`} homeworkId={selected.id} enrollmentId={selected.enrollmentId} file={previewFile} onClose={() => setPreviewFile(null)} />}

            {pendingFiles.length > 0 && (
              <section className={styles.pendingSection} aria-label="이번에 제출할 파일">
                <div className={styles.fileSectionTitle}>이번에 제출할 파일 <b>{pendingFiles.length}</b></div>
                <p className={styles.draftNotice} role="status">{draftStatus === "saved"
                  ? "이 기기에 임시 보관했습니다. 같은 로그인에서 24시간 동안 이어서 제출할 수 있습니다. 제출하거나 로그아웃하면 보관 파일을 지웁니다."
                  : draftStatus === "saving" ? "선택한 파일을 이 기기에 임시 보관하는 중…"
                  : "이 기기에 임시 보관하지 못했습니다. 화면을 새로고침하거나 닫지 말고 제출해 주세요."}</p>
                <div className={styles.pendingGrid}>{pendingFiles.map((item, index) => (
                  <article className={styles.pendingCard} key={item.clientFileId} data-status={item.status}>
                    <div className={styles.previewFrame}><LocalMediaPreview file={item.file} /><span className={styles.orderChip}>{index + 1}</span></div>
                    <div className={styles.pendingMeta}><b title={item.file.name}>{item.file.name}</b><span>{formatCompactFileSize(item.file.size)}</span>{(item.status === "uploading" || item.status === "saving") && <><progress className={styles.progressTrack} aria-label={`${item.file.name} ${item.progress}% 업로드`} max={100} value={item.progress} /><span role="status">{item.status === "saving" ? "전송 완료 · 서버에 저장 확인 중…" : `${item.progress}% 전송 중`}</span></>}{item.status === "failed" && <em>{item.error || "이 파일을 올리지 못했습니다."}</em>}</div>
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
            {uploadMut.isPending && <button type="button" className="stu-btn stu-btn--secondary" onClick={() => uploadController.current?.abort()}>잠시 멈추기</button>}
          </div>
        )}
      </div>
    </StudentPageShell>
  );
}
