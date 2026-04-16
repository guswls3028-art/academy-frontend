// PATH: src/app_teacher/domains/comms/components/PostDetail.tsx
// 게시글 상세 + Q&A 답변 + 편집/삭제 기능
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import useAuth from "@/auth/hooks/useAuth";
import { fetchPostReplies, createReply, deleteReply, updatePost, deletePost } from "../api";
import type { Post, Reply } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { ChevronLeft, Pencil, Trash2, MoreVertical, X, Save } from "@teacher/shared/ui/Icons";

interface Props {
  post: Post;
  onBack: () => void;
}

export default function PostDetail({ post: initialPost, onBack }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isQnA = initialPost.post_type === "qna";

  // Editable state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(initialPost.title);
  const [editContent, setEditContent] = useState(initialPost.content);
  const [menuOpen, setMenuOpen] = useState(false);

  // Staff members can edit/delete posts created by staff
  const isStaffPost = initialPost.author_role === "staff";

  const { data: replies, isLoading } = useQuery({
    queryKey: ["post-replies", initialPost.id],
    queryFn: () => fetchPostReplies(initialPost.id),
  });

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");

  const replyMutation = useMutation({
    mutationFn: () => createReply(initialPost.id, replyText),
    onSuccess: () => {
      setReplyText("");
      setReplyOpen(false);
      qc.invalidateQueries({ queryKey: ["post-replies", initialPost.id] });
      qc.invalidateQueries({ queryKey: ["teacher-comms"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => updatePost(initialPost.id, { title: editTitle, content: editContent }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["teacher-comms"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(initialPost.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-comms"] });
      onBack();
    },
  });

  const deleteReplyMutation = useMutation({
    mutationFn: (replyId: number) => deleteReply(initialPost.id, replyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", initialPost.id] });
      qc.invalidateQueries({ queryKey: ["teacher-comms"] });
    },
  });

  const handleDelete = () => {
    if (confirm("이 글을 삭제하시겠습니까?")) {
      deleteMutation.mutate();
    }
    setMenuOpen(false);
  };

  const postTypeLabel = (() => {
    switch (initialPost.post_type) {
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
        <button onClick={onBack} className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-base font-bold truncate flex-1" style={{ color: "var(--tc-text)" }}>
          {postTypeLabel}
        </h1>

        {/* Actions menu for staff posts */}
        {isStaffPost && !editing && (
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex p-1 cursor-pointer"
              style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 rounded-lg shadow-lg"
                  style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", zIndex: 100, minWidth: 120 }}>
                  <button onClick={() => { setEditing(true); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                    style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-text)" }}>
                    <Pencil size={14} /> 편집
                  </button>
                  <button onClick={handleDelete}
                    className="flex items-center gap-2 w-full text-left text-sm cursor-pointer"
                    style={{ padding: "10px 14px", background: "none", border: "none", color: "var(--tc-danger)", borderTop: "1px solid var(--tc-border-subtle)" }}>
                    <Trash2 size={14} /> 삭제
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
              className="w-full text-[15px] font-bold"
              style={{ padding: "6px 8px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={6}
              className="w-full text-sm"
              style={{ padding: "6px 8px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none", resize: "vertical" }} />
            <div className="flex gap-2">
              <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}
                className="flex items-center gap-1 text-xs font-bold cursor-pointer"
                style={{ padding: "7px 14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
                <Save size={13} /> 저장
              </button>
              <button onClick={() => { setEditing(false); setEditTitle(initialPost.title); setEditContent(initialPost.content); }}
                className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
                style={{ padding: "7px 14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-surface-soft)", color: "var(--tc-text-secondary)" }}>
                <X size={13} /> 취소
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 mb-2">
              {initialPost.is_urgent && (
                <span className="text-[10px] font-bold shrink-0 rounded px-1"
                  style={{ background: "var(--tc-danger-bg)", color: "var(--tc-danger)" }}>긴급</span>
              )}
              <h2 className="text-[15px] font-bold" style={{ color: "var(--tc-text)" }}>{editTitle || initialPost.title}</h2>
            </div>
            <div className="text-xs mb-3" style={{ color: "var(--tc-text-muted)" }}>
              {initialPost.author_display_name || "학생"} · {new Date(initialPost.created_at).toLocaleDateString("ko-KR")}
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--tc-text-secondary)" }}>
              {editContent || initialPost.content}
            </div>
          </>
        )}
      </div>

      {/* Replies */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>
            {isQnA ? "답변" : "댓글"} {replies?.length ?? 0}건
          </span>
          <button onClick={() => setReplyOpen(true)} className="text-xs font-bold cursor-pointer"
            style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", background: "var(--tc-primary)", color: "#fff", border: "none" }}>
            {isQnA ? "답변 작성" : "댓글 작성"}
          </button>
        </div>

        {isLoading ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : replies && replies.length > 0 ? (
          replies.map((r) => (
            <ReplyCard key={r.id} reply={r} onDelete={
              r.author_role === "staff" ? () => {
                if (confirm("이 댓글을 삭제하시겠습니까?")) deleteReplyMutation.mutate(r.id);
              } : undefined
            } />
          ))
        ) : (
          <div className="text-sm text-center rounded-lg"
            style={{ padding: "var(--tc-space-4)", color: "var(--tc-text-muted)", background: "var(--tc-surface-soft)" }}>
            {isQnA ? "아직 답변이 없습니다" : "댓글이 없습니다"}
          </div>
        )}
      </div>

      {/* Reply BottomSheet */}
      <BottomSheet open={replyOpen} onClose={() => setReplyOpen(false)} title={isQnA ? "답변 작성" : "댓글 작성"}>
        <div className="flex flex-col gap-3">
          <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
            placeholder={isQnA ? "답변을 입력하세요…" : "댓글을 입력하세요…"} rows={5}
            className="w-full text-sm"
            style={{ padding: "var(--tc-space-3)", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", resize: "vertical", outline: "none" }} />
          <div className="flex gap-2">
            <button onClick={() => setReplyOpen(false)} className="flex-1 text-sm font-semibold cursor-pointer"
              style={{ padding: "10px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>취소</button>
            <button onClick={() => replyMutation.mutate()} disabled={!replyText.trim() || replyMutation.isPending}
              className="flex-1 text-sm font-bold cursor-pointer"
              style={{ padding: "10px", borderRadius: "var(--tc-radius)", border: "none", background: replyText.trim() ? "var(--tc-primary)" : "var(--tc-border)", color: "#fff", opacity: replyMutation.isPending ? 0.6 : 1 }}>
              {replyMutation.isPending ? "등록 중…" : "등록"}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function ReplyCard({ reply, onDelete }: { reply: Reply; onDelete?: () => void }) {
  return (
    <div className="rounded-lg" style={{ padding: "var(--tc-space-3)", background: "var(--tc-surface)", border: "1px solid var(--tc-border-subtle)" }}>
      <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--tc-text)" }}>{reply.content}</div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs" style={{ color: "var(--tc-text-muted)" }}>
          {reply.author_display_name || (reply.author_role === "staff" ? "선생님" : "학생")} · {new Date(reply.created_at).toLocaleDateString("ko-KR")}
        </span>
        {onDelete && (
          <button onClick={onDelete} className="flex items-center gap-0.5 text-[11px] cursor-pointer"
            style={{ background: "none", border: "none", color: "var(--tc-danger)", padding: "2px 4px" }}>
            <Trash2 size={11} /> 삭제
          </button>
        )}
      </div>
    </div>
  );
}
