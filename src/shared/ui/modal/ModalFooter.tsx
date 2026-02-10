// PATH: src/shared/ui/modal/ModalFooter.tsx
import React from "react";

export default function ModalFooter({
  left,
  right,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "16px 24px",
        borderTop: "1px solid var(--color-border-divider)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--color-bg-surface)",
      }}
    >
      <div>{left}</div>
      <div style={{ display: "flex", gap: 8 }}>{right}</div>
    </div>
  );
}
