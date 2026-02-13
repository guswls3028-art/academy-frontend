// PATH: src/shared/ui/modal/ModalBody.tsx
import React from "react";

export default function ModalBody({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "16px 20px",
        background: "var(--color-modal-bg)",
      }}
    >
      {children}
    </div>
  );
}
