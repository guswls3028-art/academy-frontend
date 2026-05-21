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
      <div className="modal-footer__side">{left}</div>
      <div className="modal-footer__actions">{right}</div>
    </div>
  );
}
