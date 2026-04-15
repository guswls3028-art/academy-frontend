// PATH: src/app_teacher/domains/comms/components/PostDetail.tsx
// 게시글 상세 + Q&A 답변 기능
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { fetchPostReplies, createReply } from "../api";
import type { Post, Reply } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";

interface Props {
  post: Post;
  onBack: () => void;
}

export default function PostDetail({ post, onBack }: Props) {
  const qc = useQueryClient();
  const isQnA = post.post_type === "qna";

  const { data: replies, isLoading } = useQuery({
    queryKey: ["post-replies", post.id],
    queryFn: () => fetchPostReplies(post.id),
    enabled: isQnA,
  });

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");

  const mutation = useMutation({
    mutationFn: () => createReply(post.id, replyText),
    onSuccess: () => {
      setReplyText("");
      setReplyOpen(false);
      qc.invalidateQueries({ queryKey: ["post-replies", post.id] });
      qc.invalidateQueries({ queryKey: ["teacher-comms"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
    },
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={onBack} />
        <h1
          className="text-base font-bold truncate"
          style={{ color: "var(--tc-text)" }}
        >
          {isQnA ? "Q&A" : "공지사항"}
        </h1>
      </div>

      {/* Post content */}
      <div
        className="rounded-xl"
        style={{
          padding: "var(--tc-space-4)",
          background: "var(--tc-surface)",
          border: "1px solid var(--tc-border-subtle)",
        }}
      >
        <div className="flex items-start gap-2 mb-2">
          {post.is_urgent && (
            <span
              className="text-[10px] font-bold shrink-0 rounded px-1"
              style={{ background: "var(--tc-danger-bg)", color: "var(--tc-danger)" }}
            >
              긴급
            </span>
          )}
          <h2 className="text-[15px] font-bold" style={{ color: "var(--tc-text)" }}>
            {post.title}
          </h2>
        </div>
        <div className="text-xs mb-3" style={{ color: "var(--tc-text-muted)" }}>
          {post.author_display_name || "학생"} · {new Date(post.created_at).toLocaleDateString("ko-KR")}
        </div>
        <div
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: "var(--tc-text-secondary)" }}
        >
          {post.content}
        </div>
      </div>

      {/* Replies (Q&A only) */}
      {isQnA && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>
              답변 {replies?.length ?? 0}건
            </span>
            <button
              onClick={() => setReplyOpen(true)}
              className="text-xs font-bold cursor-pointer"
              style={{
                padding: "6px 12px",
                borderRadius: "var(--tc-radius)",
                background: "var(--tc-primary)",
                color: "#fff",
                border: "none",
              }}
            >
              답변 작성
            </button>
          </div>

          {isLoading ? (
            <EmptyState scope="panel" tone="loading" title="답변 불러오는 중…" />
          ) : replies && replies.length > 0 ? (
            replies.map((r) => <ReplyCard key={r.id} reply={r} />)
          ) : (
            <div
              className="text-sm text-center rounded-lg"
              style={{
                padding: "var(--tc-space-4)",
                color: "var(--tc-text-muted)",
                background: "var(--tc-surface-soft)",
              }}
            >
              아직 답변이 없습니다
            </div>
          )}
        </div>
      )}

      {/* Reply BottomSheet */}
      <BottomSheet open={replyOpen} onClose={() => setReplyOpen(false)} title="답변 작성">
        <div className="flex flex-col gap-3">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="답변을 입력하세요…"
            rows={5}
            className="w-full text-sm"
            style={{
              padding: "var(--tc-space-3)",
              borderRadius: "var(--tc-radius)",
              border: "1px solid var(--tc-border)",
              background: "var(--tc-surface-soft)",
              color: "var(--tc-text)",
              resize: "vertical",
              outline: "none",
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setReplyOpen(false)}
              className="flex-1 text-sm font-semibold cursor-pointer"
              style={{
                padding: "10px",
                borderRadius: "var(--tc-radius)",
                border: "1px solid var(--tc-border)",
                background: "var(--tc-surface)",
                color: "var(--tc-text-secondary)",
              }}
            >
              취소
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!replyText.trim() || mutation.isPending}
              className="flex-1 text-sm font-bold cursor-pointer"
              style={{
                padding: "10px",
                borderRadius: "var(--tc-radius)",
                border: "none",
                background: replyText.trim() ? "var(--tc-primary)" : "var(--tc-border)",
                color: "#fff",
                opacity: mutation.isPending ? 0.6 : 1,
              }}
            >
              {mutation.isPending ? "등록 중…" : "등록"}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function ReplyCard({ reply }: { reply: Reply }) {
  return (
    <div
      className="rounded-lg"
      style={{
        padding: "var(--tc-space-3)",
        background: "var(--tc-surface)",
        border: "1px solid var(--tc-border-subtle)",
      }}
    >
      <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--tc-text)" }}>
        {reply.content}
      </div>
      <div className="text-xs mt-2" style={{ color: "var(--tc-text-muted)" }}>
        {reply.author_display_name || (reply.author_role === "staff" ? "선생님" : "학생")} ·{" "}
        {new Date(reply.created_at).toLocaleDateString("ko-KR")}
      </div>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex p-1 cursor-pointer"
      style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
