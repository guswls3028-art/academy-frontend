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
        padding: "20px 24px",
        background: "var(--color-bg-surface)",
      }}
    >
      {children}
    </div>
  );
}
