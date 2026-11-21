/**
 * 영상 댓글 섹션 - 댓글 목록 + 작성 + 대댓글 + 수정/삭제
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialogSurface } from "@/shared/ui/overlays/useDialogSurface";
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
import { useAuthContext } from "@/auth/context/AuthContext";
import { cx } from "@/shared/utils/cx";
import { richHtmlToPlainText } from "@/shared/utils/richHtml";
import { studentToast } from "@student/shared/ui/feedback/studentToast";

import {
  createVideoComment,
  deleteVideoComment,
  editVideoComment,
  fetchVideoComments,
  type VideoCommentItem,
} from "../api/video.api";
import { timeAgo } from "../utils/timeAgo";
import { studentVideoQueryKeys, studentVideoQueryScope } from "../queryKeys";
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
  queryScope: string;
  isReply?: boolean;
  onReply?: (parentId: number) => void;
};

function CommentRow({ comment, videoId, queryScope, isReply = false, onReply }: CommentRowProps) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showReplies, setShowReplies] = useState(false);

  const { mutate: saveComment, isPending: isSaving } = useMutation({
    mutationFn: (content: string) => editVideoComment(comment.id, content),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: studentVideoQueryKeys.comments(queryScope, videoId) });
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
      void qc.invalidateQueries({ queryKey: studentVideoQueryKeys.comments(queryScope, videoId) });
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

  const replyThread = (
    <>
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
          <CommentRow key={reply.id} comment={reply} videoId={videoId} queryScope={queryScope} isReply />
        ))}
    </>
  );

  if (comment.is_deleted) {
    return (
      <div className={cx(styles.commentRow, isReply && styles.replyRow)}>
        <div className={styles.commentBody}>
          <div className={styles.deletedComment}>삭제된 댓글입니다.</div>
          {replyThread}
        </div>
      </div>
    );
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
          <div className={styles.commentContent}>{richHtmlToPlainText(comment.content)}</div>
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

        {replyThread}
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
  const { user } = useAuthContext();
  const queryScope = studentVideoQueryScope(user);
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useDialogSurface(open, dialog, () => setOpen(false), close);
  useEffect(() => {
    const timer = setTimeout(() => setPreviewReady(true), 2000);
    return () => clearTimeout(timer);
  }, []);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: studentVideoQueryKeys.comments(queryScope, videoId),
    queryFn: () => fetchVideoComments(videoId),
    enabled: videoId > 0 && (previewReady || visited),
    retry: 1,
  });

  const { mutate: createComment, isPending: isCreating } = useMutation({
    mutationFn: ({ content, parentId }: CreateCommentInput) => createVideoComment(videoId, content, parentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: studentVideoQueryKeys.comments(queryScope, videoId) });
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

  const sample = comments.find(comment => !comment.is_deleted);
  const preview = isError ? "댓글을 불러오지 못했습니다." : !data ? "댓글 불러오는 중…" :
    sample ? richHtmlToPlainText(sample.content) : data.total ? "답글 보기" : "첫 댓글을 남겨보세요.";
  return <>
    <button type="button" ref={trigger} className={styles.preview} aria-label="댓글 보기"
      aria-haspopup="dialog" aria-expanded={open} aria-controls={visited ? "video-comments" : undefined}
      onClick={() => { setVisited(true); setOpen(true); }}>
      <span className={styles.previewHeading}><MessageCircle size={17} aria-hidden />댓글{data && !isError ? " " + data.total : ""}</span>
      <span className={styles.previewText}>{open ? "" : preview}</span>
      <ChevronUp size={18} aria-hidden />
    </button>
    {visited && createPortal(<div className={styles.overlay} hidden={!open} onClick={event => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
    <div className={styles.section} ref={dialog} id="video-comments" role="dialog" aria-modal="true"
      aria-labelledby="video-comments-heading" tabIndex={-1}>

      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <span className={styles.headerIcon} aria-hidden>
            <MessageCircle size={18} />
          </span>
          <h2 id="video-comments-heading" className={styles.title}>댓글</h2>
          {data && <span className={styles.countBadge}>{data.total}</span>}
        </div>
        <button type="button" ref={close} className={styles.close} aria-label="댓글 닫기" onClick={() => setOpen(false)}>
          <X size={20} aria-hidden />
        </button>
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

      {isError && (
        <div className={styles.queryError} role="alert">
          <span>댓글을 불러오지 못했습니다.</span>
          <button type="button" className={styles.replyToggle} aria-label="댓글 다시 불러오기"
            disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? "불러오는 중…" : "다시 시도"}
          </button>
        </div>
      )}
      {isLoading ? (
        <div className={styles.loading}>불러오는 중...</div>
      ) : !isError && comments.length === 0 ? (
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
              queryScope={queryScope}
              onReply={(parentId) => setReplyTo(parentId)}
            />
          ))}
        </div>
      )}
    </div></div>, trigger.current?.closest('[data-app="student"]') ?? document.body)}
  </>;
}
