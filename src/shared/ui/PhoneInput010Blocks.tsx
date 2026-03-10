/**
 * 전화번호 입력: [010 고정 블록] [4자리] [4자리]
 * 표기는 4+4칸이지만 한 개의 8자리 필드처럼 동작:
 * - 연속으로 8자리 입력 시 앞 4자리 채운 뒤 뒤 4자리로 자연스럽게 이어짐
 * - 두 번째 칸에서 백스페이스 시 뒤 4자리 비어 있으면 앞 4자리 마지막 한 글자 삭제 후 첫 칸으로 포커스
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

/**
 * value는 "010" + (앞 4자리) + (뒤 4자리)로 저장.
 * 숫자는 왼쪽(앞 4자리)부터 채워나감 — 4자리 미만이면 뒷칸은 비어 있음.
 * 예: "0101" → first4="1", last4=""  / "01012345" → first4="1234", last4="5"
 */
function getParts(raw: string): { first4: string; last4: string } {
  const d = String(raw).replace(/\D/g, "");
  const eight = d.startsWith("010") ? d.slice(3, 11) : d.slice(0, 8);
  return { first4: eight.slice(0, 4), last4: eight.slice(4, 8) };
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
  const firstInputRef = useRef<HTMLInputElement>(null);
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
      const v = e.target.value.replace(/\D/g, "").slice(0, 8);
      if (v.length <= 4) {
        setRaw(v, last4);
        if (v.length === 4) secondInputRef.current?.focus();
      } else {
        setRaw(v.slice(0, 4), v.slice(4, 8));
        secondInputRef.current?.focus();
      }
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
      if (pasted.length > 4) {
        e.preventDefault();
        setRaw(pasted.slice(0, 4), pasted.slice(4, 8));
        secondInputRef.current?.focus();
      }
    },
    [setRaw]
  );

  const handleLastPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8);
      if (pasted.length >= 8) {
        e.preventDefault();
        setRaw(pasted.slice(0, 4), pasted.slice(4, 8));
      } else if (pasted.length >= 4) {
        e.preventDefault();
        setRaw(first4, pasted.slice(0, 4));
      }
    },
    [first4, setRaw]
  );

  const handleSecondKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Backspace") return;
      if (last4 === "") {
        // 이미 비어 있음 — 앞 칸 마지막 글자 삭제 후 앞 칸으로 포커스
        if (first4.length > 0) {
          e.preventDefault();
          setRaw(first4.slice(0, -1), "");
          requestAnimationFrame(() => {
            const el = firstInputRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          });
        }
      } else if (last4.length === 1) {
        // 마지막 한 자리 삭제 → 뒷칸이 비게 되므로 앞 칸으로 바로 이동
        e.preventDefault();
        setRaw(first4, "");
        requestAnimationFrame(() => {
          const el = firstInputRef.current;
          if (!el) return;
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        });
      }
    },
    [first4, last4, setRaw]
  );

  const invalid = !!dataInvalid;

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
          color: "var(--auth-text-muted, var(--color-text-muted, #666))",
          background: "var(--auth-surface, var(--color-bg-surface-soft, #f5f5f5))",
          border: "1px solid var(--auth-border, var(--color-border-divider, #e0e0e0))",
          borderRadius: "12px",
          userSelect: "none",
        }}
        aria-hidden
      >
        010
      </div>
      <input
        ref={firstInputRef}
        type="text"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={8}
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
          border: invalid ? "2px solid var(--auth-error, var(--color-status-danger, #ef4444))" : "1px solid var(--auth-border, var(--color-border-divider, #e0e0e0))",
          borderRadius: "12px",
          outline: "none",
          background: "var(--auth-surface, var(--color-bg-surface, #fff))",
          color: "var(--auth-text, var(--color-text-primary, #111))",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--auth-accent, var(--color-primary, #2563eb))";
          e.target.style.boxShadow = "0 0 0 3px var(--auth-focus, rgba(37, 99, 235, 0.2))";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = invalid ? "var(--auth-error, var(--color-status-danger, #ef4444))" : "var(--auth-border, var(--color-border-divider, #e0e0e0))";
          e.target.style.boxShadow = "none";
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
        onKeyDown={handleSecondKeyDown}
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
          border: invalid ? "2px solid var(--auth-error, var(--color-status-danger, #ef4444))" : "1px solid var(--auth-border, var(--color-border-divider, #e0e0e0))",
          borderRadius: "12px",
          outline: "none",
          background: "var(--auth-surface, var(--color-bg-surface, #fff))",
          color: "var(--auth-text, var(--color-text-primary, #111))",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--auth-accent, var(--color-primary, #2563eb))";
          e.target.style.boxShadow = "0 0 0 3px var(--auth-focus, rgba(37, 99, 235, 0.2))";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = invalid ? "var(--auth-error, var(--color-status-danger, #ef4444))" : "var(--auth-border, var(--color-border-divider, #e0e0e0))";
          e.target.style.boxShadow = "none";
        }}
        aria-label={ariaLabel ? `${ariaLabel} 뒤 4자리` : "전화번호 뒤 4자리"}
      />
    </div>
  );
}
