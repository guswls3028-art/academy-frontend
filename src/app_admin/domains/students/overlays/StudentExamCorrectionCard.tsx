import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, PencilLine, X } from "lucide-react";

import {
  fetchSessionScores,
  patchAssessmentCorrection,
  type ScoreBlock,
  type SessionScoresResponse,
} from "@admin/domains/scores/api/sessionScores";
import { scoresQueryKeys } from "@admin/domains/scores/api/queryKeys";
import { adminStudentsQueryKeys } from "../queryKeys";
import type { StudentExamGrade } from "@/shared/api/contracts/studentGrades";
import { achievementLabel, achievementTone } from "@/shared/scoring/achievement";
import { useWrongCompletionDisplay, wrongCompletionLabel } from "@/shared/scoring/assessmentStatusDisplay";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { Badge, Button, ICON, type BadgeTone } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useTenantLabels } from "@/shared/hooks/useTenantLabels";
import layoutStyles from "./StudentsDetailOverlay.module.css";
import styles from "./StudentExamCorrectionCard.module.css";

type Props = {
  exam: StudentExamGrade;
  studentId: number;
  onNavigate: (path: string) => void;
};

type CorrectionStatus = NonNullable<ScoreBlock["correction_status"]> | null;

function isPositiveInteger(value: number | null | undefined): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function exactExamBlock(data: SessionScoresResponse | undefined, exam: StudentExamGrade): ScoreBlock | null {
  if (!data) return null;
  const rows = data.rows.filter((row) => row.enrollment_id === exam.enrollment_id);
  if (rows.length !== 1) return null;
  const entries = rows[0].exams.filter((entry) => entry.exam_id === exam.exam_id);
  return entries.length === 1 ? entries[0].block : null;
}

function statusPresentation(status: CorrectionStatus, wrongCompletionOnly: boolean): { label: string; tone: BadgeTone } {
  if (status === "PENDING") return { label: "오답 미완료", tone: "warning" };
  if (status === "COMPLETED") return { label: "오답 완료", tone: "success" };
  if (status === "NOT_REQUIRED") {
    return {
      label: wrongCompletionOnly ? wrongCompletionLabel(status) ?? "오답 완료" : "오답 없음",
      tone: wrongCompletionOnly ? "success" : "muted",
    };
  }
  return { label: "채점 대기", tone: "muted" };
}

