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
  invalidStudentPhoneNames?: string[];
}

const OPTIONS: Array<{
  value: StudentInitialPasswordMode;
  label: string;
  description: string;
}> = [
  {
    value: "phone_last4",
    label: "학생 휴대폰 번호 뒤 4자리",
    description: "엑셀의 학생 전화번호를 기준으로 자동 설정합니다.",
  },
  {
    value: "fixed",
    label: "공통 비밀번호 직접 입력",
    description: "새로 등록되는 모든 학생에게 같은 비밀번호를 적용합니다.",
  },
  {
    value: "random",
    label: "학생별 랜덤 비밀번호",
    description: "등록 완료 후 학생별 비밀번호 목록이 자동으로 내려받아집니다.",
  },
];

export default function InitialPasswordMethodSelector({
  value,
  onChange,
  disabled = false,
  invalidStudentPhoneNames = [],
}: Props) {
  const fieldId = useId();
  const radioName = `student-initial-password-mode-${fieldId}`;
  const fixedPasswordId = `student-excel-fixed-password-${fieldId}`;
  const invalidCount = invalidStudentPhoneNames.length;
  const invalidPreview = invalidStudentPhoneNames.slice(0, 4).join(", ");

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
            type="text"
            value={value.fixedPassword}
            onChange={(event) => onChange({ ...value, fixedPassword: event.target.value })}
            placeholder="4자 이상"
            minLength={4}
            autoComplete="off"
          />
          <span>4자 이상 입력해 주세요.</span>
        </div>
      ) : null}

      {value.mode === "phone_last4" && invalidCount > 0 ? (
        <div className={styles.phoneError} role="alert">
          학생 전화번호가 없거나 올바르지 않은 학생이 {invalidCount}명 있습니다
          {invalidPreview ? `: ${invalidPreview}` : ""}.
          엑셀에서 010으로 시작하는 11자리 학생 전화번호를 입력해 주세요.
        </div>
      ) : null}
    </fieldset>
  );
}
