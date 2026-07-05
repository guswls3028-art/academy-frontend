// PATH: src/app_admin/domains/community/components/PostReadView.tsx
// 읽기 전용 게시물 본문 렌더링 — shared sanitized HTML contract
import RichHtmlContent from "@/shared/ui/content/RichHtmlContent";
import { cx } from "@/shared/utils/cx";

type Props = {
  html: string;
  className?: string;
};

export default function PostReadView({ html, className }: Props) {
  return (
    <RichHtmlContent
      html={html}
      className={cx("post-read-view", className)}
      htmlClassName="cms-detail__rendered-body"
      plainClassName="post-read-view--plain"
      emptyClassName="text-sm text-[var(--color-text-muted)]"
    />
  );
}
