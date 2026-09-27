// PATH: src/app_teacher/domains/exams/pages/HomeworkDetailPage.tsx
// 과제 상세 — 제출 파일 직접 검수와 미제출 현황
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { fetchSessionScores, patchAssessmentCorrection } from "@/shared/api/contracts/sessionScores";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { formatCompactFileSize } from "@/shared/utils/fileSize";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import {
  fetchHomework,
  fetchHomeworkSubmissionPreview,
  fetchHomeworkSubmissions,
} from "../api";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import {
  normalizeHomework,
  normalizeHomeworkSubmissions,
  type HomeworkSubmission,
} from "../normalizers";
import { teacherExamsQueryKeys } from "../queryKeys";
import styles from "./HomeworkDetailPage.module.css";

function isSubmittedSubmission(submission: HomeworkSubmission): boolean {
  return submission.submitted_at != null || submission.status === "submitted";
}

function formatDate(date: string | null): string {
  if (!date) return "제출";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("ko-KR");
}

function reviewLabel(submission: HomeworkSubmission, hasScore = false): string {
  if (submission.teacher_review_source === "score") return "점수 입력 완료";
  if (hasScore) return "점수 결과 확인";
  if (submission.teacher_reviewed) return "확인 완료";
  return "확인 대기";
}

