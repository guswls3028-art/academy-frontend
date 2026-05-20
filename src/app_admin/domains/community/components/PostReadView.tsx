// PATH: src/app_admin/domains/community/components/PostReadView.tsx
// 읽기 전용 게시물 본문 렌더링 — sanitized HTML
import { useMemo } from "react";
import DOMPurify from "dompurify";

type Props = {
  html: string;
  className?: string;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/**
 * 게시물 본문을 sanitize 후 HTML로 렌더링하는 읽기 전용 컴포넌트.
 * - 에디터 툴바 없음
 * - script, style, on* 이벤트 제거
 * - 읽기 모드에서만 사용
 */
export default function PostReadView({ html, className }: Props) {
  const isPlainText = useMemo(
    () => !!html && !/<[a-z][\s\S]*>/i.test(html),
    [html]
  );

  const safeHtml = useMemo(
    () => (html && !isPlainText ? DOMPurify.sanitize(html) : ""),
    [html, isPlainText]
  );

  if (!html || !html.trim()) {
    return (
      <div className={`text-sm text-[var(--color-text-muted)] ${className ?? ""}`}>
        내용이 없습니다.
      </div>
    );
  }

  if (isPlainText) {
    return (
      <div
        className={cx("post-read-view post-read-view--plain", className)}
      >
        {html}
      </div>
    );
  }

  return (
    <div
      className={cx("cms-detail__rendered-body post-read-view", className)}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
