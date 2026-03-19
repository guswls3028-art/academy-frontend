// PATH: src/features/community/components/PostReadView.tsx
// 읽기 전용 게시물 본문 렌더링 — sanitized HTML
import DOMPurify from "dompurify";

type Props = {
  html: string;
  className?: string;
};

/**
 * 게시물 본문을 sanitize 후 HTML로 렌더링하는 읽기 전용 컴포넌트.
 * - 에디터 툴바 없음
 * - script, style, on* 이벤트 제거
 * - 읽기 모드에서만 사용
 */
export default function PostReadView({ html, className }: Props) {
  if (!html || !html.trim()) {
    return (
      <div className={`text-sm text-[var(--color-text-muted)] ${className ?? ""}`}>
        내용이 없습니다.
      </div>
    );
  }

  // plain text인지 확인 (HTML 태그 없음)
  const isPlainText = !/<[a-z][\s\S]*>/i.test(html);
  if (isPlainText) {
    return (
      <div
        className={className}
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "var(--color-text-primary)",
        }}
      >
        {html}
      </div>
    );
  }

  return (
    <div
      className={`cms-detail__rendered-body ${className ?? ""}`}
      style={{
        fontSize: 14,
        lineHeight: 1.7,
        wordBreak: "break-word",
        color: "var(--color-text-primary)",
      }}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}
