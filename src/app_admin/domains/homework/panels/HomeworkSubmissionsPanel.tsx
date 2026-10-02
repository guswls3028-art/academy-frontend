// PATH: src/app_admin/domains/homework/panels/HomeworkSubmissionsPanel.tsx
/** 학생별 과제 제출 묶음과 파일별 업로드·검수 상태를 보여준다. */

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileImage, FileText, LoaderCircle, Video } from "lucide-react";

import {
  fetchHomeworkSubmissions,
  type HomeworkSubmissionMediaFile,
  type HomeworkSubmissionRow,
} from "@admin/domains/submissions/api/adminHomeworkSubmissions.api";
import { fetchSessionScores, patchAssessmentCorrection, type SessionScoresResponse } from "@/shared/api/contracts/sessionScores";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useAdminHomework } from "../hooks/useAdminHomework";
import { formatSubmissionDate, formatSubmissionFileSize } from "@admin/domains/submissions/statusMaps";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import StudentDetailLink from "@admin/domains/students/public/StudentDetailLink";
import { Badge, Button, EmptyState, type BadgeTone } from "@/shared/ui/ds";
import NotificationPreviewModal from "@/shared/ui/notifications/NotificationPreviewModal";
import { QUERY_KEYS } from "../queryKeys";
import HomeworkMediaPreviewModal from "../components/HomeworkMediaPreviewModal";
import styles from "./HomeworkSubmissionsPanel.module.css";

function isNotSubmittedStatus(status: HomeworkSubmissionRow["status"]): boolean {
  return status === "not_submitted" || status === "NOT_SUBMITTED";
}

function getNotSubmittedStudentId(row: HomeworkSubmissionRow): number | null {
  if (!isNotSubmittedStatus(row.status)) return null;
  const studentId = Number(row.student_id);
  return Number.isFinite(studentId) && studentId > 0 ? studentId : null;
}

function hasRecordedScore(scores: SessionScoresResponse | undefined, row: HomeworkSubmissionRow, homeworkId: number): boolean {
  return scores?.rows.some((scoreRow) => scoreRow.enrollment_id === row.enrollment_id &&
    scoreRow.homeworks.some((homework) => homework.homework_id === homeworkId &&
      ((homework.attempt_count ?? 0) > 0 || homework.block.score != null))) ?? false;
}

function fileStatus(file: HomeworkSubmissionMediaFile): { label: string; tone: BadgeTone } {
  if (file.removed_at || file.status === "removed") return { label: "교체됨", tone: "neutral" };
  if (file.status === "failed") return { label: "업로드 실패", tone: "danger" };
  if (file.status === "uploading") return { label: "저장 중", tone: "warning" };
  return { label: "검수 가능", tone: "success" };
}

function FileStateIcon({ file }: { file: HomeworkSubmissionMediaFile }) {
  if (file.status === "failed") return <AlertCircle aria-hidden="true" />;
  if (file.status === "uploading") return <LoaderCircle aria-hidden="true" />;
  if (file.mime_type === "application/pdf") return <FileText aria-hidden="true" />;
  if (file.media_kind === "video") return <Video aria-hidden="true" />;
  return <FileImage aria-hidden="true" />;
}

function fileKindLabel(file: HomeworkSubmissionMediaFile): string {
  if (file.mime_type === "application/pdf") return "PDF";
  return file.media_kind === "video" ? "동영상" : "사진";
}

