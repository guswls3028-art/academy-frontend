// PATH: src/shared/ui/modal/AdminModal.tsx
import { Modal } from "antd";
import React from "react";

export type AdminModalType = "action" | "confirm" | "inspect";

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

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={width}
      centered
      destroyOnClose
      maskClosable={!isConfirm}
      closable={!isConfirm}
      keyboard={!isConfirm}
      styles={{
        content: {
          padding: 0,
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
          border: isConfirm
            ? "1px solid color-mix(in srgb, var(--color-error) 28%, var(--color-border-divider))"
            : "1px solid var(--color-border-divider)",
          boxShadow: isConfirm
            ? "0 18px 60px rgba(0,0,0,0.40)"
            : "0 14px 48px rgba(0,0,0,0.28)",
          background: "var(--color-bg-surface)",
        },
        mask: {
          backdropFilter: "blur(3px)",
          backgroundColor: isConfirm ? "rgba(0,0,0,0.58)" : "rgba(0,0,0,0.42)",
        },
      }}
      className={`admin-modal admin-modal--${type}`}
    >
      {children}
    </Modal>
  );
}
