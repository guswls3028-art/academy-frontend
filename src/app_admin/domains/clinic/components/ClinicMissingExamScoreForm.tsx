import { useId, useState } from "react";

type Props = {
  maxScore?: number | null;
  saving: boolean;
  disabled: boolean;
  onSave: (score: number) => Promise<void>;
};

export default function ClinicMissingExamScoreForm({ maxScore, saving, disabled, onSave }: Props) {
  const inputId = useId();
  const [score, setScore] = useState("");

  return (
    <form
      className="clinic-workbench__score-entry"
      onSubmit={async (event) => {
        event.preventDefault();
        if (disabled || !score.trim()) return;
        const value = Number(score);
        if (!Number.isFinite(value) || value < 0) return;
        await onSave(value);
      }}
    >
      <label htmlFor={inputId}>시험 점수</label>
      <input
        id={inputId}
        type="number"
        inputMode="decimal"
        min={0}
        max={maxScore != null && maxScore > 0 ? maxScore : undefined}
        step="any"
        required
        value={score}
        disabled={disabled}
        aria-describedby={`${inputId}-help`}
        onChange={(event) => setScore(event.target.value)}
      />
      <button type="submit" disabled={disabled || !score.trim()}>
        {saving ? "저장 중…" : "점수 저장"}
      </button>
      <p id={`${inputId}-help`} className="clinic-workbench__score-help">
        저장하면 성적표의 미응시가 입력한 점수로 바뀝니다.
      </p>
    </form>
  );
}
