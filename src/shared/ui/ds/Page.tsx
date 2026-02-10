// PATH: src/shared/ui/ds/Page.tsx
import React from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export type PageDensity = "focus" | "browse" | "inspect";

type PageProps = React.PropsWithChildren<{
  width?: "default" | "wide" | "full";
  padding?: "default" | "compact";
  background?: "app" | "transparent";
  density?: PageDensity;
  className?: string;
}>;

export default function Page({
  width = "default",
  padding = "default",
  background = "transparent",
  density = "inspect",
  className,
  children,
}: PageProps) {
  const widthCls =
    width === "full"
      ? "max-w-none"
      : width === "wide"
      ? "max-w-[1440px]"
      : "max-w-[1200px]";

  const padCls = padding === "compact" ? "px-5 py-5" : "px-6 py-6";
  const bgCls = background === "app" ? "bg-[var(--bg-app)]" : "";

  const densityGap =
    density === "focus"
      ? "space-y-8"
      : density === "browse"
      ? "space-y-6"
      : "space-y-5";

  return (
    <div
      className={cx("ds-page", bgCls, className)}
      data-page-density={density}
      data-page-width={width}
      data-page-padding={padding}
      data-page-background={background}
    >
      <div className={cx("mx-auto w-full", widthCls, padCls)}>
        <div className={densityGap}>{children}</div>
      </div>
    </div>
  );
}
