/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */
// PATH: src/app_teacher/domains/comms/components/PostDetail.tsx
// 게시글 상세 + Q&A 답변 + 편집/삭제 기능
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { fetchPostReplies, createReply, deleteReply, updatePost, deletePost, togglePostPin, fetchPostAttachmentDownload } from "../api";
import type { Post, Reply, PostAttachment } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import RichHtmlContent from "@/shared/ui/content/RichHtmlContent";
import { ChevronLeft, Pencil, Trash2, MoreVertical, X, Save, Star, AlertCircle, Paperclip, Download } from "@teacher/shared/ui/Icons";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";

interface Props {
  post: Post;
  onBack: () => void;
}

export default function PostDetail({ post: initialPost, onBack }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [post, setPost] = useState(initialPost);
  const isAnswerPost = post.post_type === "qna" || post.post_type === "counsel";
  const canReply = post.post_type !== "materials";
  const authorName = getAuthorName(post);

  // Editable state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(initialPost.title);
  const [editContent, setEditContent] = useState(initialPost.content);
  const [menuOpen, setMenuOpen] = useState(false);

  // Staff members can edit/delete posts created by staff
  const isStaffPost = post.author_role === "staff";

  const { data: replies, isLoading } = useQuery({
    queryKey: ["post-replies", post.id],
    queryFn: () => fetchPostReplies(post.id),
  });

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<number | null>(null);

  const replyMutation = useMutation({
    mutationFn: () => createReply(post.id, replyText),
    onSuccess: () => {
      setReplyText("");
      setReplyOpen(false);
      qc.invalidateQueries({ queryKey: ["post-replies", post.id] });
      qc.invalidateQueries({ queryKey: ["teacher-comms"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
      teacherToast.success(isAnswerPost ? "답변이 등록되었습니다." : "댓글이 등록되었습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, isAnswerPost ? "답변을 등록하지 못했습니다." : "댓글을 등록하지 못했습니다.")),
  });
  const canSubmitReply = replyText.trim().length > 0 && !replyMutation.isPending;

  const updateMutation = useMutation({
    mutationFn: () => updatePost(post.id, { title: editTitle, content: editContent }),
    onSuccess: (updated) => {
      setPost(updated);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["teacher-comms"] });
      teacherToast.success("게시글이 수정되었습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "게시글을 수정하지 못했습니다.")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-comms"] });
      teacherToast.info("게시글이 삭제되었습니다.");
      onBack();
    },
    onError: (e) => teacherToast.error(extractApiError(e, "게시글을 삭제하지 못했습니다.")),
  });

  const deleteReplyMutation = useMutation({
    mutationFn: (replyId: number) => deleteReply(post.id, replyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", post.id] });
      qc.invalidateQueries({ queryKey: ["teacher-comms"] });
      teacherToast.info("댓글이 삭제되었습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "댓글을 삭제하지 못했습니다.")),
  });

  const pinMutation = useMutation({
    mutationFn: () => togglePostPin(post.id, !post.is_pinned),
    onSuccess: (updated) => {
      setPost(updated);
      qc.invalidateQueries({ queryKey: ["teacher-comms"] });
      teacherToast.success(updated.is_pinned ? "공지가 고정되었습니다." : "고정이 해제되었습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "고정 상태를 변경하지 못했습니다.")),
  });

  const urgentMutation = useMutation({
    mutationFn: () => updatePost(post.id, { is_urgent: !post.is_urgent } as any),
    onSuccess: (updated) => {
      setPost(updated);
      qc.invalidateQueries({ queryKey: ["teacher-comms"] });
      teacherToast.success(updated.is_urgent ? "긴급 공지로 설정되었습니다." : "긴급 설정이 해제되었습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "긴급 설정을 변경하지 못했습니다.")),
  });

  const handleDelete = async () => {
    setMenuOpen(false);
    const ok = await confirm({ title: "글 삭제", message: "이 글을 삭제하시겠습니까?", confirmText: "삭제", danger: true });
    if (ok) deleteMutation.mutate();
  };

  const handleDownloadAttachment = async (attachment: PostAttachment) => {
    setDownloadingAttachmentId(attachment.id);
    try {
      const data = await fetchPostAttachmentDownload(post.id, attachment.id);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      teacherToast.error(extractApiError(e, "첨부파일을 열지 못했습니다."));
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const postTypeLabel = (() => {
    switch (post.post_type) {
      case "notice": return "공지사항";
      case "board": return "게시판";
      case "materials": return "자료";
      case "qna": return "Q&A";
      case "counsel": return "상담";
      default: return "게시글";
    }
  })();

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={onBack} className="flex p-1 cursor-pointer" aria-label="목록으로 돌아가기" title="목록으로 돌아가기" style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={ICON.lg} />
        </button>
        <h1 className="text-base font-bold truncate flex-1" style={{ color: "var(--tc-text)" }}>
          {postTypeLabel}
        </h1>

        {/* Actions menu for staff posts */}
        {isStaffPost && !editing && (
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex p-1 cursor-pointer" aria-label="게시글 작업 메뉴" title="게시글 작업 메뉴"
              style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
              <MoreVertical size={ICON.md} />
            </button>
            {menuOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 rounded-lg shadow-lg"
                  style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", zIndex: 100, minWidth: 120 }}>
                  <button onClick={() => { setEditing(true); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                    style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-text)" }}>
                    <Pencil size={ICON.xs} /> 편집
                  </button>
                  <button onClick={() => { pinMutation.mutate(); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                    style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-text)", borderTop: "1px solid var(--tc-border-subtle)" }}>
                    <Star size={ICON.xs} /> {post.is_pinned ? "고정 해제" : "고정"}
                  </button>
                  <button onClick={() => { urgentMutation.mutate(); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                    style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-danger)", borderTop: "1px solid var(--tc-border-subtle)" }}>
                    <AlertCircle size={ICON.xs} /> {post.is_urgent ? "긴급 해제" : "긴급 설정"}
                  </button>
                  <button onClick={handleDelete}
                    className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                    style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-danger)", borderTop: "1px solid var(--tc-border-subtle)" }}>
                    <Trash2 size={ICON.xs} /> 삭제
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Post content */}
      <div className="rounded-xl" style={{ padding: "var(--tc-space-4)", background: "var(--tc-surface)", border: "1px solid var(--tc-border-subtle)" }}>
        {editing ? (
          <div className="flex flex-col gap-2">
            <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
              className="w-full ds-text-name font-bold"
              style={{ padding: "6px 8px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={6}
              className="w-full text-sm"
              style={{ padding: "6px 8px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none", resize: "vertical" }} />
            <div className="flex gap-2">
              <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}
                className="flex items-center gap-1 text-xs font-bold cursor-pointer"
                style={{ padding: "7px 14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
                <Save size={ICON.sm} /> 저장
              </button>
              <button onClick={() => { setEditing(false); setEditTitle(post.title); setEditContent(post.content); }}
                className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
                style={{ padding: "7px 14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-surface-soft)", color: "var(--tc-text-secondary)" }}>
                <X size={ICON.sm} /> 취소
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 mb-2">
              {post.is_urgent && (
                <span className="text-[10px] font-bold shrink-0 rounded px-1"
                  style={{ background: "var(--tc-danger-bg)", color: "var(--tc-danger)" }}>긴급</span>
              )}
              <h2 className="ds-text-name font-bold" style={{ color: "var(--tc-text)" }}>{editTitle || post.title}</h2>
            </div>
            <div className="text-xs mb-3" style={{ color: "var(--tc-text-muted)" }}>
              {authorName} · {new Date(post.created_at).toLocaleDateString("ko-KR")}
            </div>
            <RichHtmlContent
              html={post.content}
              className="text-sm"
              style={{ color: "var(--tc-text-secondary)" }}
            />
          </>
        )}
      </div>

      {post.attachments && post.attachments.length > 0 && (
        <div
          className="rounded-xl"
          style={{
            padding: "var(--tc-space-3)",
            background: "var(--tc-surface)",
            border: "1px solid var(--tc-border-subtle)",
          }}
        >
          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold" style={{ color: "var(--tc-text)" }}>
            <Paperclip size={ICON.sm} />
            첨부파일 {post.attachments.length}개
          </div>
          <div className="flex flex-col gap-1.5">
            {post.attachments.map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                onClick={() => void handleDownloadAttachment(attachment)}
                disabled={downloadingAttachmentId === attachment.id}
                aria-label={`${attachment.original_name} 다운로드`}
                title={`${attachment.original_name} 다운로드`}
                className="flex items-center gap-2 text-left cursor-pointer"
                style={{
                  width: "100%",
                  minHeight: 40,
                  padding: "8px 10px",
                  borderRadius: "var(--tc-radius-sm)",
                  border: "1px solid var(--tc-border)",
                  background: "var(--tc-surface-soft)",
                  color: "var(--tc-text)",
                }}
              >
                <Download size={ICON.sm} style={{ color: "var(--tc-primary)", flex: "0 0 auto" }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-semibold truncate">{attachment.original_name}</span>
                  <span className="block text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                    {formatBytes(attachment.size_bytes)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Replies */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>
            {isAnswerPost ? "답변" : "댓글"} {replies?.length ?? 0}건
          </span>
          {canReply && (
            <button onClick={() => setReplyOpen(true)} className="text-xs font-bold cursor-pointer"
              style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", background: "var(--tc-primary)", color: "#fff", border: "none" }}>
              {isAnswerPost ? "답변 작성" : "댓글 작성"}
            </button>
          )}
        </div>

        {!canReply ? (
          <div className="text-sm text-center rounded-lg"
            style={{ padding: "var(--tc-space-4)", color: "var(--tc-text-muted)", background: "var(--tc-surface-soft)" }}>
            자료 게시글은 댓글을 사용하지 않습니다
          </div>
        ) : isLoading ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : replies && replies.length > 0 ? (
          replies.map((r) => (
            <ReplyCard key={r.id} reply={r} onDelete={
              r.author_role === "staff" ? async () => {
                const ok = await confirm({ title: "댓글 삭제", message: "이 댓글을 삭제하시겠습니까?", confirmText: "삭제", danger: true });
                if (ok) deleteReplyMutation.mutate(r.id);
              } : undefined
            } />
          ))
        ) : (
          <div className="text-sm text-center rounded-lg"
            style={{ padding: "var(--tc-space-4)", color: "var(--tc-text-muted)", background: "var(--tc-surface-soft)" }}>
            {isAnswerPost ? "아직 답변이 없습니다" : "댓글이 없습니다"}
          </div>
        )}
      </div>

      {/* Reply BottomSheet */}
      <BottomSheet
        open={canReply && replyOpen}
        onClose={() => setReplyOpen(false)}
        title={isAnswerPost ? "답변 작성" : "댓글 작성"}
        footer={(
          <div className="flex gap-2">
            <button type="button" onClick={() => setReplyOpen(false)} className="flex-1 text-sm font-semibold cursor-pointer"
              style={{ padding: "10px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>취소</button>
            <button type="button" onClick={() => replyMutation.mutate()} disabled={!canSubmitReply}
              className="flex-1 text-sm font-bold cursor-pointer"
              style={{ padding: "10px", borderRadius: "var(--tc-radius)", border: "none", background: canSubmitReply ? "var(--tc-primary)" : "var(--tc-border)", color: "#fff", opacity: replyMutation.isPending ? 0.6 : 1 }}>
              {replyMutation.isPending ? "등록 중…" : "등록"}
            </button>
          </div>
        )}
      >
        <div className="flex flex-col gap-3">
          <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
            placeholder={isAnswerPost ? "답변을 입력하세요…" : "댓글을 입력하세요…"} rows={5}
            className="w-full text-sm"
            style={{ padding: "var(--tc-space-3)", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", resize: "vertical", outline: "none" }} />
        </div>
      </BottomSheet>
    </div>
  );
}

function ReplyCard({ reply, onDelete }: { reply: Reply; onDelete?: () => void }) {
  const authorName = reply.author_display_name || reply.created_by_display || (reply.author_role === "staff" ? "선생님" : "학생");

  return (
    <div className="rounded-lg" style={{ padding: "var(--tc-space-3)", background: "var(--tc-surface)", border: "1px solid var(--tc-border-subtle)" }}>
      <RichHtmlContent html={reply.content} className="text-sm" style={{ color: "var(--tc-text)" }} />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs" style={{ color: "var(--tc-text-muted)" }}>
          {authorName} · {new Date(reply.created_at).toLocaleDateString("ko-KR")}
        </span>
        {onDelete && (
          <button onClick={onDelete} className="flex items-center gap-0.5 text-[11px] cursor-pointer"
            style={{ background: "none", border: "none", color: "var(--tc-danger)", padding: "2px 4px" }}>
            <Trash2 size={ICON.xs} /> 삭제
          </button>
        )}
      </div>
    </div>
  );
}

function getAuthorName(post: Post): string {
  return post.author_display_name || post.created_by_display || (post.author_role === "staff" ? "선생님" : "학생");
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "크기 정보 없음";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