export default function StudentExamCorrectionCard({ exam, studentId, onNavigate }: Props) {
  const labels = useTenantLabels();
  const wrongCompletionOnly = useWrongCompletionDisplay();
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [note, setNote] = useState("");
  const [reasonRequested, setReasonRequested] = useState(false);
  const [persistedReadbackError, setPersistedReadbackError] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const sessionId = Number(exam.session_id);
  const hasExactIdentity = isPositiveInteger(sessionId)
    && isPositiveInteger(exam.enrollment_id)
    && isPositiveInteger(exam.exam_id);
  const queryKey = scoresQueryKeys.sessionScores(sessionId);
  const correctionQuery = useQuery({
    queryKey,
    queryFn: () => fetchSessionScores(sessionId),
    enabled: hasExactIdentity,
    staleTime: 15_000,
  });
  const block = useMemo(
    () => exactExamBlock(correctionQuery.data, exam),
    [correctionQuery.data, exam],
  );
  const persistedNote = block?.correction_note ?? "";
  const status = block?.correction_status ?? null;
  const identityMismatch = correctionQuery.isSuccess && block == null;
  const stateUnavailable = !hasExactIdentity || correctionQuery.isError || identityMismatch;
  const canEdit = !stateUnavailable && (status === "PENDING" || status === "COMPLETED");
  const presentation = statusPresentation(status, wrongCompletionOnly);
  const rawAchievementTone = exam.achievement ? achievementTone(exam.achievement) : "muted";
  const examAchievementTone: BadgeTone = rawAchievementTone === "warn" ? "warning" : rawAchievementTone;
  const navPath = hasExactIdentity && isPositiveInteger(exam.lecture_id)
    ? `/workspace/lectures/${exam.lecture_id}/sessions/${sessionId}/scores`
    : "";

  useEffect(() => {
    setNote(persistedNote);
    setReasonRequested(false);
  }, [persistedNote, exam.exam_id]);

  const mutation = useMutation({
    mutationFn: async ({ completed, nextNote }: { completed: boolean; nextNote: string }) => {
      if (!hasExactIdentity || !block) {
        throw new Error("시험 판정 대상을 다시 확인해 주세요.");
      }
      const response = await patchAssessmentCorrection(sessionId, {
        enrollment_id: exam.enrollment_id,
        source_type: "exam",
        source_id: exam.exam_id,
        completed,
        note: nextNote,
        expected_updated_at: block.correction_updated_at ?? null,
      });
      const fresh = await qc.fetchQuery({
        queryKey,
        queryFn: () => fetchSessionScores(sessionId),
        staleTime: 0,
      });
      const freshBlock = exactExamBlock(fresh, exam);
      const expectedStatus = completed ? "COMPLETED" : "PENDING";
      if (!freshBlock || freshBlock.correction_status !== expectedStatus) {
        throw new Error("저장 결과가 최신 시험 목록에 반영되지 않았습니다. 다시 확인해 주세요.");
      }
      await qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.studentGrades(studentId) });
      return { response, freshBlock, completed };
    },
    onSuccess: ({ freshBlock, completed }) => {
      setNote(freshBlock.correction_note ?? "");
      setReasonRequested(false);
      setPersistedReadbackError(null);
      feedback.success(completed
        ? "오답 확인을 완료로 저장했습니다. 원점수는 그대로 유지됩니다."
        : "오답 확인을 미완료로 저장했습니다.");
    },
    onError: (error) => {
      const message = getApiErrorMessage(
        error,
        "오답 확인 상태를 저장하지 못했습니다. 최신 상태를 확인한 뒤 다시 시도해 주세요.",
      );
      setPersistedReadbackError(message);
      feedback.error(message);
    },
  });

  const saveStatus = (completed: boolean) => {
    const nextNote = note.trim();
    if (completed && nextNote.length < 2) {
      setReasonRequested(true);
      noteRef.current?.focus();
      return;
    }
    setPersistedReadbackError(null);
    mutation.mutate({ completed, nextNote });
  };

  const statusNode = correctionQuery.isLoading
    ? <Badge size="xs" tone="muted">오답 확인 중</Badge>
    : stateUnavailable
      ? <Badge size="xs" tone="warning">상태 확인 필요</Badge>
      : <Badge size="xs" tone={presentation.tone}>{presentation.label}</Badge>;

  return (
    <div className={styles.examRecordGroup}>
      <div
        className={`${layoutStyles.tabRecord} ${styles.examRecord}`}
        data-correction-status={status?.toLowerCase() ?? "unavailable"}
        data-clickable={navPath ? "" : undefined}
        onClick={navPath ? () => onNavigate(navPath) : undefined}
      >
        {exam.lecture_title && (
          <LectureChip
            lectureName={exam.lecture_title}
            color={exam.lecture_color ?? undefined}
            chipLabel={exam.lecture_chip_label}
            size={24}
          />
        )}
        <div className={`${layoutStyles.recordMain} ${styles.recordMain}`}>
          <div className={layoutStyles.recordTitleRow}>
            <span className={layoutStyles.recordTitle}>{exam.title}</span>
            <Badge
              size="xs"
              tone={exam.session_type === "REGULAR" ? "info" : exam.session_type === "SUPPLEMENT" ? "teal" : "muted"}
            >
              {exam.session_type === "REGULAR" ? "정규" : exam.session_type === "SUPPLEMENT" ? "보강" : "구분 필요"}
            </Badge>
          </div>
          <div className={layoutStyles.recordMetaRow}>
            {exam.session_title && <span>{exam.session_title}</span>}
            {(exam.retake_count ?? 0) > 1 && <span>· 재시도 {(exam.retake_count ?? 0) - 1}회</span>}
            {exam.submitted_at && <span>· {exam.submitted_at.slice(0, 10)}</span>}
          </div>
        </div>
        <div className={`${layoutStyles.recordActions} ${styles.recordActions}`}>
          {exam.total_score != null && (
            <span className={layoutStyles.scoreValue}>
              {Math.round(exam.total_score)}<span className={layoutStyles.scoreMax}>/{exam.max_score ?? 100}</span>
            </span>
          )}
          {!wrongCompletionOnly && exam.achievement && (
            <Badge variant="solid" size="sm" tone={examAchievementTone}>
              {achievementLabel(exam.achievement, { pass: labels.pass, fail: labels.fail })}
            </Badge>
          )}
          {!wrongCompletionOnly && !exam.achievement && (exam.remediated === true || exam.final_pass === true) && (
            <Badge variant="solid" size="sm" tone={exam.remediated ? "warning" : "success"}>
              {exam.remediated ? "보강합격" : labels.pass}
            </Badge>
          )}
          {!wrongCompletionOnly && exam.is_pass != null && !exam.achievement && exam.remediated !== true && exam.final_pass !== true && (
            <Badge variant="solid" size="sm" tone={exam.is_pass ? "success" : "danger"}>
              {exam.is_pass ? "합" : "불"}
            </Badge>
          )}
          <span className={styles.correctionStatus}>{statusNode}</span>
          {canEdit && (
            <Button
              size="sm"
              intent="secondary"
              aria-expanded={editorOpen}
              onClick={(event) => {
                event.stopPropagation();
                setEditorOpen((current) => !current);
                setPersistedReadbackError(null);
              }}
            >
              <PencilLine size={ICON.xs} aria-hidden />
              오답 수정
            </Button>
          )}
          {stateUnavailable && hasExactIdentity && (
            <Button
              size="sm"
              intent="secondary"
              onClick={(event) => {
                event.stopPropagation();
                void correctionQuery.refetch();
              }}
            >
              다시 확인
            </Button>
          )}
          {navPath && <ChevronRight size={ICON.sm} className={`${layoutStyles.chevronIcon} ${styles.chevron}`} aria-hidden />}
        </div>
      </div>

      {editorOpen && canEdit && block && (
        <section
          className={styles.editor}
          aria-label={`${exam.title} 테스트 오답 수정`}
          data-status={status?.toLowerCase() ?? "pending"}
        >
          <header className={styles.header}>
            <div>
              <strong>테스트 오답 확인</strong>
              <p>원점수는 바꾸지 않고, 현장에서 오답을 확인했는지만 저장합니다.</p>
            </div>
            <button
              type="button"
              className={styles.close}
              aria-label="오답 수정 닫기"
              onClick={() => setEditorOpen(false)}
              disabled={mutation.isPending}
            >
              <X size={ICON.sm} aria-hidden />
            </button>
          </header>
          <div className={styles.choices} role="group" aria-label="테스트 오답 상태 저장">
            <Button
              size="sm"
              intent="secondary"
              aria-pressed={status === "PENDING"}
              onClick={() => saveStatus(false)}
              disabled={mutation.isPending}
              loading={mutation.isPending && mutation.variables?.completed === false}
            >
              오답 미완료로 저장
            </Button>
            <Button
              size="sm"
              intent="primary"
              aria-pressed={status === "COMPLETED"}
              onClick={() => saveStatus(true)}
              disabled={mutation.isPending}
              loading={mutation.isPending && mutation.variables?.completed === true}
            >
              오답 완료로 저장
            </Button>
          </div>
          <label className={styles.note}>
            <span>오답 확인 사유 <small>완료 시 2자 이상 · 500자 이내</small></span>
            {reasonRequested && note.trim().length < 2 && (
              <strong role="alert" className={styles.error}>
                오답 완료 사유를 2자 이상 입력해 주세요.
              </strong>
            )}
            <textarea
              ref={noteRef}
              aria-label="오답 확인 사유"
              aria-invalid={reasonRequested && note.trim().length < 2}
              value={note}
              rows={2}
              maxLength={500}
              placeholder="예: 문자 제출 재풀이 확인"
              onChange={(event) => {
                setNote(event.target.value);
                if (event.target.value.trim().length >= 2) setReasonRequested(false);
              }}
              disabled={mutation.isPending}
            />
          </label>
          <footer className={styles.footer}>
            <span aria-live="polite">{mutation.isPending ? "저장 후 다시 확인하는 중…" : `${note.length}/500`}</span>
            {persistedReadbackError && <strong role="alert">{persistedReadbackError}</strong>}
          </footer>
        </section>
      )}
    </div>
  );
}
