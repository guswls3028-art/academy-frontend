/**
 * 영상 댓글 섹션 - 댓글 목록 + 작성 + 대댓글 + 수정/삭제
 */
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  MessageCircle,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";

import { useConfirm } from "@/shared/ui/confirm";
import { cx } from "@/shared/utils/cx";
import { studentToast } from "@student/shared/ui/feedback/studentToast";

import {
  createVideoComment,
  deleteVideoComment,
  editVideoComment,
  fetchVideoComments,
  type VideoCommentItem,
} from "../api/video.api";
import { timeAgo } from "../utils/timeAgo";
import { studentVideoQueryKeys } from "../queryKeys";
import styles from "./VideoCommentSection.module.css";

type CommentAvatarProps = {
  name: string;
  photoUrl?: string | null;
  compact?: boolean;
};

function CommentAvatar({ name, photoUrl, compact = false }: CommentAvatarProps) {
  const initial = (name || "?")[0];

  return (
    <div className={cx(styles.avatar, compact && styles.avatarCompact)}>
      {photoUrl ? (
        <img className={styles.avatarImage} src={photoUrl} alt="" />
      ) : (
        <span className={styles.avatarInitial}>{initial}</span>
      )}
    </div>
  );
}

type CommentActionButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  onClick: () => void;
};

function CommentActionButton({ children, disabled = false, icon, onClick }: CommentActionButtonProps) {
  return (
    <button type="button" className={styles.actionButton} disabled={disabled} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

type CommentRowProps = {
  comment: VideoCommentItem;
  videoId: number;
  isReply?: boolean;
  onReply?: (parentId: number) => void;
};

function CommentRow({ comment, videoId, isReply = false, onReply }: CommentRowProps) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showReplies, setShowReplies] = useState(false);

  const { mutate: saveComment, isPending: isSaving } = useMutation({
    mutationFn: (content: string) => editVideoComment(comment.id, content),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: studentVideoQueryKeys.comments(videoId) });
      setEditMode(false);
      studentToast.success("수정되었습니다.");
    },
    onError: () => {
      studentToast.error("댓글 수정에 실패했습니다.");
    },
  });

  const { mutate: removeComment, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteVideoComment(comment.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: studentVideoQueryKeys.comments(videoId) });
      studentToast.success("삭제되었습니다.");
    },
    onError: () => {
      studentToast.error("댓글 삭제에 실패했습니다.");
    },
  });

  const trimmedEditContent = editContent.trim();
  const canSave = trimmedEditContent.length > 0 && !isSaving;
  const replies = comment.replies ?? [];
  const replyCount = replies.length;
  const isTeacher = comment.author_type === "teacher";

  const handleSave = useCallback(() => {
    if (!canSave) return;
    saveComment(trimmedEditContent);
  }, [canSave, saveComment, trimmedEditContent]);

  const handleCancelEdit = useCallback(() => {
    setEditContent(comment.content);
    setEditMode(false);
  }, [comment.content]);

  const handleDelete = useCallback(async () => {
    if (isDeleting) return;

    const ok = await confirm({
      title: "삭제 확인",
      message: "댓글을 삭제하시겠습니까?",
      danger: true,
      confirmText: "삭제",
    });

    if (ok) removeComment();
  }, [confirm, isDeleting, removeComment]);

  if (comment.is_deleted) {
    return <div className={styles.deletedComment}>삭제된 댓글입니다.</div>;
  }

  return (
    <div className={cx(styles.commentRow, isReply && styles.replyRow)}>
      <CommentAvatar name={comment.author_name} photoUrl={comment.author_photo_url} compact={isReply} />
      <div className={styles.commentBody}>
        <div className={styles.metaRow}>
          <span className={cx(styles.authorName, isTeacher && styles.teacherAuthor)}>
            {comment.author_name}
          </span>
          {isTeacher && <span className={styles.teacherBadge}>선생님</span>}
          <span className={styles.createdAt}>{timeAgo(comment.created_at)}</span>
          {comment.is_edited && <span className={styles.editedLabel}>(수정됨)</span>}
        </div>

        {editMode ? (
          <div className={styles.editRow}>
            <textarea
              className={styles.editInput}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              autoFocus
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSave();
                }
                if (e.key === "Escape") handleCancelEdit();
              }}
            />
            <div className={styles.editActions}>
              <button
                type="button"
                className={cx(styles.editButton, styles.saveButton)}
                onClick={handleSave}
                disabled={!canSave}
              >
                <Check size={14} aria-hidden />
                저장
              </button>
              <button
                type="button"
                className={cx(styles.editButton, styles.cancelButton)}
                onClick={handleCancelEdit}
              >
                <X size={14} aria-hidden />
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.commentContent}>{comment.content}</div>
        )}

        {!editMode && (
          <div className={styles.actionRow}>
            {!isReply && onReply && (
              <CommentActionButton
                icon={<CornerDownRight size={13} aria-hidden />}
                onClick={() => {
                  onReply(comment.id);
                  setShowReplies(true);
                }}
              >
                답글
              </CommentActionButton>
            )}
            {comment.is_mine && (
              <>
                <CommentActionButton
                  icon={<Pencil size={13} aria-hidden />}
                  onClick={() => {
                    setEditContent(comment.content);
                    setEditMode(true);
                  }}
                >
                  수정
                </CommentActionButton>
                <CommentActionButton icon={<Trash2 size={13} aria-hidden />} disabled={isDeleting} onClick={handleDelete}>
                  삭제
                </CommentActionButton>
              </>
            )}
          </div>
        )}

        {!isReply && replyCount > 0 && (
          <div className={styles.replyToggleRow}>
            <button
              type="button"
              className={styles.replyToggle}
              aria-expanded={showReplies}
              onClick={() => setShowReplies((visible) => !visible)}
            >
              {showReplies ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
              {showReplies ? "답글 숨기기" : `답글 ${replyCount}개`}
            </button>
          </div>
        )}

        {showReplies && replies.map((reply) => (
          <CommentRow key={reply.id} comment={reply} videoId={videoId} isReply />
        ))}
      </div>
    </div>
  );
}

