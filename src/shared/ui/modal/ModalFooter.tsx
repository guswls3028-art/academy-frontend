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
    <div className="modal-footer">
      <div>{left}</div>
      <div style={{ display: "flex", gap: 8 }}>{right}</div>
    </div>
  );
}
