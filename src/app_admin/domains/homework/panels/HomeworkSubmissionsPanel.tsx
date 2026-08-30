// PATH: src/app_admin/domains/homework/panels/HomeworkSubmissionsPanel.tsx
/** 학생별 과제 제출 묶음과 파일별 업로드·검수 상태를 보여준다. */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileImage, LoaderCircle, Video } from "lucide-react";

import {
  fetchHomeworkSubmissions,
  type HomeworkSubmissionMediaFile,
  type HomeworkSubmissionRow,
} from "@admin/domains/submissions/api/adminHomeworkSubmissions.api";
import { useAdminHomework } from "../hooks/useAdminHomework";
import { formatSubmissionDate, formatSubmissionFileSize } from "@admin/domains/submissions/statusMaps";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import StudentDetailLink from "@admin/domains/students/public/StudentDetailLink";
import { Badge, Button, EmptyState, type BadgeTone } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import NotificationPreviewModal from "@/shared/ui/notifications/NotificationPreviewModal";
import { patchAssessmentCorrection } from "@/shared/api/contracts/sessionScores";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
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

function fileStatus(file: HomeworkSubmissionMediaFile): { label: string; tone: BadgeTone } {
  if (file.removed_at || file.status === "removed") return { label: "교체됨", tone: "neutral" };
  if (file.status === "failed") return { label: "업로드 실패", tone: "danger" };
  if (file.status === "uploading") return { label: "저장 중", tone: "warning" };
  return { label: "검수 가능", tone: "success" };
}

function FileStateIcon({ file }: { file: HomeworkSubmissionMediaFile }) {
  if (file.status === "failed") return <AlertCircle aria-hidden="true" />;
  if (file.status === "uploading") return <LoaderCircle aria-hidden="true" />;
  if (file.media_kind === "video") return <Video aria-hidden="true" />;
  return <FileImage aria-hidden="true" />;
}

