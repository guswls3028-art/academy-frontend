// PATH: src/app_admin/domains/videos/components/features/video-detail/components/AdminCommentSection.tsx
// Admin-side comment section — teachers can view, reply, edit, delete comments

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminVideoComments,
  createAdminVideoComment,
  editAdminVideoComment,
  deleteAdminVideoComment,
  type VideoCommentItem,
} from "@admin/domains/videos/api/videos.api";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import styles from "./AdminCommentSection.module.css";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

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
  compact = false,
}: {
  name: string;
  photoUrl?: string | null;
  isTeacher?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        styles.avatar,
        compact && styles.avatarCompact,
        isTeacher ? styles.avatarTeacher : styles.avatarStudent
      )}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" className={styles.avatarImage} />
      ) : (
        <span className={styles.avatarInitial}>{(name || "?")[0]}</span>
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
        className={cx(
          styles.deletedComment,
          isReply && styles.deletedCommentReply
        )}
      >
        삭제된 댓글입니다.
      </div>
    );
  }

  const isTeacher = comment.author_type === "teacher";
  const canSaveEdit = editContent.trim().length > 0 && !editMut.isPending;

  return (
    <div className={cx(styles.commentRow, isReply && styles.commentRowReply)}>
      <CommentAvatar
        name={comment.author_name}
        photoUrl={comment.author_photo_url}
        isTeacher={isTeacher}
        compact={isReply}
      />
      <div className={styles.commentBody}>
        {/* Author + timestamp */}
        <div className={styles.metaRow}>
          <span
            className={cx(
              styles.authorName,
              isTeacher && styles.authorTeacher
            )}
          >
            {comment.author_name}
          </span>
          <span
            className={cx(
              styles.roleBadge,
              isTeacher ? styles.roleTeacher : styles.roleStudent
            )}
          >
            {isTeacher ? "선생님" : "학생"}
          </span>
          <span className={styles.timestamp}>{timeAgo(comment.created_at)}</span>
          {comment.is_edited && (
            <span className={styles.editedLabel}>(수정됨)</span>
          )}
        </div>

        {/* Body */}
        {editMode ? (
          <div className={styles.editForm}>
            <input
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className={styles.editInput}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSaveEdit) editMut.mutate();
                if (e.key === "Escape") setEditMode(false);
              }}
            />
            <button
              type="button"
              onClick={() => editMut.mutate()}
              disabled={!canSaveEdit}
              className={styles.primaryButton}
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className={styles.secondaryButton}
            >
              취소
            </button>
          </div>
        ) : (
          <div className={styles.commentContent}>{comment.content}</div>
        )}

        {/* Actions */}
        {!editMode && (
          <div className={styles.actions}>
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
                    const ok = await confirm({
                      title: "삭제 확인",
                      message: "댓글을 삭제하시겠습니까?",
                      danger: true,
                      confirmText: "삭제",
                    });
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
          <div className={styles.repliesToggleWrap}>
            <button
              type="button"
              onClick={() => setShowReplies(!showReplies)}
              className={styles.repliesToggle}
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
      className={cx(styles.actionButton, danger && styles.actionDanger)}
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

  const canSubmit = newComment.trim().length > 0 && !createMut.isPending;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    createMut.mutate();
  }, [canSubmit, createMut]);

  const comments = data?.comments ?? [];
  const total = data?.total ?? 0;

  return (
    <div className={styles.root}>
      {/* Header with count */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.title}>댓글</span>
          <span className={styles.count}>{total}</span>
        </div>
        {replyTo != null && (
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className={styles.cancelReplyButton}
          >
            답글 취소
          </button>
        )}
      </div>

      {/* Reply indicator */}
      {replyTo != null && (
        <div className={styles.replyIndicator}>댓글에 답글을 작성합니다</div>
      )}

      {/* Comment input */}
      <div className={styles.composer}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={
            replyTo
              ? "선생님의 답글을 입력하세요..."
              : "학생에게 댓글을 남겨보세요..."
          }
          rows={2}
          className={styles.composerInput}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && canSubmit) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={styles.submitButton}
        >
          {createMut.isPending ? "..." : "등록"}
        </button>
      </div>

      {/* Comment list */}
      {isLoading ? (
        <div className={styles.loadingList}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonRow}>
              <div className={styles.skeletonAvatar} />
              <div className={styles.skeletonBody}>
                <div className={styles.skeletonTitle} />
                <div className={styles.skeletonText} />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={styles.emptyIconSvg}
              aria-hidden
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className={styles.emptyTitle}>아직 댓글이 없습니다.</div>
          <div className={styles.emptyHint}>
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
