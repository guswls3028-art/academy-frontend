// PATH: src/shared/ui/ds/PageHeader.tsx
import React from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  bottom?: React.ReactNode;

  variant?: "hero" | "card" | "plain";
  importance?: "primary" | "normal";
  sticky?: boolean;
  className?: string;
};

export default function PageHeader({
  title,
  description,
  badge,
  actions,
  meta,
  bottom,
  variant = "hero",
  importance = "primary",
  sticky,
  className,
}: PageHeaderProps) {
  const isHero = variant === "hero";
  const isCard = variant === "card";

  const shell =
    isHero || isCard
      ? cx(
          "border border-[var(--border-divider)] bg-[var(--bg-surface)]",
          isHero ? "rounded-3xl shadow-sm" : "rounded-2xl"
        )
      : "";

  const pad = isHero ? "px-8 py-8" : isCard ? "px-6 py-5" : "px-0 py-0";

  const titleCls =
    importance === "primary"
      ? "text-2xl font-bold tracking-[-0.35px]"
      : "text-xl font-semibold tracking-[-0.25px]";

  const stickyCls = sticky
    ? "sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--bg-surface)_82%,transparent)]"
    : "";

  // Hero-only: subtle gradient + stronger separation from work area
  const heroStyle: React.CSSProperties | undefined = isHero
    ? {
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--color-bg-surface-hover) 62%, transparent), var(--color-bg-surface))",
      }
    : undefined;

  return (
    <div className={cx(shell, stickyCls, className)} style={heroStyle}>
      <div className={pad}>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={cx(titleCls, "text-[var(--text-primary)] truncate")}>
                {title}
              </div>
              {badge}
            </div>

            {!!description && (
              <div className="text-sm text-[var(--text-muted)] leading-relaxed">
                {description}
              </div>
            )}
          </div>

          {!!actions && <div className="shrink-0">{actions}</div>}
        </div>

        {!!meta && (
          <div className="mt-5 text-[11px] font-semibold text-[var(--text-muted)]">
            {meta}
          </div>
        )}
      </div>

      {!!bottom && (
        <div className="border-t border-[var(--border-divider)] px-8 py-5">
          {bottom}
        </div>
      )}
    </div>
  );
}