export default function HomeworkSubmissionsPanel({ homeworkId }: { homeworkId: number }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const hwQ = useAdminHomework(homeworkId);
  const homeworkTitle = hwQ.data?.title ?? "";
  const sessionId = Number(hwQ.data?.session_id) || 0;
  const [notSubmittedNotif, setNotSubmittedNotif] = useState(false);
  const [previewFile, setPreviewFile] = useState<HomeworkSubmissionMediaFile | null>(null);
  const q = useQuery({
    queryKey: QUERY_KEYS.HOMEWORK_SUBMISSIONS(homeworkId),
    queryFn: () => fetchHomeworkSubmissions(homeworkId),
    refetchInterval: 5000,
  });
  const rows = useMemo(() => q.data ?? [], [q.data]);
  const notSubmittedIds = rows
    .map(getNotSubmittedStudentId)
    .filter((studentId): studentId is number => studentId != null);
  const summary = useMemo(() => {
    const activeFiles = rows.flatMap((row) => row.files).filter((file) => !file.removed_at);
    const submittedRows = rows.filter((row) => !isNotSubmittedStatus(row.status));
    const submittedEnrollmentIds = new Set(submittedRows.map((row) => row.enrollment_id));
    const reviewedEnrollmentIds = new Set(
      submittedRows.filter((row) => row.teacher_reviewed).map((row) => row.enrollment_id),
    );
    return {
      students: submittedEnrollmentIds.size,
      pending: Math.max(0, submittedEnrollmentIds.size - reviewedEnrollmentIds.size),
      reviewed: reviewedEnrollmentIds.size,
      failed: activeFiles.filter((file) => file.status === "failed").length,
    };
  }, [rows]);

  const reviewMut = useMutation({
    mutationFn: async ({ row, completed }: { row: HomeworkSubmissionRow; completed: boolean }) => {
      if (sessionId <= 0) throw new Error("과제 차시를 확인할 수 없습니다.");
      return patchAssessmentCorrection(sessionId, {
        enrollment_id: row.enrollment_id,
        source_type: "homework",
        source_id: homeworkId,
        completed,
        note: completed ? "제출 파일 직접 확인" : "추가 확인 필요",
        expected_updated_at: row.teacher_review_updated_at,
      });
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.HOMEWORK_SUBMISSIONS(homeworkId) }),
        queryClient.invalidateQueries({ queryKey: scoresQueryKeys.sessionScoresRoot }),
      ]);
      feedback.success(variables.completed ? "선생님 확인 완료로 기록했습니다." : "확인 완료를 취소했습니다.");
    },
    onError: (error: unknown) => {
      const apiError = error as { response?: { data?: { detail?: string } }; message?: string };
      feedback.error(apiError.response?.data?.detail || apiError.message || "확인 상태를 저장하지 못했습니다.");
    },
  });

  const requestReviewChange = async (row: HomeworkSubmissionRow, completed: boolean) => {
    const accepted = await confirm({
      title: completed ? `${row.student_name} 제출 확인 완료` : `${row.student_name} 확인 취소`,
      message: completed
        ? "사진·동영상을 직접 확인한 것으로 기록합니다. 이후 학생은 제출 파일을 바꿀 수 없습니다."
        : "직접 확인 기록을 취소하고 학생이 파일을 다시 바꿀 수 있게 합니다.",
      confirmText: completed ? "확인 완료" : "확인 취소",
      danger: !completed,
    });
    if (accepted) reviewMut.mutate({ row, completed });
  };

  if (q.isLoading) {
    return <EmptyState scope="panel" tone="loading" title="제출 목록 불러오는 중…" />;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>SUBMISSION REVIEW</p>
          <h3>과제 제출 검수</h3>
          <p>학생이 올린 사진과 동영상을 파일별로 확인합니다.</p>
        </div>
        <div className={styles.headerActions}>
          {notSubmittedIds.length > 0 && (
            <Button type="button" intent="ghost" size="sm" onClick={() => setNotSubmittedNotif(true)}>
              미제출 알림 발송
            </Button>
          )}
          <Button type="button" intent="ghost" size="sm" onClick={() => q.refetch()}>
            새로고침
          </Button>
        </div>
      </div>

      <div className={styles.summary} aria-label="제출 요약">
        <div><span>제출 학생</span><strong>{summary.students}</strong><small>명</small></div>
        <div><span>확인 대기</span><strong>{summary.pending}</strong><small>명</small></div>
        <div data-tone="success"><span>확인 완료</span><strong>{summary.reviewed}</strong><CheckCircle2 aria-hidden="true" /></div>
        <div data-tone={summary.failed > 0 ? "danger" : "neutral"}><span>업로드 오류</span><strong>{summary.failed}</strong><AlertCircle aria-hidden="true" /></div>
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
      />

      {q.isError && (
        <div className={styles.queryError} role="alert">
          <span>제출 목록을 불러오지 못했습니다.</span>
          <Button type="button" intent="ghost" size="sm" onClick={() => q.refetch()}>다시 시도</Button>
        </div>
      )}
      {rows.length === 0 && !q.isError && (
        <EmptyState scope="panel" tone="empty" title="아직 제출된 과제가 없습니다." />
      )}

      {rows.length > 0 && (
        <div className={styles.studentList}>
          {rows.map((row) => (
            <article className={styles.studentCard} key={row.id}>
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
                <div className={styles.studentActions}>
                  <div className={styles.studentMeta}>
                    <span>{homeworkTitle || "과제"}</span>
                    <time dateTime={row.created_at}>{formatSubmissionDate(row.created_at)}</time>
                    <b>{row.files.filter((file) => !file.removed_at).length}개 파일</b>
                  </div>
                  {row.teacher_reviewed ? (
                    <Badge variant="solid" tone="success">
                      {row.teacher_review_source === "score" ? "점수 입력 완료" : "확인 완료"}
                    </Badge>
                  ) : (
                    <Badge variant="solid" tone="warning">확인 대기</Badge>
                  )}
                  {row.teacher_review_source !== "score" && !isNotSubmittedStatus(row.status) && (
                    <Button
                      type="button"
                      intent={row.teacher_reviewed ? "ghost" : "primary"}
                      size="sm"
                      disabled={
                        sessionId <= 0
                        || !row.files.some((file) => file.status === "uploaded" && !file.removed_at)
                        || (reviewMut.isPending && reviewMut.variables?.row.enrollment_id === row.enrollment_id)
                      }
                      onClick={() => void requestReviewChange(row, !row.teacher_reviewed)}
                    >
                      {row.teacher_reviewed ? "확인 취소" : "확인 완료"}
                    </Button>
                  )}
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
                          <span>{file.media_kind === "video" ? "동영상" : "사진"} · {formatSubmissionFileSize(file.file_size) || "용량 미상"}</span>
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
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