export default function HomeworkDetailPage() {
  const { homeworkId } = useParams<{ homeworkId: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [reviewSubmissionId, setReviewSubmissionId] = useState<number | null>(null);
  const hid = Number(homeworkId);

  const homeworkQ = useQuery({
    queryKey: teacherExamsQueryKeys.homework(hid),
    queryFn: async () => normalizeHomework(await fetchHomework(hid)),
    enabled: Number.isFinite(hid),
  });
  const hw = homeworkQ.data;
  const sessionId = hw?.session_id ?? 0;
  const scoreSheetQ = useQuery({
    queryKey: scoresQueryKeys.sessionScores(sessionId),
    queryFn: () => fetchSessionScores(sessionId),
    enabled: sessionId > 0,
  });

  const submissionsQ = useQuery({
    queryKey: teacherExamsQueryKeys.homeworkSubmissions(hid),
    queryFn: async () => normalizeHomeworkSubmissions(await fetchHomeworkSubmissions(hid)),
    enabled: Number.isFinite(hid),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const submissions = submissionsQ.data;
  const reviewSubmission = submissions?.find((submission) => submission.id === reviewSubmissionId) ?? null;
  const hasRecordedScore = (submission: HomeworkSubmission): boolean => (
    scoreSheetQ.data?.rows.some((row) => row.enrollment_id === submission.enrollment_id &&
      row.homeworks.some((entry) => entry.homework_id === hid &&
        ((entry.attempt_count ?? 0) > 0 || entry.block.score != null))) ?? false
  );

  const reviewMut = useMutation({
    mutationFn: async ({ submission, completed }: { submission: HomeworkSubmission; completed: boolean }) => {
      const sessionId = Number(hw?.session_id);
      if (!Number.isFinite(sessionId) || sessionId <= 0) {
        throw new Error("과제 차시를 확인할 수 없습니다.");
      }
      return patchAssessmentCorrection(sessionId, {
        enrollment_id: submission.enrollment_id,
        source_type: "homework",
        source_id: hid,
        completed,
        note: completed ? "제출 파일 직접 확인" : "추가 확인 필요",
        expected_updated_at: submission.teacher_review_updated_at,
      });
    },
    onSuccess: async (_, variables) => {
      const refreshed = await submissionsQ.refetch();
      if (refreshed.isError) {
        teacherToast.error("저장됐지만 최신 제출 상태를 불러오지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      const current = refreshed.data?.find((submission) => submission.id === variables.submission.id);
      if (!current || current.teacher_reviewed !== variables.completed) {
        void scoreSheetQ.refetch();
        teacherToast.error("기록을 저장했지만 점수 결과가 우선합니다. 최신 성적을 확인해 주세요.");
        return;
      }
      setReviewSubmissionId(null);
      teacherToast.success(variables.completed ? "확인 완료로 기록했습니다." : "확인 완료를 취소했습니다.");
    },
    onError: (error: unknown) => {
      const apiError = error as { response?: { data?: { detail?: string } }; message?: string };
      teacherToast.error(apiError.response?.data?.detail || apiError.message || "확인 상태를 저장하지 못했습니다.");
      if (apiError.response?.data?.detail?.includes("다른 화면")) void submissionsQ.refetch();
    },
  });

  const requestReviewChange = async (submission: HomeworkSubmission, completed: boolean) => {
    if (reviewMut.isPending) return;
    const accepted = await confirm({
      title: completed ? `${submission.student_name} 제출 확인 완료` : `${submission.student_name} 확인 취소`,
      message: completed
        ? "사진·동영상을 직접 확인한 것으로 기록합니다. 이후 학생은 제출 파일을 바꿀 수 없습니다."
        : "직접 확인 기록을 취소하고 학생이 파일을 다시 바꿀 수 있게 합니다.",
      confirmText: completed ? "확인 완료" : "확인 취소",
      danger: !completed,
    });
    if (accepted) reviewMut.mutate({ submission, completed });
  };

  if (homeworkQ.isLoading || submissionsQ.isLoading) {
    return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  }
  if (homeworkQ.isError || submissionsQ.isError) {
    return <EmptyState scope="panel" tone="error" title="과제 상세를 불러오지 못했습니다" description="제출 현황을 빈 목록으로 표시하지 않았습니다." actions={<EmptyActionButton onClick={() => { void homeworkQ.refetch(); void submissionsQ.refetch(); }}>다시 시도</EmptyActionButton>} />;
  }
  if (!hw) return <EmptyState scope="panel" tone="error" title="과제를 찾을 수 없습니다" />;

  const dueDate = hw.due_date;
  const maxScore = hw.max_score;
  const submissionRows = submissions ?? [];
  const submitted = submissionRows.filter(isSubmittedSubmission);
  const pending = submissionRows.filter((submission) => !isSubmittedSubmission(submission));
  const reviewedCount = submitted.filter((submission) => submission.teacher_reviewed).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className={`${styles.title} text-[17px] font-bold flex-1 truncate`}>{hw.title}</h1>
      </div>

      <div className={`${styles.panel} rounded-xl flex flex-col gap-2`}>
        {hw.session_title && <InfoRow label="수업" value={hw.session_title} />}
        {dueDate && <InfoRow label="마감일" value={dueDate} />}
        {maxScore != null && <InfoRow label="만점" value={`${maxScore}점`} />}
        <InfoRow label="제출" value={`${submitted.length} / ${submissionRows.length}`} accent />
        <InfoRow label="선생님 확인" value={`${reviewedCount} / ${submitted.length}`} accent />
      </div>

      {submitted.length > 0 && (
        <Section title={`제출 확인 (${submitted.length})`}>
          <p className={styles.reviewGuide}>자동검사 대신 제출 파일을 직접 보고 확인 완료를 기록합니다.</p>
          {submitted.map((s) => (
            <div key={s.id} className={`${styles.row} py-2`}>
              <div className="flex justify-between items-center gap-2">
                <span className={`${styles.title} text-sm`}>
                  {s.student_name}
                </span>
                <span className={`${styles.successText} text-xs font-semibold`}>
                  {formatDate(s.submitted_at)}
                </span>
              </div>
              <div className={styles.files}>
                {s.files.map((file) => (
                  <div key={file.id} className={styles.fileRow}>
                    <div className={styles.fileName}>
                      <strong>{file.original_filename}</strong>
                      <span>{file.removed_at || file.status === "removed" ? "교체됨" : file.status === "failed" ? "업로드 실패" : file.status === "uploading" ? "저장 중" : "미리보기 가능"}</span>
                      {file.error_message && <span className={styles.dangerText}>{file.error_message}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                <Badge tone={s.teacher_reviewed ? "success" : "warning"} size="xs">
                  {reviewLabel(s, hasRecordedScore(s))}
                </Badge>
                <button type="button" className={styles.reviewButton} onClick={() => setReviewSubmissionId(s.id)}>
                  제출물 확인
                </button>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <PendingSection
          pending={pending}
          homeworkTitle={hw.title}
          dueDate={dueDate ?? undefined}
          onCopy={async (text) => {
            try {
              await navigator.clipboard.writeText(text);
              teacherToast.success(`미제출 ${pending.length}명 명단이 복사되었습니다.`);
            } catch {
              teacherToast.error("복사에 실패했습니다.");
            }
          }}
          onOpenStudent={(submission) => {
            if (submission.student_id != null && submission.student_id > 0) {
              navigate(`/workspace/mobile/students/${submission.student_id}`);
            } else {
              teacherToast.error("학생 상세 정보를 찾을 수 없습니다.");
            }
          }}
        />
      )}

      {submissionRows.length === 0 && (
        <EmptyState scope="panel" tone="empty" title="제출 현황이 없습니다" description="수강생이 과제를 제출하면 이 화면에서 파일을 직접 확인할 수 있습니다." actions={<EmptyActionButton variant="secondary" onClick={() => navigate(-1)}>차시로 돌아가기</EmptyActionButton>} />
      )}

      <HomeworkReviewSheet
        key={reviewSubmission?.id ?? "closed"}
        homeworkId={hid}
        submission={reviewSubmission}
        busy={reviewMut.isPending}
        canSave={Boolean(scoreSheetQ.isSuccess && hw.session_id && hw.session_id > 0 && reviewSubmission?.enrollment_id && reviewSubmission.enrollment_id > 0)}
        scoreLocked={reviewSubmission ? hasRecordedScore(reviewSubmission) : false}
        scoreStatusError={scoreSheetQ.isError}
        scoreStatusLoading={scoreSheetQ.isLoading}
        onRetryScores={() => void scoreSheetQ.refetch()}
        onClose={() => setReviewSubmissionId(null)}
        onReview={(submission, completed) => void requestReviewChange(submission, completed)}
      />
    </div>
  );
}

function HomeworkReviewSheet({ homeworkId, submission, busy, canSave, scoreLocked, scoreStatusError, scoreStatusLoading, onRetryScores, onClose, onReview }: { homeworkId: number; submission: HomeworkSubmission | null; busy: boolean; canSave: boolean; scoreLocked: boolean; scoreStatusError: boolean; scoreStatusLoading: boolean; onRetryScores: () => void; onClose: () => void; onReview: (submission: HomeworkSubmission, completed: boolean) => void }) {
  const files = useMemo(
    () => (submission?.files ?? []).filter((file) => !file.removed_at),
    [submission?.files],
  );
  const readyFiles = useMemo(
    () => files.filter((file) => file.status === "uploaded"),
    [files],
  );
  const firstReadyFileId = readyFiles[0]?.id ?? null;
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [previewedFileIds, setPreviewedFileIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedFileId(firstReadyFileId);
  }, [submission?.id, firstReadyFileId]);

  const selectedFile = readyFiles.find((file) => file.id === selectedFileId) ?? readyFiles[0] ?? null;
  const previewQ = useQuery({
    queryKey: teacherExamsQueryKeys.homeworkSubmissionPreview(homeworkId, selectedFile?.id ?? null),
    queryFn: () => fetchHomeworkSubmissionPreview(homeworkId, selectedFile!.id),
    enabled: submission != null && selectedFile != null,
    staleTime: 8 * 60 * 1000,
    retry: 1,
  });
  const allFilesPreviewed = readyFiles.length > 0 && readyFiles.every((file) => previewedFileIds.includes(file.id));
  const markPreviewed = (fileId: string) => {
    setPreviewedFileIds((current) => current.includes(fileId) ? current : [...current, fileId]);
  };

  return (
    <BottomSheet
      open={submission != null}
      onClose={onClose}
      title={submission ? `${submission.student_name} 제출 확인` : "제출 확인"}
      footer={submission && (
        submission.teacher_review_source === "score" || scoreLocked ? (
          <div className={styles.reviewLocked}>점수가 입력되어 성적 화면에서 결과를 관리합니다.</div>
        ) : (
          <button
            type="button"
            className={styles.reviewFooterButton}
            data-danger={submission.teacher_reviewed || undefined}
            disabled={busy || !canSave || (!submission.teacher_reviewed && !allFilesPreviewed)}
            onClick={() => onReview(submission, !submission.teacher_reviewed)}
          >
            {busy ? "저장 중…" : submission.teacher_reviewed ? "확인 완료 취소" : "직접 확인 완료"}
          </button>
        )
      )}
    >
      {submission && (
        <div className={styles.reviewSheet}>
          <div className={styles.reviewState} data-reviewed={submission.teacher_reviewed || undefined}>
            <strong>{reviewLabel(submission, scoreLocked)}</strong>
            <span>{submission.teacher_review_source === "score" || scoreLocked ? "점수 화면에서 결과를 관리할 수 있습니다." : submission.teacher_reviewed ? "교사 확인 기록이 저장되었습니다." : "제출 파일을 모두 열어본 뒤 확인 완료를 기록하세요."}</span>
          </div>

          <div className={styles.previewFrame}>
            {selectedFile == null && <span>미리 볼 수 있는 파일이 없습니다.</span>}
            {selectedFile && previewQ.isLoading && <span>미리보기를 준비하는 중…</span>}
            {selectedFile && previewQ.isError && (
              <button type="button" className={styles.previewRetry} onClick={() => void previewQ.refetch()}>파일을 불러오지 못했습니다 · 다시 시도</button>
            )}
            {selectedFile && previewQ.data && selectedFile.media_kind === "image" && (
              <img src={previewQ.data.url} alt={`${selectedFile.original_filename} 과제 제출 미리보기`} onLoad={() => markPreviewed(selectedFile.id)} />
            )}
            {selectedFile && previewQ.data && selectedFile.media_kind === "video" && (
              <video src={previewQ.data.url} controls playsInline preload="metadata" onLoadedMetadata={() => markPreviewed(selectedFile.id)}>브라우저에서 이 동영상을 재생할 수 없습니다.</video>
            )}
          </div>
          {scoreStatusLoading && <p className={styles.reviewHint}>성적 상태를 확인하는 중…</p>}
          {scoreStatusError && <button type="button" className={styles.previewRetry} onClick={onRetryScores}>성적 상태를 불러오지 못했습니다 · 다시 시도</button>}
          {!canSave && !scoreStatusLoading && !scoreStatusError && !scoreLocked && submission.teacher_review_source !== "score" && (
            <p className={styles.reviewHint}>학생 수강 정보 또는 과제 차시를 확인할 수 없어 저장할 수 없습니다. 다시 불러온 뒤 시도해 주세요.</p>
          )}
          {!submission.teacher_reviewed && readyFiles.length > 0 && !allFilesPreviewed && (
            <p className={styles.reviewHint}>제출 파일 {previewedFileIds.filter((id) => readyFiles.some((file) => file.id === id)).length} / {readyFiles.length}개를 열었습니다.</p>
          )}

          <div className={styles.fileRail} aria-label="제출 파일 목록">
            {files.map((file) => (
              <button
                type="button"
                key={file.id}
                className={styles.fileChoice}
                data-selected={selectedFile?.id === file.id || undefined}
                data-failed={file.status !== "uploaded" || undefined}
                disabled={file.status !== "uploaded"}
                onClick={() => setSelectedFileId(file.id)}
              >
                <span>{file.media_kind === "video" ? "동영상" : "사진"} {file.position + 1}</span>
                <strong>{file.original_filename}</strong>
                <small>{file.status === "uploaded" ? formatCompactFileSize(file.file_size) : file.error_message || "업로드 실패"}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function InfoRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="flex justify-between text-sm"><span className={styles.mutedText}>{label}</span><span className={accent ? styles.primaryText : styles.title}>{value}</span></div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div className={`${styles.panel} rounded-xl`}><h3 className={`${styles.title} text-sm font-bold mb-3`}>{title}</h3><div className="flex flex-col gap-0">{children}</div></div>;
}

function PendingSection({ pending, homeworkTitle, dueDate, onCopy, onOpenStudent }: { pending: HomeworkSubmission[]; homeworkTitle: string; dueDate?: string; onCopy: (text: string) => Promise<void> | void; onOpenStudent: (submission: HomeworkSubmission) => void }) {
  const handleCopyAll = () => {
    const lines = pending.map((submission) => {
      const phone = submission.student_phone ?? submission.parent_phone ?? "";
      return phone ? `${submission.student_name} (${phone})` : submission.student_name;
    });
    const header = `[${homeworkTitle}] 미제출 ${pending.length}명${dueDate ? ` · 마감 ${dueDate}` : ""}`;
    onCopy([header, ...lines].join("\n"));
  };

  return (
    <div className={`${styles.panel} rounded-xl`}>
      <div className="flex items-center justify-between mb-3"><h3 className={`${styles.title} text-sm font-bold`}>미제출 ({pending.length})</h3><button type="button" onClick={handleCopyAll} className={`${styles.copyButton} text-[12px] font-semibold cursor-pointer`}>명단 복사</button></div>
      <div className="flex flex-col gap-0">
        {pending.map((submission) => (
          <div key={submission.id} className={`${styles.row} flex justify-between items-center py-2`}>
            <span className={`${styles.title} text-sm`}>{submission.student_name}</span>
            <div className="flex items-center gap-2"><span className={`${styles.dangerText} text-xs font-semibold`}>미제출</span><button type="button" onClick={() => onOpenStudent(submission)} className={`${styles.contactButton} ${styles.contactButtonDetail} text-[11px] font-semibold cursor-pointer`} title="학생 상세로 이동">상세</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`${styles.backButton} flex p-1 cursor-pointer`} aria-label="뒤로 가기"><svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg></button>;
}
