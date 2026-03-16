// PATH: src/features/community/pages/NoticeAdminPage.tsx
// 공지사항 관리 — QnA 탭 참고: 좌측 폴더 트리(전체/강의/차시 공지) + 우측 목록·상세

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunityScope } from "../context/CommunityScopeContext";
import {
  fetchScopeNodes,
  fetchAdminPosts,
  fetchPost,
  updatePostNodes,
  updatePost,
  deletePost,
  createPost,
  fetchAllNoticePostsForCount,
  resolveNodeIdFromScope,
  type PostEntity,
  type ScopeNodeMinimal,
  type CommunityScopeParams,
} from "../api/community.api";
import { fetchLectures, fetchSessions, type Lecture, type Session } from "@/features/lectures/api/sessions";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { isSupplement } from "@/shared/ui/session-block/session-block.constants";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import "@/features/community/qna-inbox.css";
import "@/features/community/notice-tree.css";

const SNIPPET_LEN = 72;

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

export default function NoticeAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIdParam = searchParams.get("id");
  const selectedId = selectedIdParam && /^\d+$/.test(selectedIdParam) ? Number(selectedIdParam) : null;

  const {
    scope,
    setScope,
    lectureId,
    setLectureId,
    sessionId,
    setSessionId,
    effectiveLectureId,
  } = useCommunityScope();

  const scopeParams = useMemo<CommunityScopeParams>(
    () => ({
      scope,
      lectureId: effectiveLectureId ?? undefined,
      sessionId: sessionId ?? undefined,
    }),
    [scope, effectiveLectureId, sessionId]
  );

  /** 강의목록 폴더 펼침 여부 */
  const [expandedParent, setExpandedParent] = useState(false);
  /** 펼쳐진 강의(해당 강의의 차시 목록 표시) */
  const [expandedLectureId, setExpandedLectureId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: scopeNodes = [] } = useQuery<ScopeNodeMinimal[]>({
    queryKey: ["community-scope-nodes"],
    queryFn: () => fetchScopeNodes(),
  });

  const { data: lectures = [] } = useQuery<Lecture[]>({
    queryKey: ["lectures-list"],
    queryFn: () => fetchLectures({ is_active: true }),
  });

  const { data: sessionsOfLecture = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ["lecture-sessions", expandedLectureId],
    queryFn: () => fetchSessions(expandedLectureId!),
    enabled: expandedLectureId != null && Number.isFinite(expandedLectureId),
  });

  /** 트리 노드별 공지 개수 집계용: 공지 전체 목록(매핑 포함) */
  const { data: allNoticePostsForCount = [] } = useQuery({
    queryKey: ["community-all-notice-posts-for-count"],
    queryFn: () => fetchAllNoticePostsForCount(),
  });

  const noticeCounts = useMemo(() => {
    const scopeNodeIds = new Set(scopeNodes.map((n) => n.id));
    const countByNodeId: Record<number, number> = {};
    for (const n of scopeNodes) countByNodeId[n.id] = 0;
    for (const p of allNoticePostsForCount) {
      for (const m of p.mappings ?? []) {
        if (scopeNodeIds.has(m.node)) countByNodeId[m.node] = (countByNodeId[m.node] ?? 0) + 1;
      }
    }
    const totalNoticeCount = allNoticePostsForCount.length;
    const totalUnderScope = allNoticePostsForCount.filter((p) =>
      p.mappings?.some((m) => scopeNodeIds.has(m.node))
    ).length;
    const countByLecture: Record<number, number> = {};
    for (const lec of lectures) countByLecture[lec.id] = 0;
    for (const p of allNoticePostsForCount) {
      const seen = new Set<number>();
      for (const m of p.mappings ?? []) {
        const lid = m.node_detail?.lecture;
        if (lid != null && !seen.has(lid)) {
          seen.add(lid);
          countByLecture[lid] = (countByLecture[lid] ?? 0) + 1;
        }
      }
    }
    return {
      totalNoticeCount,
      totalUnderScope,
      countByNodeId,
      countByLecture,
    };
  }, [allNoticePostsForCount, scopeNodes, lectures]);

  const { data: allNotices = [], isLoading, isError, error } = useQuery<PostEntity[]>({
    queryKey: ["community-notice-posts"],
    queryFn: async () => {
      const { results } = await fetchAdminPosts({ postType: "notice", pageSize: 500 });
      return results;
    },
    retry: 1,
    staleTime: 30_000,
  });

  // scope 필터: 전체=모든 글, 강의/차시=해당 매핑+GLOBAL
  const nodeId = useMemo(
    () => resolveNodeIdFromScope(scopeNodes, scopeParams),
    [scopeNodes, scopeParams]
  );
  const posts = useMemo(() => {
    if (scope === "all") return allNotices;
    return allNotices.filter((p) => {
      if (!p.mappings || p.mappings.length === 0) return true; // GLOBAL
      if (nodeId == null) return true;
      return p.mappings.some((m) => m.node === nodeId);
    });
  }, [allNotices, scope, nodeId]);

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

  /** 트리 선택 시 URL에 반영 → Context가 동기화되어 목록/공지추가 버튼 표시 */
  const selectAll = useCallback(() => {
    setShowCreate(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("scope", "all");
      next.delete("lectureId");
      next.delete("sessionId");
      return next;
    });
  }, [setSearchParams]);

  const selectLecture = useCallback(
    (lecId: number) => {
      setShowCreate(false);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("scope", "lecture");
        next.set("lectureId", String(lecId));
        next.delete("sessionId");
        return next;
      });
    },
    [setSearchParams]
  );

  const selectSession = useCallback(
    (lecId: number, sesId: number) => {
      setShowCreate(false);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("scope", "session");
        next.set("lectureId", String(lecId));
        next.set("sessionId", String(sesId));
        return next;
      });
    },
    [setSearchParams]
  );

  const toggleParent = useCallback(() => {
    setExpandedParent((p) => !p);
    if (expandedParent) setExpandedLectureId(null);
  }, [expandedParent]);

  const toggleLecture = useCallback((lecId: number) => {
    setExpandedLectureId((prev) => (prev === lecId ? null : lecId));
  }, []);

  const hasScopeParam = searchParams.has("scope");
  const canShowList =
    hasScopeParam && (
      scope === "all" ||
      (scope === "lecture" && effectiveLectureId != null) ||
      (scope === "session" && sessionId != null)
    );

  return (
    <div className="notice-tree" style={{ minHeight: "calc(100vh - 180px)" }}>
      {/* 좌측: 전체공지 + 강의목록(펼침) → 강의명(펼침) → 차시 (실제 DB 연동) */}
      <nav className="notice-tree__nav">
        <div className="notice-tree__nav-header">
          <h2 className="notice-tree__nav-title">공지</h2>
        </div>

        <div className="notice-tree__tabs">
          <button
            type="button"
            className={`notice-tree__tab ${scope === "all" ? "notice-tree__tab--active notice-tree__tab--selected" : ""}`}
            onClick={selectAll}
            aria-selected={scope === "all"}
          >
            <span className="notice-tree__tab-icon" aria-hidden>📋</span>
            <span className="notice-tree__tab-label">전체공지</span>
            {noticeCounts.totalNoticeCount > 0 && (
              <span className="notice-tree__count" aria-label={`공지 ${noticeCounts.totalNoticeCount}건`}>
                {noticeCounts.totalNoticeCount}
              </span>
            )}
            <span className="notice-tree__tab-chevron" aria-hidden />
          </button>
          <button
            type="button"
            className={`notice-tree__tab ${expandedParent ? "notice-tree__tab--active" : ""}`}
            onClick={toggleParent}
            aria-expanded={expandedParent}
          >
            <span className="notice-tree__tab-icon" aria-hidden>📁</span>
            <span className="notice-tree__tab-label">강의목록</span>
            {noticeCounts.totalUnderScope > 0 && (
              <span className="notice-tree__count" aria-label={`공지 ${noticeCounts.totalUnderScope}건`}>
                {noticeCounts.totalUnderScope}
              </span>
            )}
            <span className="notice-tree__tab-chevron">
              {expandedParent ? "▼" : "▶"}
            </span>
          </button>
        </div>

        <div className="notice-tree__sub">
          {expandedParent &&
            lectures.map((lec) => (
              <div key={`lec-${lec.id}`} className="notice-tree__branch">
                <button
                  type="button"
                  className={`notice-tree__sub-item notice-tree__sub-item--parent ${expandedLectureId === lec.id ? "notice-tree__sub-item--active" : ""} ${scope === "lecture" && lectureId === lec.id ? "notice-tree__sub-item--selected" : ""}`}
                  onClick={() => {
                    toggleLecture(lec.id);
                    selectLecture(lec.id);
                  }}
                  aria-expanded={expandedLectureId === lec.id}
                  aria-selected={scope === "lecture" && lectureId === lec.id}
                >
                  <span className="notice-tree__sub-chevron">
                    {expandedLectureId === lec.id ? "▼" : "▶"}
                  </span>
                  <LectureChip
                    lectureName={lec.title || lec.name || ""}
                    color={lec.color ?? undefined}
                    size={20}
                  />
                  <span className="notice-tree__sub-label">{lec.title || lec.name || `강의 ${lec.id}`}</span>
                  {noticeCounts.countByLecture[lec.id] != null && noticeCounts.countByLecture[lec.id] > 0 && (
                    <span className="notice-tree__count" aria-label={`공지 ${noticeCounts.countByLecture[lec.id]}건`}>
                      {noticeCounts.countByLecture[lec.id]}
                    </span>
                  )}
                  <span className="notice-tree__sub-chevron-right" aria-hidden />
                </button>
                {expandedLectureId === lec.id && (
                  <div className="notice-tree__children">
                    {sessionsLoading ? (
                      <div className="notice-tree__sub-item notice-tree__sub-item--child" style={{ color: "var(--color-text-muted)" }}>
                        불러오는 중…
                      </div>
                    ) : (
                      (sessionsOfLecture as Session[]).map((s) => {
                        const sessionNodeId = scopeNodes.find(
                          (n) => n.lecture === lec.id && n.session === s.id
                        )?.id;
                        const sessionCount =
                          sessionNodeId != null ? noticeCounts.countByNodeId[sessionNodeId] ?? 0 : 0;
                        const supplement = isSupplement(s.title);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={`notice-tree__sub-item notice-tree__sub-item--child ${supplement ? "notice-tree__sub-item--supplement" : "notice-tree__sub-item--n1"} ${scope === "session" && lectureId === lec.id && sessionId === s.id ? "notice-tree__sub-item--active notice-tree__sub-item--selected" : ""}`}
                            onClick={() => selectSession(lec.id, s.id)}
                            aria-selected={scope === "session" && lectureId === lec.id && sessionId === s.id}
                          >
                            <span className="notice-tree__sub-item-child-icon" aria-hidden>ㄴ</span>
                            <span className="notice-tree__sub-label">{s.title || `${s.order}차시`}</span>
                            {sessionCount > 0 && (
                              <span className="notice-tree__count" aria-label={`공지 ${sessionCount}건`}>
                                {sessionCount}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      </nav>

      {/* 2번 영역: 공지 목록 — 상단에 공지 추가하기 고정, 아래로 목록 스크롤 */}
      <aside className="qna-inbox__list">
        <div className="qna-inbox__list-header">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <h2 className="qna-inbox__list-title">공지사항</h2>
            <Button intent="primary" size="sm" onClick={() => { setShowCreate(true); setSelectedId(null); }}>+ 추가</Button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              className="ds-input flex-1 min-w-0"
              placeholder="제목 · 내용 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="검색"
            />
          </div>
        </div>
        <div className="qna-inbox__list-body">
          {!canShowList ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">
                {expandedParent ? "차시를 선택하세요" : "전체공지 또는 강의목록에서 차시를 선택하세요"}
              </p>
              <p className="qna-inbox__empty-desc">
                강의목록을 펼친 뒤 강의명을 누르면 1차시, 2차시 등이 나옵니다. 차시를 클릭하면 해당 공지가 표시됩니다.
              </p>
            </div>
          ) : isLoading ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">불러오는 중…</p>
            </div>
          ) : isError ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">목록을 불러오지 못했습니다</p>
              <p className="qna-inbox__empty-desc">
                {(error as Error)?.message || "잠시 후 다시 시도해 주세요."}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">
                {searchQuery.trim() ? "검색 결과가 없습니다" : "등록된 공지가 없습니다"}
              </p>
              <p className="qna-inbox__empty-desc">
                {searchQuery.trim()
                  ? "다른 검색어를 입력해 보세요."
                  : "위 '공지 추가하기' 버튼을 누르면 이 범위에 공지를 등록할 수 있습니다. 목록 로딩을 기다리지 않아도 됩니다."}
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
        {showCreate ? (
          <NoticeCreatePane
            scopeNodes={scopeNodes}
            scopeParams={scopeParams}
            onCancel={() => setShowCreate(false)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["community-notice-posts"] });
              qc.invalidateQueries({ queryKey: ["community-board-posts"] });
              qc.invalidateQueries({ queryKey: ["community-all-notice-posts-for-count"] });
              setShowCreate(false);
              feedback.success("공지가 등록되었습니다.");
            }}
          />
        ) : selectedId == null ? (
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
    </div>
  );
}

function NoticeCard({
  post,
  isActive,
  onClick,
}: {
  post: PostEntity;
  isActive: boolean;
  onClick: () => void;
}) {
  const plainText = stripHtml(post.content ?? "");
  const snippet = plainText.length > SNIPPET_LEN ? plainText.slice(0, SNIPPET_LEN).trim() + "…" : plainText;
  const dateLabel = post.created_at
    ? new Date(post.created_at).toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
      })
    : "—";
  const lectureTitle = post.mappings?.[0]?.node_detail?.lecture_title;

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
            {lectureTitle && (
              <>
                <span className="qna-inbox__card-meta-dot" />
                <span>{lectureTitle}</span>
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
  const confirm = useConfirm();
  const { data: post, isLoading } = useQuery({
    queryKey: ["community-post", postId],
    queryFn: () => fetchPost(postId),
    enabled: postId != null,
  });

  const initialNodeIds = post?.mappings?.map((m) => m.node) ?? [];
  const [inspectorNodeIds, setInspectorNodeIds] = useState<number[]>([]);
  const [editingContent, setEditingContent] = useState("");
  const [contentSaved, setContentSaved] = useState(false);

  useEffect(() => {
    if (post?.mappings?.length) {
      setInspectorNodeIds(post.mappings.map((m) => m.node));
    } else {
      setInspectorNodeIds([]);
    }
  }, [post?.id, post?.mappings]);

  useEffect(() => {
    setEditingContent(post?.content ?? "");
  }, [post?.id, post?.content]);

  const deleteMut = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-notice-posts"] });
      qc.invalidateQueries({ queryKey: ["community-board-posts"] });
      qc.invalidateQueries({ queryKey: ["community-all-notice-posts-for-count"] });
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      feedback.success("공지가 삭제되었습니다.");
      onDeleted();
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "삭제에 실패했습니다.");
    },
  });

  const updateNodesMut = useMutation({
    mutationFn: (nodeIds: number[]) => updatePostNodes(postId, nodeIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      qc.invalidateQueries({ queryKey: ["community-notice-posts"] });
      qc.invalidateQueries({ queryKey: ["community-all-notice-posts-for-count"] });
      feedback.success("노출 범위가 저장되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "저장에 실패했습니다.");
    },
  });

  const updateContentMut = useMutation({
    mutationFn: (content: string) => updatePost(postId, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      qc.invalidateQueries({ queryKey: ["community-notice-posts"] });
      qc.invalidateQueries({ queryKey: ["community-board-posts"] });
      setContentSaved(true);
      feedback.success("내용이 저장되었습니다.");
      setTimeout(() => setContentSaved(false), 2000);
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "저장에 실패했습니다.");
    },
  });

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
  const currentNodeIds = inspectorNodeIds.length ? inspectorNodeIds : initialNodeIds;

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
              onClick={async () => {
                if (await confirm({ title: "공지 삭제", message: "이 공지를 삭제할까요?", confirmText: "삭제", danger: true })) deleteMut.mutate();
              }}
              disabled={deleteMut.isPending}
            >
              삭제
            </Button>
          </div>
        </div>
      </header>

      <div className="qna-inbox__thread-body" style={{ padding: "var(--space-5, 20px)" }}>
        <div style={{ marginBottom: "var(--space-4)" }}>
          <div
            className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2"
          >
            내용
          </div>
          <RichTextEditor
            value={editingContent}
            onChange={setEditingContent}
            placeholder="공지 내용을 입력하세요."
            minHeight={200}
          />
          <div className="flex items-center gap-2 mt-2">
            <Button
              intent="primary"
              size="sm"
              onClick={() => updateContentMut.mutate(editingContent)}
              disabled={updateContentMut.isPending || editingContent === (post.content ?? "")}
            >
              {updateContentMut.isPending ? "저장 중…" : "내용 저장"}
            </Button>
            {contentSaved && (
              <span className="text-sm text-[var(--color-text-muted)]">저장되었습니다.</span>
            )}
          </div>
        </div>

        <div style={{ marginTop: "var(--space-6)" }}>
          <div
            className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2"
          >
            노출 대상
          </div>
          <select
            className="ds-input w-full"
            multiple
            value={currentNodeIds.map(String)}
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
              onClick={() => updateNodesMut.mutate(currentNodeIds)}
              disabled={updateNodesMut.isPending}
            >
              노출 범위 저장
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Inline Notice Create Pane ──────────────────────── */
function NoticeCreatePane({
  scopeNodes,
  scopeParams,
  onCancel,
  onSuccess,
}: {
  scopeNodes: ScopeNodeMinimal[];
  scopeParams: CommunityScopeParams;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-resolve node_ids from current scope
  // 전체공지(scope=all)는 매핑 없음(node_ids=[]) — 모든 학생에게 노출
  const autoNodeIds = useMemo(() => {
    if (scopeParams.scope === "session" && scopeParams.sessionId != null) {
      const node = scopeNodes.find(
        (n) => n.lecture === scopeParams.lectureId && n.session === scopeParams.sessionId
      );
      return node ? [node.id] : [];
    }
    if (scopeParams.scope === "lecture" && scopeParams.lectureId != null) {
      const nodes = scopeNodes.filter((n) => n.lecture === scopeParams.lectureId && n.level === "COURSE");
      return nodes.map((n) => n.id);
    }
    // scope="all" → 전체 공지: 매핑 없음
    return [];
  }, [scopeNodes, scopeParams]);

  const scopeLabel = scopeParams.scope === "session"
    ? scopeNodes.find((n) => n.lecture === scopeParams.lectureId && n.session === scopeParams.sessionId)?.session_title ?? "선택된 차시"
    : scopeParams.scope === "lecture"
    ? scopeNodes.find((n) => n.lecture === scopeParams.lectureId)?.lecture_title ?? "선택된 강의"
    : "전체 공지";

  const canSubmit = title.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPost({
        post_type: "notice",
        title: title.trim(),
        content,
        node_ids: autoNodeIds,
        is_urgent: isUrgent || undefined,
      });
      onSuccess();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? (e as Error)?.message ?? "등록에 실패했습니다.";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="qna-inbox__thread-header">
        <div className="qna-inbox__thread-title-row">
          <div className="qna-inbox__thread-title-group">
            <h1 className="qna-inbox__thread-title">새 공지 작성</h1>
            <div className="qna-inbox__thread-meta">
              <span>대상: {scopeLabel}</span>
            </div>
          </div>
          <div className="qna-inbox__thread-actions">
            <Button intent="ghost" size="sm" onClick={onCancel}>취소</Button>
          </div>
        </div>
      </header>

      <div className="qna-inbox__thread-body" style={{ padding: "var(--space-4, 16px) var(--space-5, 20px)" }}>
        <div style={{ marginBottom: "var(--space-4, 16px)" }}>
          <label className="community-field__label community-field__label--required" style={{ display: "block", marginBottom: 6 }}>제목</label>
          <input className="ds-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="공지 제목을 입력하세요" style={{ width: "100%" }} autoFocus />
        </div>

        <div style={{ marginBottom: "var(--space-4, 16px)" }}>
          <label className="community-field__label" style={{ display: "block", marginBottom: 6 }}>내용</label>
          <RichTextEditor value={content} onChange={setContent} placeholder="공지 내용을 입력하세요..." minHeight={250} />
        </div>

        <div style={{ marginBottom: "var(--space-4, 16px)", display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, color: isUrgent ? "var(--color-error, #dc2626)" : "var(--color-text-secondary)" }}>
            <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--color-error, #dc2626)" }} />
            긴급 공지
          </label>
          {isUrgent && <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>학생 앱에서 강조 표시됩니다</span>}
        </div>

        {error && <p className="community-field__error">{error}</p>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button intent="secondary" size="sm" onClick={onCancel}>취소</Button>
          <Button intent="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "등록 중…" : "등록"}
          </Button>
        </div>
      </div>
    </>
  );
}
