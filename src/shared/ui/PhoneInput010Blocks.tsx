/**
 * 전화번호 입력: [010 고정 블록] [4자리] [4자리]
 * 4자리 채워지면 자동으로 다음 인풋으로 포커스 이동
 */
import { useRef, useCallback } from "react";

type Props = {
  value: string; // 11자리 "010xxxxxxxx"
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  blockClassName?: string;
  "data-invalid"?: boolean;
  "aria-label"?: string;
};

function getParts(raw: string): { first4: string; last4: string } {
  const d = String(raw).replace(/\D/g, "");
  const eight = d.startsWith("010") ? d.slice(3, 11) : d.slice(0, 8);
  return {
    first4: eight.slice(0, 4),
    last4: eight.slice(4, 8),
  };
}

export function PhoneInput010Blocks({
  value,
  onChange,
  disabled,
  className = "",
  inputClassName = "",
  blockClassName = "",
  "data-invalid": dataInvalid,
  "aria-label": ariaLabel,
}: Props) {
  const secondInputRef = useRef<HTMLInputElement>(null);
  const { first4, last4 } = getParts(value);

  const setRaw = useCallback(
    (first: string, last: string) => {
      const f = first.replace(/\D/g, "").slice(0, 4);
      const l = last.replace(/\D/g, "").slice(0, 4);
      onChange("010" + f + l);
    },
    [onChange]
  );

  const handleFirstChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
      setRaw(v, last4);
      if (v.length === 4) secondInputRef.current?.focus();
    },
    [last4, setRaw]
  );

  const handleLastChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
      setRaw(first4, v);
    },
    [first4, setRaw]
  );

  const handleFirstPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8);
      if (pasted.length >= 8) {
        e.preventDefault();
        onChange("010" + pasted.slice(0, 8));
        secondInputRef.current?.focus();
      }
    },
    [onChange]
  );

  const handleLastPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
      if (pasted.length >= 4) {
        e.preventDefault();
        const rest = pasted.slice(0, 8);
        setRaw(first4, rest.length >= 4 ? rest.slice(0, 4) : first4);
        if (rest.length >= 4) secondInputRef.current?.focus();
      }
    },
    [first4, setRaw]
  );

  const invalid = dataInvalid === true || dataInvalid === "true";

  return (
    <div
      className={className}
      style={{ display: "flex", alignItems: "stretch", gap: "0.25rem" }}
      aria-label={ariaLabel}
    >
      <div
        className={blockClassName}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.875rem 1rem",
          minWidth: "3.5rem",
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: "var(--color-text-muted, #666)",
          background: "var(--color-bg-surface-soft, #f5f5f5)",
          border: "1px solid var(--color-border-divider, #e0e0e0)",
          borderRadius: "12px",
          userSelect: "none",
        }}
        aria-hidden
      >
        010
      </div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={4}
        placeholder="0000"
        value={first4}
        onChange={handleFirstChange}
        onPaste={handleFirstPaste}
        disabled={disabled}
        className={inputClassName}
        data-invalid={invalid ? "true" : undefined}
        style={{
          width: "4ch",
          flex: "1",
          minWidth: "3.5rem",
          textAlign: "center",
          padding: "0.875rem 0.5rem",
          fontSize: "0.9375rem",
          border: invalid ? "2px solid var(--color-status-danger, #ef4444)" : "1px solid var(--color-border-divider, #e0e0e0)",
          borderRadius: "12px",
          outline: "none",
        }}
        aria-label={ariaLabel ? `${ariaLabel} 앞 4자리` : "전화번호 앞 4자리"}
      />
      <input
        ref={secondInputRef}
        type="text"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={4}
        placeholder="0000"
        value={last4}
        onChange={handleLastChange}
        onPaste={handleLastPaste}
        disabled={disabled}
        className={inputClassName}
        data-invalid={invalid ? "true" : undefined}
        style={{
          width: "4ch",
          flex: "1",
          minWidth: "3.5rem",
          textAlign: "center",
          padding: "0.875rem 0.5rem",
          fontSize: "0.9375rem",
          border: invalid ? "2px solid var(--color-status-danger, #ef4444)" : "1px solid var(--color-border-divider, #e0e0e0)",
          borderRadius: "12px",
          outline: "none",
        }}
        aria-label={ariaLabel ? `${ariaLabel} 뒤 4자리` : "전화번호 뒤 4자리"}
      />
    </div>
  );
}
