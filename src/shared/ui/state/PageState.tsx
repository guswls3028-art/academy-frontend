// PATH: src/shared/ui/state/PageState.tsx
import React from "react";
import EmptyState, { EmptyStateTone } from "@/shared/ui/ds/EmptyState";

export type PageStateType = "empty" | "loading" | "error";

export default function PageState({
  type,
  title,
  description,
}: {
  type: PageStateType;
  title?: string;
  description?: string;
}) {
  const tone: EmptyStateTone =
    type === "loading" ? "loading" : type === "error" ? "error" : "empty";

  const fallbackTitle =
    type === "loading"
      ? title ?? "불러오는 중…"
      : type === "error"
      ? title ?? "문제가 발생했습니다"
      : title ?? "표시할 데이터가 없습니다";

  const fallbackDesc =
    type === "loading"
      ? description ?? "잠시만 기다려주세요."
      : type === "error"
      ? description ?? "잠시 후 다시 시도해주세요."
      : description;

  // Page context: do NOT render a nested panel container.
  // Place this under hero or as page content section.
  return (
    <div
      style={{
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)",
        boxShadow: "var(--elevation-1)",
      }}
    >
      <EmptyState
        mode="embedded"
        scope="page"
        tone={tone}
        title={fallbackTitle}
        description={fallbackDesc}
      />
    </div>
  );
}
