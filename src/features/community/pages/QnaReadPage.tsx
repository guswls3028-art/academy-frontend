// PATH: src/features/community/pages/QnaReadPage.tsx
// QnA 상세 — 질문자 정보, 질문 기록(접기), 답변 섹션(수정/삭제), 질문 삭제

import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPost,
  fetchCommunityQuestions,
  fetchPostReplies,
  createAnswer,
  updateReply,
  deleteReply,
  deletePost,
  type Answer,
} from "../api/community.api";
import { EmptyState, Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";

export default function QnaReadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const postId = id != null && /^\d+$/.test(id) ? Number(id) : null;

  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ["community-post", postId],
    queryFn: () => fetchPost(postId!),
    enabled: postId != null,
  });

  const { data: questions = [] } = useQuery({
    queryKey: ["community-questions-for-history"],
    queryFn: () => fetchCommunityQuestions(null),
    enabled: postId != null && post != null,
  });

  const questionHistory = useMemo(() => {
    if (!post?.created_by) return [];
    return questions
      .filter((q) => q.id !== post.id && q.created_by === post.created_by)
      .slice(0, 20)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [post, questions]);

  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const deletePostMut = useMutation({
    mutationFn: () => deletePost(postId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-questions"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
      feedback.success("질문이 삭제되었습니다.");
      navigate("/admin/community/qna", { replace: true });
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "삭제에 실패했습니다.");
    },
  });

  if (postId == null) {
    return (
      <EmptyState scope="panel" title="잘못된 경로" description="질문 ID가 없습니다." />
    );
  }

  if (postLoading || !post) {
    return (
      <EmptyState
        scope="panel"
        tone="loading"
        title={postLoading ? "불러오는 중…" : "질문을 찾을 수 없습니다."}
      />
    );
  }

  const lectureLabel =
    post.mappings?.[0]?.node_detail?.lecture_title ?? "—";

  return (
    <div className="flex flex-col gap-6">
      {/* 상단: 목록으로 + 삭제 */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin/community/qna")}
          className="text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          ← 목록으로 돌아가기
        </button>
        <Button
          intent="secondary"
          size="sm"
          onClick={async () => {
            if (await confirm({ title: "질문 삭제", message: "이 질문을 삭제할까요?", confirmText: "삭제", danger: true })) deletePostMut.mutate();
          }}
          disabled={deletePostMut.isPending}
        >
          삭제
        </Button>
      </div>

      {/* 질문 제목·작성자·날짜·상태 */}
      <section className="ds-section">
        <header className="ds-section__header">
          <h1 className="ds-section__title">{post.title}</h1>
          <p className="ds-section__description">
            {post.created_by_deleted ? "삭제된 학생입니다." : (post.created_by_display ?? "—")} (학생) ·{" "}
            {new Date(post.created_at).toLocaleString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {post.replies_count != null && post.replies_count > 0 && (
              <>
                {" · "}
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                  style={{
                    background: "color-mix(in srgb, var(--color-status-error) 15%, transparent)",
                    color: "var(--color-status-error)",
                  }}
                >
                  답변 완료
                </span>
              </>
            )}
          </p>
        </header>
        <div className="ds-section__body">
          <div
            className="whitespace-pre-wrap text-[var(--color-text-primary)]"
            style={{ fontSize: "var(--text-sm)" }}
          >
            {post.content}
          </div>
        </div>
      </section>

      {/* 질문자 정보 */}
      <section className="ds-section">
        <header className="ds-section__header">
          <h2 className="ds-section__title">질문자 정보</h2>
        </header>
        <div className="ds-section__body">
          <div className="ds-section__kpi-list">
            <div className="ds-section__kpi-row">
              <span className="ds-section__kpi-label">이름</span>
              <span className="ds-section__kpi-value">
                {post.created_by_deleted ? "삭제된 학생입니다." : (post.created_by_display ?? "—")}
              </span>
            </div>
            <div className="ds-section__kpi-row">
              <span className="ds-section__kpi-label">수강중인 강좌</span>
              <span className="ds-section__kpi-value">{lectureLabel}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 질문 기록 */}
      {questionHistory.length > 0 && (
        <section className="ds-section">
          <header className="ds-section__header flex items-center justify-between">
            <h2 className="ds-section__title">질문 기록 (총 {questionHistory.length}건)</h2>
            <button
              type="button"
              onClick={() => setHistoryCollapsed((c) => !c)}
              className="text-sm font-medium text-[var(--color-primary)]"
            >
              {historyCollapsed ? "펼치기" : "↑ 접기"}
            </button>
          </header>
          {!historyCollapsed && (
            <div className="ds-section__body">
              <ul className="flex flex-col gap-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {questionHistory.map((q, idx) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/community/qna/read/${q.id}`)}
                      className="ds-section__item w-full flex items-center justify-between gap-3 text-left"
                    >
                      <span className="ds-section__item-label">
                        {idx + 1}. {q.title}
                      </span>
                      <span className="ds-section__item-meta">
                        {new Date(q.created_at).toLocaleString("ko-KR")}
                      </span>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={{
                          background: "var(--color-bg-surface-soft)",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {q.is_answered ? "답변 완료" : "답변 대기"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* 답변 섹션 — 삭제된 학생 질문에는 추가 답변 비활성화 */}
      <AnswerSection postId={postId} allowReply={!post.created_by_deleted} />
    </div>
  );
}

function AnswerSection({ postId, allowReply = true }: { postId: number; allowReply?: boolean }) {
  const qc = useQueryClient();
  const { data: replies = [], isLoading } = useQuery({
    queryKey: ["post-replies", postId],
    queryFn: () => fetchPostReplies(postId),
  });
  const firstReply = replies[0] ?? null;

  return (
    <section className="ds-section">
      <header className="ds-section__header">
        <h2 className="ds-section__title">답변</h2>
      </header>
      <div className="ds-section__body">
        {isLoading ? (
          <p className="ds-section__empty">불러오는 중…</p>
        ) : firstReply ? (
          <AnswerBlock postId={postId} answer={firstReply} />
        ) : allowReply ? (
          <AnswerForm postId={postId} onSuccess={() => qc.invalidateQueries({ queryKey: ["post-replies", postId] })} />
        ) : (
          <p className="ds-section__empty">삭제된 학생의 질문에는 추가 답변을 등록할 수 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function AnswerBlock({ postId, answer }: { postId: number; answer: Answer }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(answer.content);

  const updateMut = useMutation({
    mutationFn: () => updateReply(postId, answer.id, editContent),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["community-questions"] });
      setEditing(false);
      feedback.success("답변이 수정되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "수정에 실패했습니다.");
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteReply(postId, answer.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["community-questions"] });
      feedback.success("답변이 삭제되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "삭제에 실패했습니다.");
    },
  });

  return (
    <div>
      <p className="ds-section__description">
        {answer.created_by_display ?? "선생님"} ·{" "}
        {new Date(answer.created_at).toLocaleString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      {editing ? (
        <div className="mt-3">
          <textarea
            className="ds-input w-full min-h-[120px]"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
          />
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              intent="primary"
              onClick={() => updateMut.mutate()}
              disabled={updateMut.isPending}
            >
              저장
            </Button>
            <Button size="sm" intent="secondary" onClick={() => setEditing(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="whitespace-pre-wrap mt-2 text-[var(--color-text-primary)]" style={{ fontSize: "var(--text-sm)" }}>
            {answer.content}
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" intent="secondary" onClick={() => setEditing(true)}>
              답변 수정
            </Button>
            <Button
              size="sm"
              intent="secondary"
              onClick={async () => {
                if (await confirm({ title: "답변 삭제", message: "이 답변을 삭제할까요?", confirmText: "삭제", danger: true })) deleteMut.mutate();
              }}
              disabled={deleteMut.isPending}
            >
              답변 삭제
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function AnswerForm({ postId, onSuccess }: { postId: number; onSuccess: () => void }) {
  const [content, setContent] = useState("");
  const qc = useQueryClient();
  const createMut = useMutation({
    mutationFn: () => createAnswer(postId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-questions"] });
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
      setContent("");
      onSuccess();
      feedback.success("답변이 등록되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "등록에 실패했습니다.");
    },
  });

  return (
    <div>
      <textarea
        className="ds-input w-full min-h-[100px]"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="답변 입력"
        rows={4}
      />
      <Button
        intent="primary"
        size="sm"
        className="mt-2"
        onClick={() => createMut.mutate()}
        disabled={!content.trim() || createMut.isPending}
      >
        {createMut.isPending ? "등록 중…" : "답변 등록"}
      </Button>
    </div>
  );
}
