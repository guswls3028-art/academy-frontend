// PATH: src/shared/ui/modal/AdminModal.tsx
import { Modal } from "antd";
import React from "react";

export type AdminModalType = "action" | "confirm" | "inspect";

const BRAND_AND_LIGHT_THEMES = new Set([
  "modern-white", "navy-pro", "ivory-office", "minimal-mono",
  "kakao-business", "naver-works", "samsung-admin", "purple-insight",
]);

function getModalBackground(): string {
  const theme = document.documentElement.getAttribute("data-theme") || "";
  return BRAND_AND_LIGHT_THEMES.has(theme) ? "#ffffff" : "var(--color-modal-bg)";
}

type AdminModalProps = {
  open: boolean;
  onClose: () => void;
  type?: AdminModalType;
  width?: number;
  children: React.ReactNode;
};

export default function AdminModal({
  open,
  onClose,
  type = "action",
  width = 520,
  children,
}: AdminModalProps) {
  const isConfirm = type === "confirm";
  const contentBg = getModalBackground();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={width}
      centered
      destroyOnHidden
      maskClosable={!isConfirm}
      closable={!isConfirm}
      keyboard={!isConfirm}
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
      className={`admin-modal admin-modal--${type}`}
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
