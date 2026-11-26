// PATH: src/shared/ui/modal/ModalFooter.tsx
import React from "react";
import { ControlSizeContext } from "@/shared/ui/ds/ControlSizeContext";

export default function ModalFooter({
  left,
  right,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <ControlSizeContext.Provider value="md">
      <div className="modal-footer" data-control-size="md">
        <div className="modal-footer__side">{left}</div>
        <div className="modal-footer__actions">{right}</div>
      </div>
    </ControlSizeContext.Provider>
  );
}