type CreateCommentInput = {
  content: string;
  parentId?: number;
};

export default function VideoCommentSection({ videoId }: { videoId: number }) {
  const qc = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: studentVideoQueryKeys.comments(videoId),
    queryFn: () => fetchVideoComments(videoId),
    enabled: videoId > 0,
  });

  const { mutate: createComment, isPending: isCreating } = useMutation({
    mutationFn: ({ content, parentId }: CreateCommentInput) => createVideoComment(videoId, content, parentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: studentVideoQueryKeys.comments(videoId) });
      setNewComment("");
      setReplyTo(null);
    },
    onError: () => {
      studentToast.error("댓글 작성에 실패했습니다.");
    },
  });

  const trimmedNewComment = newComment.trim();
  const canSubmit = trimmedNewComment.length > 0 && !isCreating;
  const comments = data?.comments ?? [];

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    createComment({ content: trimmedNewComment, parentId: replyTo ?? undefined });
  }, [canSubmit, createComment, replyTo, trimmedNewComment]);

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <span className={styles.headerIcon} aria-hidden>
            <MessageCircle size={18} />
          </span>
          <h3 className={styles.title}>댓글</h3>
          <span className={styles.countBadge}>{data?.total ?? 0}</span>
        </div>
      </div>

      <div className={styles.composer}>
        {replyTo && (
          <div className={styles.replyBanner}>
            <CornerDownRight size={14} aria-hidden />
            <span>답글 작성 중</span>
            <button type="button" className={styles.replyCancelButton} onClick={() => setReplyTo(null)} aria-label="답글 작성 취소">
              <X size={14} aria-hidden />
            </button>
          </div>
        )}
        <div className={styles.composerBody}>
          <div className={styles.composerAvatar} aria-hidden>나</div>
          <div className={styles.inputShell}>
            <textarea
              className={styles.textarea}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyTo ? "답글을 입력하세요..." : "댓글을 입력하세요..."}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && canSubmit) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className={styles.composerFooter}>
              <button
                type="button"
                className={cx(styles.submitButton, canSubmit && styles.submitButtonReady)}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                <Send size={14} aria-hidden />
                {isCreating ? "등록 중" : "등록"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading}>불러오는 중...</div>
      ) : comments.length === 0 ? (
        <div className={styles.empty}>
          <MessageCircle className={styles.emptyIcon} size={28} aria-hidden />
          <span>아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</span>
        </div>
      ) : (
        <div className={styles.commentList}>
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              videoId={videoId}
              onReply={(parentId) => setReplyTo(parentId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
