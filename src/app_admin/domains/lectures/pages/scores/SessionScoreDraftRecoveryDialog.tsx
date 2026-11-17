import { useEffect, useRef } from "react";
import type { PendingChange } from "@admin/domains/scores/public/scoreDraft";
import type { SessionScoreRow } from "@/shared/api/contracts/sessionScores";
import { getHomeworkStatus, homeworkStatusLabel } from "@/shared/scoring/homeworkStatus";
import { feedback } from "@/shared/ui/feedback/feedback";

type Props = {
  items: readonly { row: SessionScoreRow | undefined; assessment: { title: string } | undefined; change: PendingChange }[];
  changeCount: number;
  error: string | null;
  isStale: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isStarting: boolean;
  isDiscarding: boolean;
  needsFullRoster: boolean;
  needsScoreRetry: boolean;
  needsVisibleRows: boolean;
  onPrimary: () => void;
  onDiscard: () => void;
  onDefer: () => void;
};

function describeDraftChange(change: PendingChange) {
  if (change.type === "homework") {
    const status = getHomeworkStatus({ score: change.score, metaStatus: change.metaStatus });
    return `과제 ${status === "SCORED" ? `${change.score}점` : homeworkStatusLabel(status)}`;
  }
  if (change.type === "examTotal" && change.metaStatus === "NOT_SUBMITTED") return "미응시";
  const part = { examTotal: "총점", examObjective: "객관식", examSubjective: "주관식" }[change.type];
  return `${part} ${change.score}점`;
}

export default function SessionScoreDraftRecoveryDialog({
  items, changeCount, error, isStale, isLoading, isFetching, isStarting, isDiscarding,
  needsFullRoster, needsScoreRetry, needsVisibleRows, onPrimary, onDiscard, onDefer,
}: Props) {
  const recoveryRestoreButtonRef = useRef<HTMLButtonElement>(null);
  const recoveryDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const restoreButton = recoveryRestoreButtonRef.current;
    if (restoreButton && !restoreButton.disabled) restoreButton.focus();
    else recoveryDialogRef.current?.focus();

    const keepFocusInsideDialog = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        feedback.info("임시저장을 복원하거나 버리기를 선택해 주세요.");
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = recoveryDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (active === dialog || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keepFocusInsideDialog);
    return () => {
      document.removeEventListener("keydown", keepFocusInsideDialog);
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-restore-title-entry"
      aria-describedby="draft-restore-description-entry"
    >
      <div
        ref={recoveryDialogRef}
        tabIndex={-1}
        className="bg-[var(--color-bg-surface)] rounded-lg shadow-lg p-6 max-w-md mx-4 border border-[var(--color-border-divider)]"
      >
        <h2 id="draft-restore-title-entry" className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
          {changeCount > 0
            ? `임시저장된 변경 ${changeCount}건이 있습니다. 복원할까요?`
            : "이전에 임시저장된 편집 내용이 있습니다. 복원할까요?"}
        </h2>
        <p id="draft-restore-description-entry" className="text-sm text-[var(--color-text-muted)] mb-4">
          {needsFullRoster
            ? "임시저장에 이 반의 성적표에서 확인할 수 없는 학생이 있습니다. 전체 성적에서 대상 학생을 확인해 주세요."
            : needsScoreRetry
              ? "현재 성적표에서 임시저장된 학생이나 평가를 확인할 수 없습니다. 임시저장은 보존됩니다. 성적표를 다시 불러오거나 나중에 확인해 주세요."
              : isStale
                ? "서버 성적이 변경되었습니다. 복원하면 보존된 입력을 최신 성적표에 다시 적용해 저장합니다. 버리면 최신 성적을 유지합니다."
                : "복원하면 이전 편집 내용이 테이블에 다시 적용됩니다. 버리면 현재 서버 데이터만 표시됩니다."}
        </p>
        {!isLoading && !needsFullRoster && !needsScoreRetry && items.length > 0 && items.every(({ assessment }) => assessment !== undefined) && (
          <ul aria-label="복원할 성적 변경" className="mb-4 max-h-32 space-y-1 overflow-y-auto break-words text-sm text-[var(--color-text-primary)]">
            {items.map(({ row, assessment, change }) => (
              <li key={`${change.enrollmentId}-${change.type}-${change.type === "homework" ? change.homeworkId : change.examId}`}>
                {row?.student_name} · {assessment?.title} · {describeDraftChange(change)}
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="text-sm text-[var(--color-error)] mb-3" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2 justify-end">
          {needsScoreRetry && (
            <button
              type="button"
              disabled={isDiscarding || isStarting}
              onClick={onDefer}
              className="h-9 px-4 rounded text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-soft)]"
            >
              나중에 확인
            </button>
          )}
          {!needsFullRoster && !needsVisibleRows && <button
            type="button"
            disabled={isLoading || isDiscarding || isStarting}
            onClick={onDiscard}
            className="h-9 px-4 rounded text-sm font-medium border border-[var(--color-border-divider)] bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-soft)]"
          >
            {isDiscarding ? "버리는 중…" : "버리기"}
          </button>}
          <button
            type="button"
            ref={recoveryRestoreButtonRef}
            disabled={isLoading || (needsScoreRetry && isFetching) || isDiscarding || isStarting}
            onClick={onPrimary}
            className="h-9 px-4 rounded text-sm font-medium bg-[var(--color-brand-primary)] text-[color:var(--color-brand-primary-contrast)] hover:bg-[var(--color-brand-primary-hover)]"
          >
            {isStarting
              ? "복원 준비 중…"
              : isLoading
                ? "성적표 불러오는 중…"
                : needsFullRoster
                  ? "전체 성적에서 초안 확인"
                  : needsScoreRetry
                    ? "성적표 다시 불러오기"
                    : needsVisibleRows
                      ? "대상 학생 표시"
                      : "복원 후 수정"}
          </button>
        </div>
      </div>
    </div>
  );
}
