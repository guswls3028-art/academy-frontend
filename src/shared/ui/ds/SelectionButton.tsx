import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/shared/utils/cx";
import type { BadgeTone } from "./components/Badge";

type SelectionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-pressed"> & {
  label: string;
  selected: boolean;
  tone?: BadgeTone;
  size?: "sm" | "md";
};

/** One outlined choice surface. Informational badges belong outside the label. */
export default function SelectionButton({
  label,
  selected,
  tone = "primary",
  size = "md",
  className,
  ...props
}: SelectionButtonProps) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={cx("ds-segment__btn", className)}
      data-tone={tone}
      data-size={size}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}
