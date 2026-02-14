// PATH: src/shared/ui/modal/ModalOptionRow.tsx
// 모달 SSOT — 날짜/시간 등 옵션 한 행 (라디오 + 레이블 + 설명/커스텀 영역)

import type { ReactNode } from "react";

export interface ModalOptionRowProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  primaryLabel: ReactNode;
  secondaryLabel?: ReactNode;
  children?: ReactNode;
  /** children 클릭 시 라디오 전파 막음 */
  stopPropagationForContent?: boolean;
  className?: string;
}

export default function ModalOptionRow({
  name,
  value,
  checked,
  onChange,
  disabled = false,
  primaryLabel,
  secondaryLabel,
  children,
  stopPropagationForContent = true,
  className = "",
}: ModalOptionRowProps) {
  const baseClass = "modal-option-row flex items-center gap-3 rounded-xl border border-[var(--border-divider)] p-3 transition";
  const interactiveClass = disabled
    ? "modal-option-row--disabled cursor-not-allowed bg-[var(--color-bg-surface-soft)]"
    : "cursor-pointer hover:bg-[var(--color-bg-surface-soft)]";
  const fullClass = `${baseClass} ${interactiveClass} ${className}`.trim();

  return (
    <label className={fullClass}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-4 h-4 shrink-0"
      />
      <span className="text-[14px] font-medium text-[var(--color-text-primary)] shrink-0">
        {primaryLabel}
      </span>
      {secondaryLabel != null && (
        <span className="text-[13px] text-[var(--color-text-muted)] truncate min-w-0">
          {secondaryLabel}
        </span>
      )}
      {children}
    </label>
  );
}

/** 직접선택 + 인라인 컨텐츠(달력/시간 등) — 컨텐츠 영역 클릭 시 라디오 전파 방지 */
export interface ModalOptionRowWithContentProps extends Omit<ModalOptionRowProps, "children" | "secondaryLabel"> {
  primaryLabel: ReactNode;
  showContent: boolean;
  content: ReactNode;
  className?: string;
}

export function ModalOptionRowWithContent({
  name,
  value,
  checked,
  onChange,
  disabled,
  primaryLabel,
  showContent,
  content,
  className = "",
}: ModalOptionRowWithContentProps) {
  const baseClass = "modal-option-row flex flex-col gap-2 rounded-xl border border-[var(--border-divider)] p-3 transition hover:bg-[var(--color-bg-surface-soft)]";
  const fullClass = `${baseClass} ${className}`.trim();

  return (
    <label className={fullClass}>
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => !disabled && onChange()}>
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="w-4 h-4 shrink-0"
        />
        <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
          {primaryLabel}
        </span>
      </div>
      {showContent && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          role="group"
          aria-label={typeof primaryLabel === "string" ? primaryLabel : undefined}
        >
          {content}
        </div>
      )}
    </label>
  );
}
