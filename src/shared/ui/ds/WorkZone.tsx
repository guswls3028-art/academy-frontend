// PATH: src/shared/ui/ds/WorkZone.tsx
import React from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export type WorkZoneTone = "default" | "muted";
export type WorkZoneDensity = "default" | "compact";

type WorkZoneProps = React.PropsWithChildren<{
  tone?: WorkZoneTone;
  density?: WorkZoneDensity;
  className?: string;
}>;

/**
 * ======================================================
 * WorkZone (FINAL MISSING PIECE)
 *
 * 역할:
 * - 실제 업무 콘텐츠 (table / form / grid / list)의
 *   "표준 작업 바닥"
 *
 * 의도:
 * - Page ↔ Panel 사이의 암묵 영역 제거
 * - div / 임의 padding / 임의 bg 사용 금지
 * - 디자이너 개입 없이 항상 같은 결과 보장
 *
 * 사용 규칙:
 * - Panel 안에서만 사용
 * - Page 바로 아래 사용 ❌
 * ======================================================
 */
export default function WorkZone({
  tone = "default",
  density = "default",
  className,
  children,
}: WorkZoneProps) {
  const pad =
    density === "compact"
      ? "var(--space-4)"
      : "var(--space-5)";

  const bg =
    tone === "muted"
      ? "var(--color-bg-surface-soft)"
      : "var(--color-bg-surface)";

  return (
    <div
      className={cx("ds-workzone", className)}
      data-tone={tone}
      data-density={density}
      style={{
        padding: pad,
        background: bg,
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-divider)",
      }}
    >
      {children}
    </div>
  );
}
