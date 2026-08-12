import { useId, useState } from "react";
import type { CSSProperties, InputHTMLAttributes, KeyboardEvent } from "react";
import styles from "./PasswordControls.module.css";

type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  inputClassName?: string;
  inputStyle?: CSSProperties;
  wrapClassName?: string;
  wrapStyle?: CSSProperties;
};

export default function PasswordInput({
  label,
  value,
  onValueChange,
  inputClassName = "",
  inputStyle,
  wrapClassName = "",
  wrapStyle,
  disabled,
  id,
  "aria-describedby": describedBy,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...inputProps
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id || `password-${generatedId}`;
  const capsLockId = `${inputId}-caps-lock`;
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const updateCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState("CapsLock"));
  };

  return (
    <div>
      <div className={`${styles.inputWrap} ${wrapClassName}`.trim()} style={wrapStyle}>
        <input
          {...inputProps}
          id={inputId}
          type={visible ? "text" : "password"}
          className={`${styles.input} ${inputClassName}`.trim()}
          style={inputStyle}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            updateCapsLock(event);
            onKeyDown?.(event);
          }}
          onKeyUp={(event) => {
            updateCapsLock(event);
            onKeyUp?.(event);
          }}
          onBlur={(event) => {
            setCapsLock(false);
            onBlur?.(event);
          }}
          aria-label={inputProps["aria-label"] || label}
          aria-describedby={[describedBy, capsLock ? capsLockId : ""].filter(Boolean).join(" ") || undefined}
          autoCapitalize="none"
          spellCheck={false}
          disabled={disabled}
        />
        <button
          type="button"
          className={styles.visibilityButton}
          aria-label={`${label} ${visible ? "숨기기" : "보기"}`}
          aria-pressed={visible}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
        >
          {visible ? "숨김" : "보기"}
        </button>
      </div>
      {capsLock && (
        <p id={capsLockId} className={styles.capsLock} role="status">
          Caps Lock이 켜져 있습니다.
        </p>
      )}
    </div>
  );
}
