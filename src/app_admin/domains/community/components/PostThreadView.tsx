// PATH: src/app_admin/domains/community/components/PostThreadView.tsx
// 공통 댓글/답변 스레드 — 4페이지(Board/Materials/QnA/Counsel)에서 중복되던
// CommentThread/CommentBlock/CommentComposer 패턴을 한 곳에 통합.
//
// - author_role 기반 라벨 (선생님/학생/관리자)
// - 수정/삭제/등록 mutation
// - RichText 또는 textarea 모드 선택

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import PostReadView from "./PostReadView";
import CommunityAvatar from "./CommunityAvatar";
import {
  fetchPostReplies,
  createAnswer,
  updateReply as updateReplyApi,
  deleteReply as deleteReplyApi,
  type Answer,
} from "../api/community.api";

export type ThreadMode = "comment" | "answer";

type Role = "teacher" | "student" | "admin";

function resolveRole(authorRole?: string | null): Role {
  const role = (authorRole ?? "").toLowerCase();
  if (role === "student") return "student";
  if (role === "staff") return "teacher";
  return "admin";
}

function roleLabel(role: Role, mode: ThreadMode): string {
  if (role === "student") return "학생";
  // QnA/Counsel = 답변, Board/Materials = 댓글
  if (mode === "answer") return "선생님";
  return "댓글";
}

interface PostThreadViewProps {
  postId: number;
  /** comment = textarea, answer = RichTextEditor */
  mode?: ThreadMode;
  /** 답변 등록 가능 여부 (예: 삭제된 학생 글) */
  allowReply?: boolean;
  /** 등록 후 추가 invalidation */
  invalidateKeys?: readonly unknown[][];
  /** 답변 미존재 안내 (없으면 기본값) */
  emptyText?: string;
  /** 등록 placeholder */
  placeholder?: string;
}

/**
 * 4페이지 공통 스레드 + 컴포저.
 * - 외부에서 post 본문 헤더는 직접 렌더링하고, 본 컴포넌트는 댓글/답변 + 입력만 담당
 */
export default function PostThreadView({
  postId,
  mode = "comment",
  allowReply = true,
  invalidateKeys = [],
  emptyText,
  placeholder,
}: PostThreadViewProps) {
  return (
    <>
      <ThreadList postId={postId} mode={mode} emptyText={emptyText} invalidateKeys={invalidateKeys} />
      <ThreadComposer
        postId={postId}
        mode={mode}
        allowReply={allowReply}
        invalidateKeys={invalidateKeys}
        placeholder={placeholder}
      />
    </>
  );
}

function ThreadList({
  postId,
  mode,
  emptyText,
  invalidateKeys,
}: {
  postId: number;
  mode: ThreadMode;
  emptyText?: string;
  invalidateKeys: readonly unknown[][];
}) {
  const { data: replies = [], isLoading } = useQuery<Answer[]>({
    queryKey: ["post-replies", postId],
    queryFn: () => fetchPostReplies(postId),
  });

  if (isLoading) {
    return (
      <div className="cms-detail__comment-thread">
        <p className="qna-inbox__empty-desc">{mode === "answer" ? "답변 불러오는 중…" : "댓글 불러오는 중…"}</p>
      </div>
    );
  }

  if (replies.length === 0 && emptyText) {
    return <div className="qna-inbox__empty-desc" style={{ textAlign: "center", padding: 16 }}>{emptyText}</div>;
  }

  return (
    <>
      {replies.map((r) => (
        <ReplyBlock key={r.id} postId={postId} reply={r} mode={mode} invalidateKeys={invalidateKeys} />
      ))}
    </>
  );
}

