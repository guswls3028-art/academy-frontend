import { useId } from "react";
import type {
  StudentInitialPasswordMode,
  StudentInitialPasswordSettings,
} from "./initialPassword";
import styles from "./InitialPasswordMethodSelector.module.css";

interface Props {
  value: StudentInitialPasswordSettings;
  onChange: (next: StudentInitialPasswordSettings) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{
  value: StudentInitialPasswordMode;
  label: string;
  description: string;
}> = [
  {
    value: "fixed",
    label: "직접 입력",
    description: "새 학생과 새 학부모 계정에 입력한 비밀번호를 적용합니다.",
  },
  {
    value: "random",
    label: "학생별 안전한 임시 비밀번호",
    description: "6자리 임시 비밀번호를 만들고 완료 후 목록을 내려받습니다.",
  },
];

export default function InitialPasswordMethodSelector({
  value,
  onChange,
  disabled = false,
}: Props) {
  const fieldId = useId();
  const radioName = `student-initial-password-mode-${fieldId}`;
  const fixedPasswordId = `student-excel-fixed-password-${fieldId}`;
  return (
    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend className={styles.legend}>신규 학생 초기 비밀번호 방식</legend>
      <div className={styles.options}>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={styles.option}
            data-selected={value.mode === option.value ? "true" : "false"}
          >
            <input
              type="radio"
              name={radioName}
              value={option.value}
              checked={value.mode === option.value}
              onChange={() => onChange({ ...value, mode: option.value })}
            />
            <span className={styles.optionText}>
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </span>
          </label>
        ))}
      </div>

      {value.mode === "fixed" ? (
        <div className={styles.fixedPassword}>
          <label htmlFor={fixedPasswordId}>공통 초기 비밀번호</label>
          <input
            id={fixedPasswordId}
            type="password"
            value={value.fixedPassword}
            onChange={(event) => onChange({ ...value, fixedPassword: event.target.value })}
            placeholder="4자 이상"
            minLength={4}
            autoComplete="new-password"
          />
          <span>4자 이상 입력해 주세요.</span>
        </div>
      ) : null}
    </fieldset>
  );
}
