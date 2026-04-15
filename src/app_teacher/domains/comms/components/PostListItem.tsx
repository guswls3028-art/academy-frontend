// PATH: src/app_teacher/domains/comms/components/PostListItem.tsx
import type { Post } from "../api";

interface Props {
  post: Post;
  showReplyBadge?: boolean;
  onClick: () => void;
}

export default function PostListItem({ post, showReplyBadge, onClick }: Props) {
  const noReply = showReplyBadge && (post.replies_count ?? 0) === 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left cursor-pointer"
      style={{
        padding: "var(--tc-space-3) 0",
        borderBottom: "1px solid var(--tc-border-subtle)",
        background: "none",
        border: "none",
        borderBottomWidth: 1,
        borderBottomStyle: "solid",
        borderBottomColor: "var(--tc-border-subtle)",
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {post.is_pinned && (
              <span
                className="text-[10px] font-bold shrink-0 rounded px-1"
                style={{ background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}
              >
                고정
              </span>
            )}
            {post.is_urgent && (
              <span
                className="text-[10px] font-bold shrink-0 rounded px-1"
                style={{ background: "var(--tc-danger-bg)", color: "var(--tc-danger)" }}
              >
                긴급
              </span>
            )}
            <span
              className="text-sm font-semibold truncate"
              style={{ color: "var(--tc-text)" }}
            >
              {post.title}
            </span>
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--tc-text-muted)" }}>
            {post.author_display_name || "관리자"} · {formatDate(post.created_at)}
          </div>
        </div>
        {noReply && (
          <span
            className="shrink-0 text-[10px] font-bold rounded-full px-2"
            style={{
              lineHeight: "20px",
              background: "var(--tc-danger-bg)",
              color: "var(--tc-danger)",
            }}
          >
            답변 대기
          </span>
        )}
        {showReplyBadge && !noReply && (post.replies_count ?? 0) > 0 && (
          <span
            className="shrink-0 text-[10px] font-bold rounded-full px-2"
            style={{
              lineHeight: "20px",
              background: "var(--tc-success-bg)",
              color: "var(--tc-success)",
            }}
          >
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
