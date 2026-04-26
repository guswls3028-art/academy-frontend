// PATH: src/app_teacher/domains/counseling/pages/CounselingPage.tsx
// 상담 메모 — 목록 + 작성 + 상세
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import {
  fetchCounselingPosts,
  createCounselingPost,
  fetchCounselingReplies,
  createCounselingReply,
  deleteCounselingPost,
} from "../api";
import { teacherToast } from "@teacher/shared/ui/teacherToast";

interface CounselingPost {
  id: number;
  title: string;
  content?: string;
  created_at?: string;
  created_by_name?: string;
  created_by_display?: string;
}

interface CounselingReply {
  id: number;
  content: string;
  created_at?: string;
  created_by_name?: string;
  created_by_display?: string;
}

export default function CounselingPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CounselingPost | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-counseling"],
    queryFn: () => fetchCounselingPosts(),
    staleTime: 60_000,
  });

  const posts = data?.results ?? [];

  const createMut = useMutation({
    mutationFn: createCounselingPost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-counseling"] });
      teacherToast.success("상담 메모가 저장되었습니다.");
      setShowCreate(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteCounselingPost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-counseling"] });
      teacherToast.info("상담 메모가 삭제되었습니다.");
      setSelectedPost(null);
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center py-1">
        <h2 className="text-base font-bold" style={{ color: "var(--tc-text)" }}>상담 메모</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
          style={{ background: "var(--tc-primary)", color: "#fff", border: "none" }}
        >
          + 새 메모
        </button>
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : posts.length > 0 ? (
        <div className="flex flex-col gap-2">
          {(posts as CounselingPost[]).map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPost(p)}
              className="flex flex-col gap-1.5 rounded-xl w-full text-left cursor-pointer"
              style={{
                padding: "var(--tc-space-4)",
                background: "var(--tc-surface)",
                border: "1px solid var(--tc-border)",
              }}
            >
              <div className="flex justify-between items-start gap-2">
                <span className="text-[15px] font-semibold flex-1" style={{ color: "var(--tc-text)" }}>
                  {p.title}
                </span>
                <span className="text-[11px] shrink-0" style={{ color: "var(--tc-text-muted)" }}>
                  {p.created_at ? new Date(p.created_at).toLocaleDateString("ko-KR") : ""}
                </span>
              </div>
              {p.content && (
                <p
                  className="text-sm line-clamp-2 m-0"
                  style={{ color: "var(--tc-text-secondary)" }}
                >
                  {p.content.replace(/<[^>]*>/g, "").slice(0, 100)}
                </p>
              )}
              {p.created_by_name && (
                <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                  {p.created_by_name}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="상담 기록이 없습니다" />
      )}

      {/* Create sheet */}
      <CreateSheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(title, content) => createMut.mutate({ title, content })}
        isPending={createMut.isPending}
      />

      {/* Detail sheet */}
      {selectedPost && (
        <DetailSheet
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onDelete={() => deleteMut.mutate(selectedPost.id)}
        />
      )}
    </div>
  );
}

function CreateSheet({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (title: string, content: string) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit(title.trim(), content.trim());
    setTitle("");
    setContent("");
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="새 상담 메모">
      <div className="flex flex-col gap-3 p-4">
        <input
          type="text"
          placeholder="제목 (학생 이름 등)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-sm rounded-lg w-full"
          style={{
            padding: "10px 12px",
            border: "1px solid var(--tc-border)",
            background: "var(--tc-surface)",
            color: "var(--tc-text)",
            outline: "none",
          }}
        />
        <textarea
          placeholder="상담 내용... (선택)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="text-sm rounded-lg w-full resize-y"
          style={{
            padding: "10px 12px",
            border: "1px solid var(--tc-border)",
            background: "var(--tc-surface)",
            color: "var(--tc-text)",
            outline: "none",
            minHeight: 100,
            maxHeight: 320,
          }}
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 text-sm font-semibold py-2.5 rounded-lg cursor-pointer"
            style={{ border: "1px solid var(--tc-border)", background: "transparent", color: "var(--tc-text-secondary)" }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || isPending}
            className="flex-1 text-sm font-semibold py-2.5 rounded-lg cursor-pointer"
            style={{
              border: "none",
              background: title.trim() ? "var(--tc-primary)" : "var(--tc-border)",
              color: title.trim() ? "#fff" : "var(--tc-text-muted)",
            }}
          >
            {isPending ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function DetailSheet({
  post,
  onClose,
  onDelete,
}: {
  post: CounselingPost;
  onClose: () => void;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [replyText, setReplyText] = useState("");

  const { data: replies } = useQuery({
    queryKey: ["teacher-counseling-replies", post.id],
    queryFn: () => fetchCounselingReplies(post.id),
  });

  const replyMut = useMutation({
    mutationFn: (content: string) => createCounselingReply(post.id, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-counseling-replies", post.id] });
      teacherToast.success("답글이 등록되었습니다.");
      setReplyText("");
    },
  });

  return (
    <BottomSheet open onClose={onClose} title={post.title}>
      <div className="flex flex-col gap-3 p-4" style={{ maxHeight: "60vh", overflowY: "auto" }}>
        {/* Content */}
        <div className="text-sm" style={{ color: "var(--tc-text)", whiteSpace: "pre-wrap" }}>
          {post.content?.replace(/<[^>]*>/g, "") || "(내용 없음)"}
        </div>
        <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
          {post.created_by_name} · {post.created_at ? new Date(post.created_at).toLocaleString("ko-KR") : ""}
        </div>

        {/* Replies */}
        {replies && replies.length > 0 && (
          <div className="flex flex-col gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--tc-border)" }}>
            {(replies as CounselingReply[]).map((r) => (
              <div key={r.id} className="flex flex-col gap-0.5 rounded-lg" style={{ padding: "8px 12px", background: "var(--tc-surface-soft)" }}>
                <div className="text-sm" style={{ color: "var(--tc-text)", whiteSpace: "pre-wrap" }}>
                  {r.content}
                </div>
                <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                  {r.created_by_name} · {r.created_at ? new Date(r.created_at).toLocaleString("ko-KR") : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Reply input */}
        <div className="flex gap-2 mt-2 items-end">
          <textarea
            placeholder="답글 입력... (Shift+Enter 줄바꿈, Enter 전송)"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && replyText.trim() && !replyMut.isPending) {
                e.preventDefault();
                replyMut.mutate(replyText.trim());
              }
            }}
            rows={2}
            className="flex-1 text-sm rounded-lg resize-y"
            style={{
              padding: "8px 12px",
              border: "1px solid var(--tc-border)",
              background: "var(--tc-surface)",
              color: "var(--tc-text)",
              outline: "none",
              minHeight: 40,
              maxHeight: 200,
            }}
          />
          <button
            onClick={() => replyText.trim() && !replyMut.isPending && replyMut.mutate(replyText.trim())}
            disabled={!replyText.trim() || replyMut.isPending}
            className="text-sm font-semibold px-3 py-2 rounded-lg cursor-pointer shrink-0"
            style={{
              border: "none",
              background: replyText.trim() && !replyMut.isPending ? "var(--tc-primary)" : "var(--tc-border)",
              color: replyText.trim() && !replyMut.isPending ? "#fff" : "var(--tc-text-muted)",
              minHeight: 40,
            }}
          >
            {replyMut.isPending ? "전송 중…" : "전송"}
          </button>
        </div>

        {/* Delete */}
        <button
          onClick={() => {
            if (window.confirm("이 상담 메모와 답글을 모두 삭제합니다. 복구할 수 없어요.\n\n계속하시겠어요?")) onDelete();
          }}
          className="text-sm py-2 mt-2 cursor-pointer"
          style={{ border: "none", background: "none", color: "var(--tc-danger)" }}
        >
          삭제
        </button>
      </div>
    </BottomSheet>
  );
}
