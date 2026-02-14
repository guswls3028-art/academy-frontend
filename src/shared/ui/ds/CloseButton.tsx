// PATH: src/shared/ui/ds/CloseButton.tsx
// 전역 닫기 버튼 SSOT — 모달·오버레이 등 모든 닫기에 우상단 X 버튼 통일

import React from "react";

type CloseButtonProps = {
  onClick: () => void;
  "aria-label"?: string;
  className?: string;
};

export default function CloseButton({
  onClick,
  "aria-label": ariaLabel = "닫기",
  className = "",
}: CloseButtonProps) {
  return (
    <button
      type="button"
      className={`ds-close-btn ${className}`.trim()}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span aria-hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </span>
    </button>
  );
}