function ReplyBlock({
  postId,
  reply,
  mode,
  invalidateKeys,
}: {
  postId: number;
  reply: Answer;
  mode: ThreadMode;
  invalidateKeys: readonly unknown[][];
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);

  // 서버 갱신 시 편집 중이 아니면 동기화
  useEffect(() => {
    if (!editing) setEditContent(reply.content);
  }, [reply.content, editing]);

  const role = resolveRole(reply.author_role);
  const authorName = reply.created_by_display ?? roleLabel(role, mode);
  const badge = roleLabel(role, mode);
  const rowClass = role === "student" ? "" : "qna-inbox__message-row--teacher";
  const avatarRole: "student" | "teacher" = role === "student" ? "student" : "teacher";

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["post-replies", postId] });
    qc.invalidateQueries({ queryKey: ["community-post", postId] });
    for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: key });
  };

  const updateMut = useMutation({
    mutationFn: () => updateReplyApi(postId, reply.id, editContent),
    onSuccess: () => {
      invalidateAll();
      setEditing(false);
      feedback.success(mode === "answer" ? "답변이 수정되었습니다." : "댓글이 수정되었습니다.");
    },
    onError: (e: unknown) => feedback.error((e as Error)?.message ?? "수정에 실패했습니다."),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteReplyApi(postId, reply.id),
    onSuccess: () => {
      invalidateAll();
      feedback.success(mode === "answer" ? "답변이 삭제되었습니다." : "댓글이 삭제되었습니다.");
    },
    onError: (e: unknown) => feedback.error((e as Error)?.message ?? "삭제에 실패했습니다."),
  });

  return (
    <div className={`qna-inbox__message-row ${rowClass}`}>
      <CommunityAvatar name={authorName} role={avatarRole} />
      <div className="qna-inbox__message-bubble">
        <div className="qna-inbox__message-meta">
          <span className="qna-inbox__message-author">{authorName}</span>
          <span className="qna-inbox__message-badge">{badge}</span>
          <span className="qna-inbox__message-date">
            {new Date(reply.created_at).toLocaleString("ko-KR", {
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        {editing ? (
          <div className="qna-inbox__edit-form">
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={mode === "answer" ? 4 : 3} />
            <div className="qna-inbox__edit-actions">
              <Button size="sm" intent="primary" onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
                저장
              </Button>
              <Button size="sm" intent="secondary" onClick={() => setEditing(false)}>
                취소
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="qna-inbox__message-body">
              <PostReadView html={reply.content} />
            </div>
            <div className="qna-inbox__message-actions">
              <Button size="sm" intent="ghost" onClick={() => setEditing(true)}>
                수정
              </Button>
              <Button
                size="sm"
                intent="ghost"
                onClick={async () => {
                  if (
                    await confirm({
                      title: mode === "answer" ? "답변 삭제" : "댓글 삭제",
                      message: mode === "answer" ? "이 답변을 삭제할까요?" : "이 댓글을 삭제할까요?",
                      confirmText: "삭제",
                      danger: true,
                    })
                  )
                    deleteMut.mutate();
                }}
                disabled={deleteMut.isPending}
              >
                삭제
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ThreadComposer({
  postId,
  mode,
  allowReply,
  invalidateKeys,
  placeholder,
}: {
  postId: number;
  mode: ThreadMode;
  allowReply: boolean;
  invalidateKeys: readonly unknown[][];
  placeholder?: string;
}) {
  const [content, setContent] = useState("");
  const qc = useQueryClient();

  const createMut = useMutation({
    mutationFn: () => createAnswer(postId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: key });
      setContent("");
      feedback.success(mode === "answer" ? "답변이 등록되었습니다." : "댓글이 등록되었습니다.");
    },
    onError: (e: unknown) => feedback.error((e as Error)?.message ?? "등록에 실패했습니다."),
  });

  if (!allowReply) {
    return (
      <div className="qna-inbox__composer">
        <p className="qna-inbox__empty-desc" style={{ margin: 0 }}>
          삭제된 학생의 글에는 답변을 등록할 수 없습니다.
        </p>
      </div>
    );
  }

  // RichTextEditor 모드에서는 빈 P 태그 처리
  const isEmptyForRichText = !content.trim() || content.trim() === "<p></p>";
  const isEmpty = mode === "answer" ? isEmptyForRichText : !content.trim();

  return (
    <div className="qna-inbox__composer">
      <div className="qna-inbox__composer-inner">
        {mode === "answer" ? (
          <div className="qna-inbox__composer-editor">
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder={placeholder ?? "답변을 작성하세요…"}
              minHeight={80}
            />
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (
                (e.metaKey || e.ctrlKey) &&
                e.key === "Enter" &&
                content.trim() &&
                !createMut.isPending
              ) {
                e.preventDefault();
                createMut.mutate();
              }
            }}
            placeholder={placeholder ?? "댓글을 작성하세요…"}
            rows={3}
          />
        )}
        <div className="qna-inbox__composer-footer">
          {mode === "answer" ? (
            <span className="qna-inbox__composer-hint">서식 지원 · 이미지 첨부 가능</span>
          ) : (
            <span className="qna-inbox__composer-hint">
              <kbd>Ctrl</kbd>
              <kbd>Enter</kbd> 빠른 등록
            </span>
          )}
          <Button
            intent="primary"
            size="sm"
            onClick={() => createMut.mutate()}
            disabled={isEmpty || createMut.isPending}
          >
            {createMut.isPending ? "등록 중…" : mode === "answer" ? "답변 등록" : "댓글 등록"}
          </Button>
        </div>
      </div>
    </div>
  );
}
