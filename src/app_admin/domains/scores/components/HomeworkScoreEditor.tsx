import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { getHomeworkScoreCellConflict, type HomeworkScoreCellValue, type SaveDrawerHomeworkScore } from "../api/patchHomeworkQuick";
import { scoresQueryKeys } from "../api/queryKeys";
import type { SessionScoreHomeworkEntry } from "../api/sessionScores";

function homeworkConflictValueLabel(value: HomeworkScoreCellValue): string {
  if (value.meta_status === "VIDEO_MAKEUP") return "영상 보강";
  if (value.meta_status === "NOT_SUBMITTED") return "미제출";
  return value.score == null ? "미입력" : String(value.score);
}

export default function HomeworkScoreEditor({
  homework, enrollmentId, maxScore, completion, blockedReason, onSave,
}: {
  homework: SessionScoreHomeworkEntry;
  enrollmentId: number;
  maxScore: number | null;
  completion: boolean;
  blockedReason?: string;
  onSave: SaveDrawerHomeworkScore;
}) {
  const qc = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<HomeworkScoreCellValue | null>(null);
  const restoreFocus = useRef(false);
  const savedScore = homework.block.score;
  const actionLabel = completion ? "채점 결과 입력" : savedScore == null ? "점수 입력" : "점수 수정";

  function closeEditor() {
    restoreFocus.current = true;
    setDraft(null);
    setError(null);
    setConflict(null);
  }

  useEffect(() => {
    if (draft !== null || !restoreFocus.current || blockedReason) return;
    restoreFocus.current = false;
    editorRef.current?.querySelector("button")?.focus();
  }, [blockedReason, draft]);

  const save = useMutation({
    mutationFn: async (score: number) => {
      await onSave({ enrollmentId, homeworkId: homework.homework_id, score, maxScore, expectedUpdatedAt });
      await Promise.all([
        qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScoresRoot }),
        qc.invalidateQueries({ queryKey: scoresQueryKeys.attemptHistory("homework", homework.homework_id, enrollmentId) }),
        qc.invalidateQueries({ queryKey: scoresQueryKeys.clinicTargets }),
      ]);
    },
    onSuccess: () => {
      closeEditor();
      feedback.success(completion ? "과제 완료 상태를 저장했습니다." : "과제 점수를 저장했습니다.");
    },
    onError: (requestError) => {
      const latest = getHomeworkScoreCellConflict(requestError);
      if (latest) {
        setConflict(latest.serverValue);
        void qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScoresRoot });
      } else {
        setError(getApiErrorMessage(requestError, "과제 점수를 저장하지 못했습니다. 다시 시도해 주세요."));
      }
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft?.trim() || save.isPending || blockedReason || conflict) return;
    const score = Number(draft);
    if (maxScore == null || !Number.isFinite(score) || score < 0 || score > maxScore) {
      setError(maxScore == null ? "과제 만점을 확인할 수 없습니다." : `0점부터 ${maxScore}점까지 입력해 주세요.`);
      return;
    }
    setError(null);
    save.mutate(score);
  }

  return (
    <div ref={editorRef} className="student-scores-drawer__homework-editor">
      {draft === null ? (
        <Button
          type="button"
          size="sm"
          intent="secondary"
          disabled={!!blockedReason}
          onClick={() => {
            setExpectedUpdatedAt(homework.block.updated_at ?? null);
            setDraft(savedScore == null ? "" : String(savedScore));
          }}
        >
          {actionLabel}
        </Button>
      ) : (
        <form
          aria-label={`${homework.title} ${actionLabel}`}
          className="ssd-attempt-card__input-row"
          noValidate
          onSubmit={submit}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            if (!save.isPending) closeEditor();
          }}
        >
          {completion ? (
            <div className="ssd-attempt-card__input-row" role="group" aria-label="과제 완료 상태">
              {["0", "1"].map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  intent={draft === value ? "primary" : "secondary"}
                  aria-pressed={draft === value}
                  disabled={save.isPending}
                  onClick={() => { setDraft(value); setError(null); }}
                >
                  {value === "1" ? "완료" : "미완료"}
                </Button>
              ))}
            </div>
          ) : (
            <>
              <input
                autoFocus
                aria-label="과제 점수"
                placeholder="점수"
                className="ssd-attempt-card__input"
                type="number"
                inputMode="decimal"
                min={0}
                max={maxScore ?? undefined}
                step="any"
                value={draft}
                disabled={save.isPending}
                onChange={(event) => { setDraft(event.target.value); setError(null); }}
              />
              {maxScore != null && <span className="ssd-attempt-card__max">/ {maxScore}</span>}
            </>
          )}
          <Button type="submit" intent="primary" size="sm" disabled={!draft.trim() || save.isPending || !!blockedReason || !!conflict}>
            {save.isPending ? "저장 중…" : "저장"}
          </Button>
          <Button type="button" size="sm" intent="secondary" disabled={save.isPending} onClick={closeEditor}>취소</Button>
          {conflict && (
            <div className="ssd-attempt-card__conflict" role="alert">
              <span>다른 화면에서 먼저 저장했습니다. 최신 서버값 {homeworkConflictValueLabel(conflict)} · 내 입력 {draft}</span>
              <button
                type="button"
                onClick={() => {
                  setExpectedUpdatedAt(conflict.updated_at);
                  setConflict(null);
                }}
              >
                내 점수 다시 적용
              </button>
            </div>
          )}
        </form>
      )}
      {blockedReason && !save.isPending && <p className="student-scores-drawer__homework-editor-note">{blockedReason}</p>}
      {error && <p className="student-scores-drawer__homework-editor-error" role="alert">{error}</p>}
    </div>
  );
}
