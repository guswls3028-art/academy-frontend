// PATH: src/shared/ui/state/PanelState.tsx
import React from "react";
import EmptyState from "@/shared/ui/ds/EmptyState";

export default function PanelState({
  title,
  description,
  tone = "empty",
}: {
  title?: string;
  description?: string;
  tone?: "empty" | "error" | "loading";
}) {
  // PanelBody 내부에서 쓰이므로 "panel card"를 중첩하지 않는다.
  return (
    <div style={{ padding: "var(--space-2) 0" }}>
      <EmptyState
        mode="embedded"
        scope="panel"
        tone={tone}
        title={title ?? "데이터 없음"}
        description={description}
      />
    </div>
  );
}