export default function HomeworkSubmissionsPanel({ homeworkId }: { homeworkId: number }) {
  const confirm = useConfirm();
  const hwQ = useAdminHomework(homeworkId);
  const homeworkTitle = hwQ.data?.title ?? "";
  const sessionId = Number(hwQ.data?.session_id);
  const reviewActionRef = useRef(false);
  const [notSubmittedNotif, setNotSubmittedNotif] = useState(false);
  const [previewFile, setPreviewFile] = useState<HomeworkSubmissionMediaFile | null>(null);
  const [viewedFileIds, setViewedFileIds] = useState<Set<string>>(() => new Set());
  const [reviewConfirming, setReviewConfirming] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const q = useQuery({
    queryKey: QUERY_KEYS.HOMEWORK_SUBMISSIONS(homeworkId),
    queryFn: () => fetchHomeworkSubmissions(homeworkId),
    refetchInterval: 5000,
  });
  const scoreQ = useQuery({
    queryKey: scoresQueryKeys.sessionScores(sessionId),
    queryFn: () => fetchSessionScores(sessionId),
    enabled: sessionId > 0,
    refetchInterval: 5000,
  });
  const reviewMut = useMutation({
    mutationFn: async ({ row, completed }: { row: HomeworkSubmissionRow; completed: boolean }) => {
      if (!(sessionId > 0 && row.enrollment_id > 0)) {
        throw new Error("과제 차시 또는 학생 수강 정보를 확인할 수 없습니다.");
      }
      const latestRow = (await fetchHomeworkSubmissions(homeworkId)).find((item) => item.id === row.id);
      if (!latestRow || latestRow.teacher_review_updated_at !== row.teacher_review_updated_at) {
        throw new Error("제출 상태가 다른 화면에서 바뀌었습니다. 새로고침 후 다시 확인해 주세요.");
      }
      const readyFiles = latestRow.files.filter((file) => file.status === "uploaded" && !file.removed_at);
      if (completed && (
        latestRow.media_set_fingerprint !== row.media_set_fingerprint ||
        readyFiles.length === 0 || readyFiles.some((file) => !viewedFileIds.has(file.id))
      )) {
        throw new Error("제출 파일이 바뀌었거나 아직 모두 열어보지 않았습니다. 파일을 다시 확인해 주세요.");
      }
      const latestScores = await fetchSessionScores(sessionId);
      if (hasRecordedScore(latestScores, latestRow, homeworkId)) {
        throw new Error("점수가 입력된 제출은 성적 화면에서 관리해 주세요.");
      }
      return patchAssessmentCorrection(sessionId, {
        enrollment_id: row.enrollment_id,
        source_type: "homework",
        source_id: homeworkId,
        completed,
        note: completed ? "제출 파일 직접 확인" : "추가 확인 필요",
        expected_updated_at: row.teacher_review_updated_at,
      });
    },
    onSuccess: async (_, { row, completed }) => {
      const [freshSubmissions, freshScores] = await Promise.all([q.refetch(), scoreQ.refetch()]);
      const current = freshSubmissions.data?.find((item) => item.id === row.id);
      if (freshSubmissions.isError || freshScores.isError || !current) {
        setReviewError("기록은 저장됐지만 최신 제출·성적 상태를 확인하지 못했습니다. 새로고침으로 다시 확인해 주세요.");
        return;
      }
      if (current.teacher_reviewed !== completed || (completed && current.teacher_review_source !== "manual")) {
        setReviewError("점수 결과가 우선하거나 상태가 변경됐습니다. 최신 성적과 제출 상태를 확인해 주세요.");
        return;
      }
      setReviewError(null);
      feedback.success(completed ? "확인 완료로 기록했습니다." : "확인 완료를 취소했습니다.");
    },
    onError: (error) => {
      setReviewError(extractApiError(error, "확인 상태를 저장하지 못했습니다. 다시 시도해 주세요."));
      void q.refetch();
      void scoreQ.refetch();
    },
  });
  const requestReview = async (row: HomeworkSubmissionRow, completed: boolean) => {
    if (reviewActionRef.current) return;
    reviewActionRef.current = true;
    setReviewConfirming(true);
    try {
      const accepted = await confirm({
        title: completed ? `${row.student_name} 제출 확인 완료` : `${row.student_name} 확인 취소`,
        message: completed
          ? "제출 파일을 직접 확인한 것으로 기록합니다. 이후 학생은 검수된 파일을 바꿀 수 없습니다."
          : "직접 확인 기록을 취소하고 학생이 파일을 다시 바꿀 수 있게 합니다.",
        confirmText: completed ? "확인 완료" : "확인 취소",
        danger: !completed,
      });
      if (accepted) await reviewMut.mutateAsync({ row, completed });
    } catch (error) {
      setReviewError(extractApiError(error, "확인 상태를 저장하지 못했습니다. 다시 시도해 주세요."));
    } finally {
      reviewActionRef.current = false;
      setReviewConfirming(false);
    }
  };
  const markViewed = (fileId: string) => setViewedFileIds((current) => {
    if (current.has(fileId)) return current;
    const next = new Set(current);
    next.add(fileId);
    return next;
  });
  const rows = useMemo(() => q.data ?? [], [q.data]);
  const notSubmittedIds = rows
    .map(getNotSubmittedStudentId)
    .filter((studentId): studentId is number => studentId != null);
  const summary = useMemo(() => {
    const activeFiles = rows.flatMap((row) => row.files).filter((file) => !file.removed_at);
    return {
      students: rows.filter((row) => !isNotSubmittedStatus(row.status)).length,
      files: activeFiles.length,
      ready: activeFiles.filter((file) => file.status === "uploaded").length,
      failed: activeFiles.filter((file) => file.status === "failed").length,
      reviewed: rows.filter((row) => !isNotSubmittedStatus(row.status) && row.teacher_reviewed).length,
      pending: rows.filter((row) => !isNotSubmittedStatus(row.status) && !row.teacher_reviewed).length,
    };
  }, [rows]);

  if (q.isLoading) {
    return <EmptyState scope="panel" tone="loading" title="제출 목록 불러오는 중…" />;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>SUBMISSION REVIEW</p>
          <h3>과제 제출 검수</h3>
          <p>제출 파일을 모두 열어본 뒤 학생별 확인 완료를 기록합니다.</p>
        </div>
        <div className={styles.headerActions}>
          {notSubmittedIds.length > 0 && (
            <Button type="button" intent="ghost" size="sm" onClick={() => setNotSubmittedNotif(true)}>
              미제출 알림 발송
            </Button>
          )}
          <Button type="button" intent="ghost" size="sm" onClick={() => { void q.refetch(); void scoreQ.refetch(); }}>
            새로고침
          </Button>
        </div>
      </div>

      <div className={styles.summary} aria-label="제출 요약">
        <div><span>제출 학생</span><strong>{summary.students}</strong><small>명</small></div>
        <div><span>전체 파일</span><strong>{summary.files}</strong><small>개</small></div>
        <div data-tone="success"><span>검수 가능</span><strong>{summary.ready}</strong><CheckCircle2 aria-hidden="true" /></div>
        <div data-tone={summary.failed > 0 ? "danger" : "neutral"}><span>업로드 오류</span><strong>{summary.failed}</strong><AlertCircle aria-hidden="true" /></div>
        <div data-tone="warning"><span>확인 대기</span><strong>{summary.pending}</strong><small>명</small></div>
        <div data-tone="success"><span>확인 완료</span><strong>{summary.reviewed}</strong><small>명</small></div>
      </div>

      <NotificationPreviewModal
        open={notSubmittedNotif}
        onClose={() => setNotSubmittedNotif(false)}
        mode="manual"
        trigger="assignment_not_submitted"
        studentIds={notSubmittedIds}
        label="과제 미제출 알림"
        sendTo="parent"
        context={{ 과제명: homeworkTitle }}
      />
      <HomeworkMediaPreviewModal
        open={previewFile != null}
        homeworkId={homeworkId}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onViewed={markViewed}
      />

      {q.isError && (
        <div className={styles.queryError} role="alert">
          <span>제출 목록을 불러오지 못했습니다.</span>
          <Button type="button" intent="ghost" size="sm" onClick={() => q.refetch()}>다시 시도</Button>
        </div>
      )}
      {reviewError && (
        <div className={styles.queryError} role="alert">
          <span>{reviewError}</span>
          <Button type="button" intent="ghost" size="sm" onClick={() => { setReviewError(null); void q.refetch(); void scoreQ.refetch(); }}>최신 상태 확인</Button>
        </div>
      )}
      {rows.length === 0 && !q.isError && (
        <EmptyState scope="panel" tone="empty" title="아직 제출된 과제가 없습니다." />
      )}

      {rows.length > 0 && (
        <div className={styles.studentList}>
          {rows.map((row) => {
            const readyFiles = row.files.filter((file) => file.status === "uploaded" && !file.removed_at);
            const viewedCount = readyFiles.filter((file) => viewedFileIds.has(file.id)).length;
            const scoreLocked = hasRecordedScore(scoreQ.data, row, homeworkId);
            const canSave = sessionId > 0 && row.enrollment_id > 0 && scoreQ.isSuccess && !scoreLocked && !reviewMut.isPending && !reviewConfirming;
            return <article className={styles.studentCard} key={row.id}>
              <header className={styles.studentHeader}>
                <StudentDetailLink studentId={row.student_id} studentName={row.student_name}>
                  <StudentNameWithLectureChip
                    name={row.student_name}
                    lectures={row.lecture_title ? [{
                      lectureName: row.lecture_title,
                      color: row.lecture_color,
                      chipLabel: row.lecture_chip_label,
                    }] : undefined}
                    profilePhotoUrl={row.profile_photo_url}
                    avatarSize={36}
                    chipSize={18}
                    clinicHighlight={row.name_highlight_clinic_target === true}
                  />
                </StudentDetailLink>
                <div className={styles.studentMeta}>
                  <span>{homeworkTitle || "과제"}</span>
                  <time dateTime={row.created_at}>{formatSubmissionDate(row.created_at)}</time>
                  <b>{row.files.filter((file) => !file.removed_at).length}개 파일</b>
                </div>
              </header>

              {row.files.length === 0 ? (
                <div className={styles.noFiles}>제출 파일이 없습니다.</div>
              ) : (
                <div className={styles.fileList}>
                  {row.files.map((file) => {
                    const state = fileStatus(file);
                    const canPreview = file.status === "uploaded" && !file.removed_at;
                    return (
                      <div className={styles.fileRow} key={file.id} data-status={file.status} data-removed={Boolean(file.removed_at)}>
                        <span className={styles.fileOrder}>{file.position + 1}</span>
                        <span className={styles.fileIcon}><FileStateIcon file={file} /></span>
                        <div className={styles.fileCopy}>
                          <strong title={file.original_filename}>{file.original_filename}</strong>
                          <span>{fileKindLabel(file)} · {formatSubmissionFileSize(file.file_size) || "용량 미상"}</span>
                          {file.error_message && <em>{file.error_message}</em>}
                        </div>
                        <Badge variant="solid" tone={state.tone}>{state.label}</Badge>
                        <Button
                          type="button"
                          intent="ghost"
                          size="sm"
                          disabled={!canPreview}
                          onClick={() => setPreviewFile(file)}
                        >
                          미리보기
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              {!isNotSubmittedStatus(row.status) && (
                <div className={styles.reviewBar}>
                  <div className={styles.reviewCopy}>
                    <Badge variant="soft" tone={row.teacher_reviewed ? "success" : "warning"}>
                      {row.teacher_review_source === "score" || scoreLocked ? "점수 결과 확인" : row.teacher_reviewed ? "확인 완료" : "확인 대기"}
                    </Badge>
                    {scoreLocked || row.teacher_review_source === "score" ? (
                      <span>점수가 입력되어 성적 화면에서 결과를 관리합니다.</span>
                    ) : !(sessionId > 0) ? (
                      <span>과제 차시를 확인할 수 없어 저장할 수 없습니다.</span>
                    ) : scoreQ.isError ? (
                      <span>성적 상태를 불러오지 못했습니다. 다시 확인한 뒤 저장할 수 있습니다.</span>
                    ) : scoreQ.isLoading ? (
                      <span>성적 상태를 확인하는 중…</span>
                    ) : row.teacher_reviewed ? (
                      <span>교사 확인 기록이 저장됐습니다.</span>
                    ) : (
                      <span>제출 파일 {viewedCount}/{readyFiles.length}개를 열었습니다.</span>
                    )}
                  </div>
                  <div className={styles.reviewActions}>
                    {!(sessionId > 0) && <Button type="button" intent="ghost" size="sm" onClick={() => void hwQ.refetch()}>차시 다시 확인</Button>}
                    {scoreQ.isError && <Button type="button" intent="ghost" size="sm" onClick={() => void scoreQ.refetch()}>성적 다시 확인</Button>}
                    {!scoreLocked && row.teacher_review_source !== "score" && (
                      <Button
                        type="button"
                        intent={row.teacher_reviewed ? "secondary" : "primary"}
                        size="sm"
                        disabled={!canSave || (!row.teacher_reviewed && (readyFiles.length === 0 || viewedCount !== readyFiles.length))}
                        onClick={() => void requestReview(row, !row.teacher_reviewed)}
                      >
                        {reviewMut.isPending || reviewConfirming ? "저장 중…" : row.teacher_reviewed ? "확인 완료 취소" : "직접 확인 완료"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </article>
          })}
        </div>
      )}
    </div>
  );
}
