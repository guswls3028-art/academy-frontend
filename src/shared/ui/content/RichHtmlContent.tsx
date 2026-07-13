import { type CSSProperties, useMemo } from "react";
import DOMPurify from "dompurify";
import { cx } from "@/shared/utils/cx";
import { isRichHtml, normalizeRichHtmlInput } from "@/shared/utils/richHtml";
import styles from "./RichHtmlContent.module.css";

type Props = {
  html: string | null | undefined;
  className?: string;
  htmlClassName?: string;
  plainClassName?: string;
  emptyClassName?: string;
  emptyText?: string;
  style?: CSSProperties;
};

export default function RichHtmlContent({
  html,
  className,
  htmlClassName,
  plainClassName,
  emptyClassName,
  emptyText = "내용이 없습니다.",
  style,
}: Props) {
  const content = normalizeRichHtmlInput(html);
  const hasContent = content.trim().length > 0;
  const shouldRenderHtml = hasContent && isRichHtml(content);
  const safeHtml = useMemo(
    () => (shouldRenderHtml ? DOMPurify.sanitize(content) : ""),
    [content, shouldRenderHtml]
  );

  if (!hasContent) {
    return <div className={cx(styles.empty, className, emptyClassName)} style={style}>{emptyText}</div>;
  }

  if (!shouldRenderHtml) {
    return (
      <div className={cx(styles.root, styles.plain, className, plainClassName)} style={style}>
        {content}
      </div>
    );
  }

  return (
    <div
      className={cx(styles.root, className, htmlClassName)}
      style={style}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
