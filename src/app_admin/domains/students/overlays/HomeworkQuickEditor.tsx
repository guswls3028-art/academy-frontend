import { useEffect, useState } from "react";

import {
  updateStudentHomeworkGrade,
  type StudentHomeworkGrade,
} from "@/shared/api/contracts/studentGrades";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import styles from "./StudentsDetailOverlay.module.css";

export default function HomeworkQuickEditor({
  grade,
  onClose,
  onUpdated,
}: {
  grade: StudentHomeworkGrade;
  onClose: () => void;
  onUpdated: () => Promise<unknown>;
}) {
  const maxScore = Number(grade.max_score ?? (grade.grading_mode === "COMPLETION" ? 1 : 100));
  const [draft, setDraft] = useState(grade.score == null ? "" : String(grade.score));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(grade.score == null ? "" : String(grade.score));
  }, [grade.homework_id, grade.enrollment_id, grade.score]);

  const save = async (score: number) => {
    if (grade.is_locked || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateStudentHomeworkGrade(grade, score);
      await onUpdated();
      feedback.success(
        grade.grading_mode === "COMPLETION"
          ? score >= 1 ? "과제를 완료로 변경했습니다." : "과제를 미완료로 변경했습니다."
          : "과제 점수를 변경했습니다.",
      );
    } catch (requestError) {
      const detail = (requestError as {
        response?: { data?: { detail?: string } };
      })?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : requestError instanceof Error
            ? requestError.message
            : "과제 상태를 변경하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = () => {
    const score = Number(draft);
    if (!Number.isFinite(score) || score < 0 || score > maxScore) {
      setError(`점수는 0부터 ${maxScore} 사이로 입력해 주세요.`);
      return;
    }
    void save(score);
  };

  const completionValue = grade.score == null ? null : grade.score >= 1;

  return (
    <div
      id={`homework-quick-editor-${grade.homework_id}-${grade.enrollment_id}`}
      className={styles.homeworkQuickEditor}
      role="region"
      aria-label={`${grade.title} 바로 수정`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className={styles.homeworkQuickHeader}>
        <div>
          <strong>{grade.grading_mode === "COMPLETION" ? "완료 상태 변경" : "점수 바로 수정"}</strong>
          <p>
            {grade.grading_mode === "COMPLETION"
              ? "선택 즉시 저장되고 클리닉 판정도 함께 갱신됩니다."
              : "점수를 저장하면 합격 기준에 따라 완료 상태가 다시 계산됩니다."}
          </p>
        </div>
        <button type="button" className={styles.homeworkQuickClose} onClick={onClose} aria-label="과제 바로 수정 닫기">×</button>
      </div>

      {grade.is_locked ? (
        <p className={styles.homeworkQuickError} role="alert">
          이 과제 결과는 현재 잠겨 있어 변경할 수 없습니다.
        </p>
      ) : grade.grading_mode === "COMPLETION" ? (
        <div className={styles.homeworkCompletionChoices} role="group" aria-label="완료 상태">
          <Button
            type="button"
            intent={completionValue === false ? "danger" : "secondary"}
            size="sm"
            disabled={saving}
            aria-pressed={completionValue === false}
            onClick={() => void save(0)}
          >
            미완료
          </Button>
          <Button
            type="button"
            intent={completionValue === true ? "primary" : "secondary"}
            size="sm"
            disabled={saving}
            aria-pressed={completionValue === true}
            onClick={() => void save(1)}
          >
            완료
          </Button>
        </div>
      ) : (
        <div className={styles.homeworkScoreEditor}>
          <label>
            <span>현재 점수</span>
            <span className={styles.homeworkScoreInputWrap}>
              <input
                type="number"
                min={0}
                max={maxScore}
                step={0.1}
                value={draft}
                disabled={saving}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveDraft();
                  }
                }}
              />
              <span>/ {maxScore}</span>
            </span>
          </label>
          <div className={styles.homeworkQuickActions}>
            <Button type="button" intent="secondary" size="sm" disabled={saving} onClick={() => void save(maxScore)}>
              전부 완료
            </Button>
            <Button type="button" intent="primary" size="sm" disabled={saving || !draft.trim()} onClick={saveDraft}>
              {saving ? "저장 중…" : "점수 저장"}
            </Button>
          </div>
        </div>
      )}
      {error && <p className={styles.homeworkQuickError} role="alert">{error}</p>}
    </div>
  );
}
