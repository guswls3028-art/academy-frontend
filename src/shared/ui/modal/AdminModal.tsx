// PATH: src/shared/ui/modal/AdminModal.tsx
import { Modal } from "antd";
import React from "react";

import { BRAND_AND_LIGHT_THEMES, MODAL_DEFAULT_WIDTH } from "./constants";
import { useModalKeyboard } from "./useModalKeyboard";

export type AdminModalType = "action" | "confirm" | "inspect";

function getModalBackground(): string {
  const theme = document.documentElement.getAttribute("data-theme") || "";
  return BRAND_AND_LIGHT_THEMES.has(theme) ? "#ffffff" : "var(--color-modal-bg)";
}

type AdminModalProps = {
  open: boolean;
  onClose: () => void;
  type?: AdminModalType;
  width?: number | string;
  /** 모달 위에 또 다른 모달을 띄울 때 상위 모달에 더 높은 값 지정 (기본 1000) */
  zIndex?: number;
  /** 추가 클래스명 (예: 클리닉 패스카드 모달 반응형) */
  className?: string;
  /** Enter 키로 긍정 버튼(등록/적용/확인) 실행. textarea 포커스 시에는 동작하지 않음 */
  onEnterConfirm?: () => void;
  children: React.ReactNode;
};

export default function AdminModal({
  open,
  onClose,
  type = "action",
  width = MODAL_DEFAULT_WIDTH,
  zIndex,
  className,
  onEnterConfirm,
  children,
}: AdminModalProps) {
  const isConfirm = type === "confirm";
  const contentBg = getModalBackground();

  useModalKeyboard(open, onClose, onEnterConfirm);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={width}
      centered
      destroyOnHidden
      zIndex={zIndex}
      mask={{ closable: !isConfirm }}
      closable={!isConfirm}
      keyboard={true}
      styles={{
        content: {
          padding: 0,
          overflow: "hidden",
          /* border, borderRadius, boxShadow, background → modal.css SSOT */
        },
        mask: {
          backdropFilter: "blur(3px)",
          backgroundColor: isConfirm ? "rgba(0,0,0,0.58)" : "rgba(0,0,0,0.42)",
        },
      }}
      className={className ? `admin-modal admin-modal--${type} ${className}` : `admin-modal admin-modal--${type}`}
    >
      <div
        className="admin-modal__inner"
        style={
          contentBg === "#ffffff"
            ? ({
                "--color-modal-bg": "#ffffff",
                "--color-bg-surface": "#ffffff",
                "--color-bg-surface-hover": "#f8fafc",
              } as React.CSSProperties)
            : undefined
        }
      >
        {children}
      </div>
    </Modal>
  );
}
