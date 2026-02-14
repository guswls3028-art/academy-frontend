// PATH: src/shared/ui/modal/ModalBody.tsx
import React from "react";

export default function ModalBody({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="modal-body">{children}</div>;
}
