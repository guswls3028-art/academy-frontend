// PATH: src/shared/ui/ds/components/ActionBar.tsx
import { ReactNode } from "react";

export default function ActionBar({
  children,
  align = "right",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div
      className="ds-action-bar"
      data-align={align}
    >
      {children}
    </div>
  );
}
