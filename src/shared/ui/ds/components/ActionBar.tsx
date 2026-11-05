// PATH: src/shared/ui/ds/components/ActionBar.tsx
import { ReactNode } from "react";
import { ControlSizeContext, type ControlSize } from "../ControlSizeContext";

export default function ActionBar({
  children,
  align = "right",
  size = "lg",
}: {
  children: ReactNode;
  align?: "left" | "right";
  size?: ControlSize;
}) {
  return (
    <ControlSizeContext.Provider value={size}>
      <div className="ds-action-bar" data-align={align} data-control-size={size}>
        {children}
      </div>
    </ControlSizeContext.Provider>
  );
}
