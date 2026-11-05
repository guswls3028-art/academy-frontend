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
    <ControlSizeContext.Provider value="lg">
      <div className="modal-footer" data-control-size="lg">
        <div className="modal-footer__side">{left}</div>
        <div className="modal-footer__actions">{right}</div>
      </div>
    </ControlSizeContext.Provider>
  );
}
