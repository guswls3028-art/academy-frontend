// PATH: src/shared/ui/ds/Section.tsx
import React from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export type SectionLevel = "primary" | "secondary" | "tertiary";

type SectionProps = React.PropsWithChildren<{
  title?: React.ReactNode;
  description?: React.ReactNode;
  right?: React.ReactNode;
  hint?: React.ReactNode;

  level?: SectionLevel;
  className?: string;
}>;

export default function Section({
  title,
  description,
  right,
  hint,
  level = "secondary",
  className,
  children,
}: SectionProps) {
  const gap =
    level === "primary"
      ? "space-y-6"
      : level === "secondary"
      ? "space-y-4"
      : "space-y-3";

  return (
    <section
      className={cx("ds-section", gap, className)}
      data-section-level={level}
      data-level={level}
    >
      {(title || description || right || hint) && (
        <div className="ds-section__header ds-section__header--padded">
          <div className="ds-section__header-row">
            <div className="ds-section__header-copy">
              {!!title && (
                <div className="ds-section__title">
                  {title}
                </div>
              )}
              {!!description && <div className="ds-section__description">{description}</div>}
              {!!hint && (
                <div className="ds-section__hint">
                  {hint}
                </div>
              )}
            </div>

            {!!right && <div className="ds-section__right">{right}</div>}
          </div>
        </div>
      )}

      <div className="ds-section__body ds-section__body--padded">
        <div className={gap}>{children}</div>
      </div>
    </section>
  );
}
