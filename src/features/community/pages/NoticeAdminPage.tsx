// PATH: src/features/community/pages/NoticeAdminPage.tsx
// 공지사항 관리 — QnA 탭과 동일한 디자인(좌 목록 | 우 상세)

import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunityScope } from "../context/CommunityScopeContext";
import {
  fetchScopeNodes,
  resolveNodeIdFromScope,
  fetchCommunityBoardPosts,
  fetchBlockTypes,
  getNoticeBlockTypeId,
  fetchPost,
  updatePostNodes,
  deletePost,
  type BoardPost,
  type PostEntity,
  type ScopeNodeMinimal,
  type CommunityScopeParams,
} from "../api/community.api";
import { EmptyState, Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { NoticeCreateModal } from "./NoticeBoardPage";
import "@/features/community/qna-inbox.css";

const SNIPPET_LEN = 72;

export default function NoticeAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIdParam = searchParams.get("id");
  const selectedId = selectedIdParam && /^\d+$/.test(selectedIdParam) ? Number(selectedIdParam) : null;

  const { scope, effectiveLectureId, sessionId } = useCommunityScope();
  const scopeParams = useMemo<CommunityScopeParams>(
    () => ({
      scope,
      lectureId: effectiveLectureId ?? undefined,
      sessionId: sessionId ?? undefined,
    }),
    [scope, effectiveLectureId, sessionId]
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: scopeNodes = [] } = useQuery<ScopeNodeMinimal[]>({
    queryKey: ["community-scope-nodes"],
    queryFn: () => fetchScopeNodes(),
  });

  const { data: noticeBlockTypeId } = useQuery({
    queryKey: ["community-notice-block-type-id"],
    queryFn: () => getNoticeBlockTypeId(),
  });

  const { data: blockTypes = [] } = useQuery({
    queryKey: ["community-block-types"],
    queryFn: () => fetchBlockTypes(),
  });

  const { data: posts = [], isLoading } = useQuery<BoardPost[]>({
    queryKey: [
      "community-notice-posts",
      scope,
      effectiveLectureId,
      sessionId,
      noticeBlockTypeId ?? "all",
    ],
    queryFn: () =>
      fetchCommunityBoardPosts({
        ...scopeParams,
        categoryId: noticeBlockTypeId ?? undefined,
      }),
    enabled:
      scope === "all" ||
      (scope === "lecture" && effectiveLectureId != null) ||
      (scope === "session" && sessionId != null),
  });

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (p.title ?? "").toLowerCase().includes(q) ||
        (p.content ?? "").toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

  const setSelectedId = useCallback(
    (id: number | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (id != null) next.set("id", String(id));
        else next.delete("id");
        return next;
      });
    },
    [setSearchParams]
  );

  if (
    (scope === "lecture" && effectiveLectureId == null) ||
    (scope === "session" && (!effectiveLectureId || sessionId == null))
  ) {
    return (
      <div className="qna-inbox__empty">
        <p className="qna-inbox__empty-title">
          {scope === "session" ? "강의·차시를 선택하세요" : "강의를 선택하세요"}
        </p>
        <p className="qna-inbox__empty-desc">
          {scope === "session"
            ? "노출 범위를 세션별로 두고 강의와 차시를 선택하면 해당 차시 공지를 관리할 수 있습니다."
            : "노출 범위를 강의별로 두고 위에서 강의를 선택하면 해당 강의의 공지를 관리할 수 있습니다."}
        </p>
      </div>
    );
  }

  return (
    <div className="qna-inbox" style={{ minHeight: "calc(100vh - 180px)" }}>
      <aside className="qna-inbox__list">
        <div className="qna-inbox__list-header">
          <h2 className="qna-inbox__list-title">공지사항</h2>
          <div className="flex items-center gap-2">
            <input
              type="search"
              className="ds-input flex-1 min-w-0"
              placeholder="제목 · 내용 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="검색"
            />
            {(scope === "all" || (scope === "lecture" && effectiveLectureId) || (scope === "session" && sessionId)) && (
              <Button intent="primary" size="sm" onClick={() => setShowCreate(true)}>
                + 공지 작성
              </Button>
            )}
          </div>
        </div>
        <div className="qna-inbox__list-body">
          {isLoading ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">불러오는 중…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">
                {searchQuery.trim() ? "검색 결과가 없습니다" : "등록된 공지가 없습니다"}
              </p>
              <p className="qna-inbox__empty-desc">
                {searchQuery.trim()
                  ? "다른 검색어를 입력해 보세요."
                  : "공지 작성 버튼으로 등록하거나, 노출 범위를 바꿔 보세요."}
              </p>
            </div>
          ) : (
            filtered.map((p) => (
              <NoticeCard
                key={p.id}
                post={p}
                isActive={p.id === selectedId}
                onClick={() => setSelectedId(p.id)}
              />
            ))
          )}
        </div>
      </aside>

      <main className="qna-inbox__thread">
        {selectedId == null ? (
          <div className="qna-inbox__empty">
            <p className="qna-inbox__empty-title">공지를 선택하세요</p>
            <p className="qna-inbox__empty-desc">
              왼쪽 목록에서 공지를 클릭하면 여기에 내용이 표시됩니다.
            </p>
          </div>
        ) : (
          <NoticeDetailView
            postId={selectedId}
            scopeNodes={scopeNodes}
            onClose={() => setSelectedId(null)}
            onDeleted={() => setSelectedId(null)}
          />
        )}
      </main>

      {showCreate && (
        <NoticeCreateModal
          scope={scope}
          scopeNodes={scopeNodes}
          scopeParams={scopeParams}
          effectiveLectureId={effectiveLectureId ?? undefined}
          sessionId={sessionId ?? undefined}
          blockTypes={blockTypes}
          templates={[]}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["community-notice-posts"] });
            qc.invalidateQueries({ queryKey: ["community-board-posts"] });
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function NoticeCard({
  post,
  isActive,
  onClick,
}: {
  post: BoardPost;
  isActive: boolean;
  onClick: () => void;
}) {
  const snippet =
    post.content && post.content.length > SNIPPET_LEN
      ? post.content.slice(0, SNIPPET_LEN).trim() + "…"
      : post.content || "";
  const dateLabel = post.created_at
    ? new Date(post.created_at).toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`qna-inbox__card ${isActive ? "qna-inbox__card--active" : ""}`}
    >
      <div className="qna-inbox__card-top">
        <div className="qna-inbox__card-body">
          <div className="qna-inbox__card-title-row">
            <div className="qna-inbox__card-title">{post.title || "(제목 없음)"}</div>
          </div>
          {snippet && <div className="qna-inbox__card-snippet">{snippet}</div>}
          <div className="qna-inbox__card-meta">
            <span>{dateLabel}</span>
            {post.lecture_title && (
              <>
                <span className="qna-inbox__card-meta-dot" />
                <span>{post.lecture_title}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function NoticeDetailView({
  postId,
  scopeNodes,
  onClose,
  onDeleted,
}: {
  postId: number;
  scopeNodes: ScopeNodeMinimal[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const { data: post, isLoading } = useQuery({
    queryKey: ["community-post", postId],
    queryFn: () => fetchPost(postId),
    enabled: postId != null,
  });

  const deleteMut = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-notice-posts"] });
      qc.invalidateQueries({ queryKey: ["community-board-posts"] });
      feedback.success("공지가 삭제되었습니다.");
      onDeleted();
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "삭제에 실패했습니다.");
    },
  });

  const [inspectorNodeIds, setInspectorNodeIds] = useState<number[]>([]);
  const updateNodesMut = useMutation({
    mutationFn: (nodeIds: number[]) => updatePostNodes(postId, nodeIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      qc.invalidateQueries({ queryKey: ["community-notice-posts"] });
      feedback.success("노출 노드가 저장되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "저장에 실패했습니다.");
    },
  });

  if (post) {
    const currentIds = post.mappings?.map((m) => m.node) ?? [];
    if (inspectorNodeIds.length === 0 && currentIds.length > 0 && inspectorNodeIds !== currentIds) {
      setInspectorNodeIds(currentIds);
    }
  }

  const nodePickerOptions = useMemo(
    () =>
      scopeNodes.map((n) => ({
        label: n.session_title
          ? `${n.lecture_title} · ${n.session_title}`
          : `${n.lecture_title} (전체)`,
        value: n.id,
      })),
    [scopeNodes]
  );

  if (isLoading || !post) {
    return (
      <div className="qna-inbox__empty">
        <p className="qna-inbox__empty-title">
          {isLoading ? "불러오는 중…" : "공지를 찾을 수 없습니다."}
        </p>
      </div>
    );
  }

  const lectureLabel = post.mappings?.[0]?.node_detail?.lecture_title ?? "—";
  const initialNodeIds = post.mappings?.map((m) => m.node) ?? [];

  return (
    <>
      <header className="qna-inbox__thread-header">
        <div className="qna-inbox__thread-title-row">
          <div className="qna-inbox__thread-title-group">
            <h1 className="qna-inbox__thread-title">{post.title}</h1>
            <div className="qna-inbox__thread-meta">
              <span>{lectureLabel}</span>
              <span className="qna-inbox__thread-meta-dot" />
              <span>
                {new Date(post.created_at).toLocaleString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
          <div className="qna-inbox__thread-actions">
            <Button intent="ghost" size="sm" onClick={onClose}>
              목록
            </Button>
            <Button
              intent="danger"
              size="sm"
              onClick={() =>
                window.confirm("이 공지를 삭제할까요?") && deleteMut.mutate()
              }
              disabled={deleteMut.isPending}
            >
              삭제
            </Button>
          </div>
        </div>
      </header>

      <div className="qna-inbox__thread-body" style={{ padding: "var(--space-5, 20px)" }}>
        <div
          className="whitespace-pre-wrap text-[var(--color-text-primary)]"
          style={{ fontSize: "var(--text-sm)", lineHeight: 1.65 }}
        >
          {post.content || "(내용 없음)"}
        </div>

        <div style={{ marginTop: "var(--space-6)" }}>
          <div
            className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2"
            style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            노출 노드
          </div>
          <select
            className="ds-input w-full"
            multiple
            value={inspectorNodeIds.length ? inspectorNodeIds.map(String) : initialNodeIds.map(String)}
            onChange={(e) => {
              const selected = Array.from(
                e.target.selectedOptions,
                (o) => Number(o.value)
              );
              setInspectorNodeIds(selected);
            }}
            style={{ minHeight: 80 }}
          >
            {nodePickerOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2 mt-2">
            <Button
              intent="primary"
              size="sm"
              onClick={() =>
                updateNodesMut.mutate(
                  inspectorNodeIds.length ? inspectorNodeIds : initialNodeIds
                )
              }
              disabled={updateNodesMut.isPending}
            >
              노출 노드 저장
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
