// PATH: src/features/videos/components/features/video-detail/components/AdminCommentSection.tsx
// Admin-side comment section — teachers can view, reply, edit, delete comments

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminVideoComments,
  createAdminVideoComment,
  editAdminVideoComment,
  deleteAdminVideoComment,
  type VideoCommentItem,
} from "@/features/videos/api/videos";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";

/* ─── Relative time format ─── */
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return "";
  const diff = now - then;
  if (diff < 0) return "방금";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}개월 전`;
  return `${Math.floor(month / 12)}년 전`;
}

/* ─── Avatar ─── */
function CommentAvatar({
  name,
  photoUrl,
  isTeacher,
  size = 36,
}: {
  name: string;
  photoUrl?: string | null;
  isTeacher?: boolean;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: isTeacher
          ? "var(--color-primary)"
          : "var(--color-bg-surface-soft)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `2px solid ${
          isTeacher ? "var(--color-primary)" : "var(--color-border-divider)"
        }`,
      }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span
          style={{
            fontSize: size * 0.4,
            fontWeight: 700,
            color: isTeacher ? "#fff" : "var(--color-text-muted)",
          }}
        >
          {(name || "?")[0]}
        </span>
      )}
    </div>
  );
}

/* ─── Single Comment Row ─── */
function CommentRow({
  comment,
  videoId,
  isReply = false,
  onReply,
}: {
  comment: VideoCommentItem;
  videoId: number;
  isReply?: boolean;
  onReply?: (parentId: number) => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showReplies, setShowReplies] = useState(false);

  const editMut = useMutation({
    mutationFn: () => editAdminVideoComment(comment.id, editContent.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-comments", videoId] });
      qc.invalidateQueries({ queryKey: ["video-engagement", videoId] });
      setEditMode(false);
      feedback.success("댓글이 수정되었습니다.");
    },
    onError: () => feedback.error("댓글 수정에 실패했습니다."),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteAdminVideoComment(comment.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-comments", videoId] });
      qc.invalidateQueries({ queryKey: ["video-engagement", videoId] });
      feedback.success("댓글이 삭제되었습니다.");
    },
    onError: () => feedback.error("댓글 삭제에 실패했습니다."),
  });

  if (comment.is_deleted) {
    return (
      <div
        style={{
          padding: "12px 0",
          fontSize: 13,
          color: "var(--color-text-muted)",
          fontStyle: "italic",
          paddingLeft: isReply ? 48 : 0,
        }}
      >
        삭제된 댓글입니다.
      </div>
    );
  }

  const isTeacher = comment.author_type === "teacher";

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: isReply ? "10px 0 10px 48px" : "16px 0",
        borderBottom: isReply
          ? "none"
          : "1px solid var(--color-border-divider)",
      }}
    >
      <CommentAvatar
        name={comment.author_name}
        photoUrl={comment.author_photo_url}
        isTeacher={isTeacher}
        size={isReply ? 30 : 36}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Author + timestamp */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: isTeacher
                ? "var(--color-primary)"
                : "var(--color-text-primary)",
            }}
          >
            {comment.author_name}
          </span>
          {isTeacher && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 4,
                background: "var(--color-primary)",
                color: "#fff",
                letterSpacing: "0.02em",
              }}
            >
              선생님
            </span>
          )}
          {!isTeacher && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 4,
                background: "var(--color-bg-surface-soft)",
                color: "var(--color-text-muted)",
                border: "1px solid var(--color-border-divider)",
              }}
            >
              학생
            </span>
          )}
          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-muted)",
            }}
          >
            {timeAgo(comment.created_at)}
          </span>
          {comment.is_edited && (
            <span
              style={{
                fontSize: 10,
                color: "var(--color-text-muted)",
                fontStyle: "italic",
              }}
            >
              (수정됨)
            </span>
          )}
        </div>

        {/* Body */}
        {editMode ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <input
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              style={{
                flex: 1,
                background: "var(--color-bg-app)",
                border: "1px solid var(--color-border-divider)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "var(--color-text-primary)",
                fontSize: 13,
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && editContent.trim())
                  editMut.mutate();
                if (e.key === "Escape") setEditMode(false);
              }}
            />
            <button
              type="button"
              onClick={() => editMut.mutate()}
              disabled={!editContent.trim() || editMut.isPending}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: "var(--color-primary)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
              }}
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditMode(false)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "transparent",
                color: "var(--color-text-muted)",
                fontSize: 12,
                border: "1px solid var(--color-border-divider)",
                cursor: "pointer",
              }}
            >
              취소
            </button>
          </div>
        ) : (
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {comment.content}
          </div>
        )}

        {/* Actions */}
        {!editMode && (
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 6,
            }}
          >
            {!isReply && onReply && (
              <ActionBtn
                label="답글"
                onClick={() => {
                  onReply(comment.id);
                  setShowReplies(true);
                }}
              />
            )}
            {comment.is_mine && (
              <>
                <ActionBtn
                  label="수정"
                  onClick={() => {
                    setEditContent(comment.content);
                    setEditMode(true);
                  }}
                />
                <ActionBtn
                  label="삭제"
                  danger
                  onClick={async () => {
                    const ok = await confirm({ title: "삭제 확인", message: "댓글을 삭제하시겠습니까?", danger: true, confirmText: "삭제" });
                    if (!ok) return;
                    deleteMut.mutate();
                  }}
                />
              </>
            )}
          </div>
        )}

        {/* Replies toggle */}
        {!isReply && comment.replies.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setShowReplies(!showReplies)}
              style={{
                fontSize: 12,
                color: "var(--color-primary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                fontWeight: 600,
              }}
            >
              {showReplies
                ? `답글 숨기기 (${comment.replies.length})`
                : `답글 ${comment.replies.length}개 보기`}
            </button>
          </div>
        )}

        {/* Replies list */}
        {showReplies &&
          comment.replies.map((r) => (
            <CommentRow
              key={r.id}
              comment={r}
              videoId={videoId}
              isReply
            />
          ))}
      </div>
    </div>
  );
}

/* ─── Small action button ─── */
function ActionBtn({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 12,
        color: danger
          ? "var(--color-danger)"
          : "var(--color-text-muted)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}

/* ─── Main Section ─── */
export default function AdminCommentSection({
  videoId,
}: {
  videoId: number;
}) {
  const qc = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-video-comments", videoId],
    queryFn: () => fetchAdminVideoComments(videoId),
    enabled: !!videoId,
    retry: 1,
    staleTime: 15_000,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createAdminVideoComment(
        videoId,
        newComment.trim(),
        replyTo ?? undefined
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-comments", videoId] });
      qc.invalidateQueries({ queryKey: ["video-engagement", videoId] });
      setNewComment("");
      setReplyTo(null);
      feedback.success("댓글이 등록되었습니다.");
    },
    onError: () => {
      feedback.error("댓글 작성에 실패했습니다.");
    },
  });

  const handleSubmit = useCallback(() => {
    if (!newComment.trim()) return;
    createMut.mutate();
  }, [newComment, createMut]);

  const comments = data?.comments ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      {/* Header with count */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--color-text-primary)",
            }}
          >
            댓글
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text-muted)",
              background: "var(--color-bg-surface-soft)",
              padding: "2px 10px",
              borderRadius: 12,
            }}
          >
            {total}
          </span>
        </div>
        {replyTo != null && (
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            style={{
              fontSize: 12,
              color: "var(--color-primary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            답글 취소
          </button>
        )}
      </div>

      {/* Reply indicator */}
      {replyTo != null && (
        <div
          style={{
            fontSize: 12,
            color: "var(--color-primary)",
            marginBottom: 8,
            padding: "6px 12px",
            background: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
            borderRadius: 8,
            border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)",
          }}
        >
          댓글에 답글을 작성합니다
        </div>
      )}

      {/* Comment input */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={
            replyTo
              ? "선생님의 답글을 입력하세요..."
              : "학생에게 댓글을 남겨보세요..."
          }
          rows={2}
          style={{
            flex: 1,
            background: "var(--color-bg-app)",
            border: "1px solid var(--color-border-divider)",
            borderRadius: 10,
            padding: "10px 14px",
            color: "var(--color-text-primary)",
            fontSize: 13,
            resize: "vertical",
            minHeight: 44,
            lineHeight: 1.5,
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-primary)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border-divider)";
          }}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              newComment.trim()
            ) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!newComment.trim() || createMut.isPending}
          style={{
            padding: "0 20px",
            borderRadius: 10,
            background: newComment.trim()
              ? "var(--color-primary)"
              : "var(--color-bg-surface-soft)",
            color: newComment.trim()
              ? "#fff"
              : "var(--color-text-muted)",
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            cursor: newComment.trim() ? "pointer" : "default",
            transition: "all 0.2s",
            alignSelf: "flex-end",
            height: 40,
            flexShrink: 0,
          }}
        >
          {createMut.isPending ? "..." : "등록"}
        </button>
      </div>

      {/* Comment list */}
      {isLoading ? (
        <div style={{ padding: "20px 0" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                padding: "16px 0",
                borderBottom: "1px solid var(--color-border-divider)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "var(--color-bg-surface-soft)",
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    width: 120,
                    height: 14,
                    borderRadius: 4,
                    background: "var(--color-bg-surface-soft)",
                    marginBottom: 8,
                  }}
                />
                <div
                  style={{
                    width: "80%",
                    height: 14,
                    borderRadius: 4,
                    background: "var(--color-bg-surface-soft)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div
          style={{
            padding: "32px 0",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 32,
              marginBottom: 8,
              opacity: 0.3,
              color: "var(--color-text-muted)",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ margin: "0 auto" }}
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text-muted)",
            }}
          >
            아직 댓글이 없습니다.
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--color-text-muted)",
              marginTop: 4,
              opacity: 0.7,
            }}
          >
            학생이 영상에 댓글을 남기면 여기에 표시됩니다.
          </div>
        </div>
      ) : (
        <div>
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              videoId={videoId}
              onReply={(parentId) => setReplyTo(parentId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
