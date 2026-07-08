import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  ReactNode,
} from "react";
import { ChevronRight } from "lucide-react";
import { cx } from "@/shared/utils/cx";
import styles from "./TreeNav.module.css";

type TreeTone = "default" | "primary" | "accent" | "muted";
type TreeDensity = "normal" | "compact";
type TreeVariant = "default" | "hero";

type TreeNavProps = HTMLAttributes<HTMLElement> & {
  ariaLabel?: string;
};

export function TreeNav({
  ariaLabel,
  className,
  children,
  ...props
}: TreeNavProps) {
  return (
    <nav
      {...props}
      aria-label={ariaLabel ?? props["aria-label"]}
      className={cx(styles.root, className)}
    >
      {children}
    </nav>
  );
}

export function TreeBranch({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cx(styles.branch, className)}>
      {children}
    </div>
  );
}

export function TreeChildren({
  className,
  children,
  level = 1,
  ...props
}: HTMLAttributes<HTMLDivElement> & { level?: number }) {
  return (
    <div
      {...props}
      className={cx(styles.children, className)}
      style={{ "--tree-level": level, ...props.style } as CSSProperties}
    >
      {children}
    </div>
  );
}

type TreeToolbarProps = HTMLAttributes<HTMLDivElement> & {
  meta?: ReactNode;
  actions?: ReactNode;
};

export function TreeToolbar({
  className,
  meta,
  actions,
  children,
  ...props
}: TreeToolbarProps) {
  return (
    <div {...props} className={cx(styles.toolbar, className)}>
      <div className={styles.toolbarMeta}>{meta ?? children}</div>
      {actions != null && <div className={styles.toolbarActions}>{actions}</div>}
    </div>
  );
}

export function TreeIconButton({
  className,
  children,
  type = "button",
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...buttonProps}
      type={type}
      className={cx(styles.toolbarButton, className)}
    >
      {children}
    </button>
  );
}

type SharedTreeRowProps = {
  label: ReactNode;
  icon?: ReactNode;
  count?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  active?: boolean;
  selected?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  tone?: TreeTone;
  density?: TreeDensity;
  variant?: TreeVariant;
};

type TreeRowProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> &
  SharedTreeRowProps;

export function TreeRow({
  className,
  label,
  icon,
  count,
  meta,
  trailing,
  active = false,
  selected = false,
  expandable = false,
  expanded = false,
  tone = "default",
  density = "normal",
  variant = "default",
  type = "button",
  ...buttonProps
}: TreeRowProps) {
  const title = buttonProps.title ?? (typeof label === "string" ? label : undefined);
  return (
    <button
      {...buttonProps}
      type={type}
      title={title}
      aria-expanded={expandable ? expanded : buttonProps["aria-expanded"]}
      aria-current={buttonProps["aria-current"] ?? (selected ? "page" : undefined)}
      data-tone={tone}
      data-density={density}
      data-variant={variant}
      className={cx(
        styles.row,
        active && styles.rowActive,
        selected && styles.rowSelected,
        className
      )}
    >
      <span className={styles.chevronSlot} aria-hidden>
        {expandable ? (
          <ChevronRight
            size={15}
            className={cx(styles.chevron, expanded && styles.chevronOpen)}
          />
        ) : null}
      </span>
      <span className={styles.icon} aria-hidden>
        {icon}
      </span>
      <span className={styles.label}>{label}</span>
      {meta != null && <span className={styles.meta}>{meta}</span>}
      {count != null && <span className={styles.count}>{count}</span>}
      {trailing != null && <span className={styles.trailing}>{trailing}</span>}
    </button>
  );
}

type TreeStaticRowProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> &
  SharedTreeRowProps;

export function TreeStaticRow({
  className,
  label,
  icon,
  count,
  meta,
  trailing,
  active = false,
  selected = false,
  expandable = false,
  expanded = false,
  tone = "default",
  density = "normal",
  variant = "default",
  ...props
}: TreeStaticRowProps) {
  const title = props.title ?? (typeof label === "string" ? label : undefined);
  return (
    <div
      {...props}
      title={title}
      data-tone={tone}
      data-density={density}
      data-variant={variant}
      className={cx(
        styles.staticRow,
        active && styles.rowActive,
        selected && styles.rowSelected,
        className
      )}
    >
      <span className={styles.chevronSlot} aria-hidden>
        {expandable ? (
          <ChevronRight
            size={15}
            className={cx(styles.chevron, expanded && styles.chevronOpen)}
          />
        ) : null}
      </span>
      <span className={styles.icon} aria-hidden>
        {icon}
      </span>
      <span className={styles.label}>{label}</span>
      {meta != null && <span className={styles.meta}>{meta}</span>}
      {count != null && <span className={styles.count}>{count}</span>}
      {trailing != null && <span className={styles.trailing}>{trailing}</span>}
    </div>
  );
}
