// PATH: src/shared/ui/modal/ModalHeader.tsx
import { AlertTriangle, Plus, Search } from "lucide-react";
import React from "react";

type ModalHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** description alias — 일부 caller 가 subtitle 명칭을 더 자연스럽게 사용 (예: ExamHeaderQuickEdit) */
  subtitle?: React.ReactNode;
  type?: "action" | "confirm" | "inspect";
  /** title 좌측 자동 prefix 아이콘(28x28 박스) 숨김 — title 안에 자체 아이콘이 있는 경우 등 */
  noIcon?: boolean;
};

function Icon({ type }: { type: "action" | "confirm" | "inspect" }) {
  if (type === "confirm") {
    return <AlertTriangle className="modal-header__icon-svg" aria-hidden="true" />;
  }

  if (type === "inspect") {
    return <Search className="modal-header__icon-svg" aria-hidden="true" />;
  }

  return <Plus className="modal-header__icon-svg" aria-hidden="true" />;
}

export default function ModalHeader({
  title,
  description,
  subtitle,
  type = "action",
  noIcon = false,
}: ModalHeaderProps) {
  const isConfirm = type === "confirm";
  const resolvedDescription = description ?? subtitle;

  return (
    <div
      className={`modal-header modal-header--${type}`}
    >
      <div aria-hidden className="modal-header__accent" />

      <div className="modal-header__row">
        {!noIcon && (
          <div
            aria-hidden
            className="modal-header__icon"
          >
            <Icon type={type} />
          </div>
        )}

        <div className="modal-header__copy">
          <div className="modal-header__title">
            {title}
          </div>

          {resolvedDescription && (
            <div className="modal-header__description">
              {resolvedDescription}
            </div>
          )}

          {/* confirm-only: subtle warning cue */}
          {isConfirm && (
            <div className="modal-header__warning">
              <span
                aria-hidden
                className="modal-header__warning-dot"
              />
              변경 사항은 되돌릴 수 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
