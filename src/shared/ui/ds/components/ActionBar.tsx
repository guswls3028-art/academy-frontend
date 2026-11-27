// PATH: src/shared/ui/ds/components/ActionBar.tsx
import { useContext, type ReactNode } from "react";
import { ControlSizeContext, type ControlSize } from "../ControlSizeContext";

export default function ActionBar({
  children,
  align = "right",
  size,
}: {
  children: ReactNode;
  align?: "left" | "right";
  size?: ControlSize;
}) {
  const inheritedSize = useContext(ControlSizeContext);
  const controlSize = size ?? inheritedSize ?? "lg";
  return (
    <ControlSizeContext.Provider value={controlSize}>
      <div className="ds-action-bar" data-align={align} data-control-size={controlSize}>
        {children}
      </div>
    </ControlSizeContext.Provider>
  );
}
