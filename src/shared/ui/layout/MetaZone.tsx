// PATH: src/shared/ui/layout/MetaZone.tsx
import { PropsWithChildren } from "react";

export function MetaZone({ children }: PropsWithChildren) {
  return (
    <aside data-area="meta">
      {children}
    </aside>
  );
}
