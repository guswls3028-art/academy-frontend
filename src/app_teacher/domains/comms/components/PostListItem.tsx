// PATH: src/app_teacher/domains/comms/components/PostListItem.tsx
import type { Post } from "../api";

import styles from "./PostListItem.module.css";

interface Props {
  post: Post;
  showReplyBadge?: boolean;
  attention?: boolean;
  onClick: () => void;
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export default function PostListItem({ post, showReplyBadge, attention = false, onClick }: Props) {
  const noReply = showReplyBadge && (post.replies_count ?? 0) === 0;
  const pendingQuestion = attention && noReply && post.post_type === "qna";
  const authorName = post.author_display_name || post.created_by_display || (post.author_role === "staff" ? "선생님" : "학생");

  return (
    <button
      onClick={onClick}
      className={cx(styles.item, pendingQuestion && styles.itemAttention)}
    >
      <div className={styles.inner}>
        <div className={styles.body}>
          <div className={styles.titleRow}>
            {pendingQuestion && (
              <span className={cx(styles.flag, styles.waiting)}>
                새 질문
              </span>
            )}
            {post.is_pinned && (
              <span className={cx(styles.flag, styles.pinned)}>
                고정
              </span>
            )}
            {post.is_urgent && (
              <span className={cx(styles.flag, styles.urgent)}>
                긴급
              </span>
            )}
            <span className={styles.title}>
              {post.title}
            </span>
          </div>
          <div className={styles.meta}>
            {authorName} · {formatDate(post.created_at)}
          </div>
        </div>
        {noReply && (
          <span className={cx(styles.replyBadge, styles.replyPending)}>
            답변 대기
          </span>
        )}
        {showReplyBadge && !noReply && (post.replies_count ?? 0) > 0 && (
          <span className={cx(styles.replyBadge, styles.replyDone)}>
            답변 완료
          </span>
        )}
      </div>
    </button>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "방금 전";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
