/**
 * 영상 댓글 섹션 — 댓글 목록 + 작성 + 대댓글 + 수정/삭제
 */
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchVideoComments,
  createVideoComment,
  editVideoComment,
  deleteVideoComment,
  type VideoCommentItem,
} from "../api/video";
import { studentToast } from "@/student/shared/ui/feedback/studentToast";

/* ─── 상대 시간 포맷 ─── */
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
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

/* ─── 아바타 ─── */
function CommentAvatar({ name, photoUrl, size = 32 }: { name: string; photoUrl?: string | null; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "#2a2a2a",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize: size * 0.45, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
          {(name || "?")[0]}
        </span>
      )}
    </div>
  );
}

/* ─── 단일 댓글 ─── */
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
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showReplies, setShowReplies] = useState(false);

  const editMut = useMutation({
    mutationFn: () => editVideoComment(comment.id, editContent.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-comments", videoId] });
      setEditMode(false);
      studentToast.success("수정되었습니다.");
    },
    onError: () => {
      studentToast.error("댓글 수정에 실패했습니다.");
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteVideoComment(comment.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-comments", videoId] });
      studentToast.success("삭제되었습니다.");
    },
    onError: () => {
      studentToast.error("댓글 삭제에 실패했습니다.");
    },
  });

  if (comment.is_deleted) {
    return (
      <div style={{ padding: "8px 0", fontSize: 13, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
        삭제된 댓글입니다.
      </div>
    );
  }

  const isTeacher = comment.author_type === "teacher";

  return (
    <div style={{ display: "flex", gap: 10, padding: isReply ? "8px 0 8px 40px" : "12px 0" }}>
      <CommentAvatar name={comment.author_name} photoUrl={comment.author_photo_url} size={isReply ? 28 : 32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 작성자 + 시간 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: isTeacher ? "var(--stu-primary)" : "#fff" }}>
            {comment.author_name}
          </span>
          {isTeacher && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 4,
                background: "var(--stu-primary)",
                color: "#fff",
              }}
            >
              선생님
            </span>
          )}
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            {timeAgo(comment.created_at)}
          </span>
          {comment.is_edited && (
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>(수정됨)</span>
          )}
        </div>

        {/* 본문 */}
        {editMode ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <input
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              style={{
                flex: 1,
                background: "#2a2a2a",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 6,
                padding: "6px 10px",
                color: "#fff",
                fontSize: 13,
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && editContent.trim()) editMut.mutate();
                if (e.key === "Escape") setEditMode(false);
              }}
            />
            <button
              onClick={() => editMut.mutate()}
              disabled={!editContent.trim() || editMut.isPending}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                background: "var(--stu-primary)",
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
              onClick={() => setEditMode(false)}
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                background: "transparent",
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
                border: "1px solid rgba(255,255,255,0.15)",
                cursor: "pointer",
              }}
            >
              취소
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {comment.content}
          </div>
        )}

        {/* 액션 */}
        {!editMode && (
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            {!isReply && onReply && (
              <button
                onClick={() => { onReply(comment.id); setShowReplies(true); }}
                style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                답글
              </button>
            )}
            {comment.is_mine && (
              <>
                <button
                  onClick={() => { setEditContent(comment.content); setEditMode(true); }}
                  style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  수정
                </button>
                <button
                  onClick={() => { if (window.confirm("댓글을 삭제하시겠습니까?")) deleteMut.mutate(); }}
                  style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  삭제
                </button>
              </>
            )}
          </div>
        )}

        {/* 대댓글 토글 */}
        {!isReply && comment.replies.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <button
              onClick={() => setShowReplies(!showReplies)}
              style={{
                fontSize: 12,
                color: "var(--stu-primary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                fontWeight: 600,
              }}
            >
              {showReplies ? "▲ 답글 숨기기" : `▼ 답글 ${comment.replies.length}개`}
            </button>
          </div>
        )}

        {/* 대댓글 목록 */}
        {showReplies && comment.replies.map((r) => (
          <CommentRow key={r.id} comment={r} videoId={videoId} isReply />
        ))}
      </div>
    </div>
  );
}

/* ─── 메인 섹션 ─── */
export default function VideoCommentSection({ videoId }: { videoId: number }) {
  const qc = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["video-comments", videoId],
    queryFn: () => fetchVideoComments(videoId),
    enabled: !!videoId,
  });

  const createMut = useMutation({
    mutationFn: () => createVideoComment(videoId, newComment.trim(), replyTo ?? undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-comments", videoId] });
      setNewComment("");
      setReplyTo(null);
    },
    onError: () => {
      studentToast.error("댓글 작성에 실패했습니다.");
    },
  });

  const handleSubmit = useCallback(() => {
    if (!newComment.trim()) return;
    createMut.mutate();
  }, [newComment, createMut]);

  const comments = data?.comments ?? [];

  return (
    <div style={{ marginTop: "var(--stu-space-4)" }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 12 }}>
        댓글 {data?.total ?? 0}
      </h3>

      {/* 댓글 입력 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={replyTo ? "답글을 입력하세요..." : "댓글을 입력하세요..."}
          style={{
            flex: 1,
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            padding: "10px 14px",
            color: "#fff",
            fontSize: 14,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && newComment.trim()) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        {replyTo && (
          <button
            onClick={() => setReplyTo(null)}
            style={{
              padding: "8px",
              borderRadius: 8,
              background: "transparent",
              color: "rgba(255,255,255,0.4)",
              border: "1px solid rgba(255,255,255,0.15)",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            취소
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim() || createMut.isPending}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: newComment.trim() ? "var(--stu-primary)" : "#333",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            cursor: newComment.trim() ? "pointer" : "default",
            opacity: newComment.trim() ? 1 : 0.5,
            transition: "background 0.2s, opacity 0.2s",
          }}
        >
          {createMut.isPending ? "..." : "등록"}
        </button>
      </div>

      {/* 댓글 목록 */}
      {isLoading ? (
        <div style={{ padding: "16px 0", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
          불러오는 중...
        </div>
      ) : comments.length === 0 ? (
        <div style={{ padding: "24px 0", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
          아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
        </div>
      ) : (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
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
