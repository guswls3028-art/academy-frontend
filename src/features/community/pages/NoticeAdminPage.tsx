// PATH: src/features/community/pages/NoticeAdminPage.tsx
// 공지사항 관리 — QnA 탭 참고: 좌측 폴더 트리(전체/강의/차시 공지) + 우측 목록·상세

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunityScope } from "../context/CommunityScopeContext";
import {
  fetchScopeNodes,
  fetchCommunityBoardPosts,
  fetchBlockTypes,
  getNoticeBlockTypeId,
  fetchPost,
  updatePostNodes,
  deletePost,
  fetchAllNoticePostsForCount,
  fetchPostTemplates,
  type BoardPost,
  type ScopeNodeMinimal,
  type CommunityScopeParams,
} from "../api/community.api";
import { fetchLectures, fetchSessions, type Lecture, type Session } from "@/features/lectures/api/sessions";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { isSupplement } from "@/shared/ui/session-block/session-block.constants";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { NoticeCreateModal } from "./NoticeBoardPage";
import "@/features/community/qna-inbox.css";
import "@/features/community/notice-tree.css";

const SNIPPET_LEN = 72;

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
    enabled: Number.isFinite(expandedLectureId ?? 0),
  });

  const { data: noticeBlockTypeId } = useQuery({
    queryKey: ["community-notice-block-type-id"],
    queryFn: () => getNoticeBlockTypeId(),
  });

  const { data: blockTypes = [] } = useQuery({
    queryKey: ["community-block-types"],
    queryFn: () => fetchBlockTypes(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["community-post-templates"],
    queryFn: () => fetchPostTemplates(),
    enabled: showCreate,
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

  const selectAll = useCallback(() => {
    setScope("all");
    setLectureId(null);
    setSessionId(null);
  }, [setScope, setLectureId, setSessionId]);

  const selectSession = useCallback(
    (lecId: number, sesId: number) => {
      setScope("session");
      setLectureId(lecId);
      setSessionId(sesId);
    },
    [setScope, setLectureId, setSessionId]
  );

  const toggleParent = useCallback(() => {
    setExpandedParent((p) => !p);
    if (expandedParent) setExpandedLectureId(null);
  }, [expandedParent]);

  const toggleLecture = useCallback((lecId: number) => {
    setExpandedLectureId((prev) => (prev === lecId ? null : lecId));
  }, []);

  const canShowList =
    scope === "all" ||
    (scope === "lecture" && effectiveLectureId != null) ||
    (scope === "session" && sessionId != null);

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
            className={`notice-tree__tab ${scope === "all" ? "notice-tree__tab--active" : ""}`}
            onClick={selectAll}
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
                  className={`notice-tree__sub-item notice-tree__sub-item--parent ${expandedLectureId === lec.id ? "notice-tree__sub-item--active" : ""}`}
                  onClick={() => toggleLecture(lec.id)}
                  aria-expanded={expandedLectureId === lec.id}
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
                            className={`notice-tree__sub-item notice-tree__sub-item--child ${supplement ? "notice-tree__sub-item--supplement" : "notice-tree__sub-item--n1"} ${scope === "session" && lectureId === lec.id && sessionId === s.id ? "notice-tree__sub-item--active" : ""}`}
                            onClick={() => selectSession(lec.id, s.id)}
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

      {/* 2번 영역: 공지 목록 (최상단 공지 추가하기 섹션 + 리스트) */}
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
          </div>
        </div>
        <div className="qna-inbox__list-body">
          {canShowList && (
            <div className="notice-tree__add-section">
              <Button
                intent="primary"
                size="sm"
                onClick={() => setShowCreate(true)}
                className="w-full"
              >
                + 공지 추가하기
              </Button>
            </div>
          )}
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
          ) : filtered.length === 0 ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">
                {searchQuery.trim() ? "검색 결과가 없습니다" : "등록된 공지가 없습니다"}
              </p>
              <p className="qna-inbox__empty-desc">
                {searchQuery.trim()
                  ? "다른 검색어를 입력해 보세요."
                  : "공지 작성 버튼으로 등록하거나, 좌측에서 다른 범위를 선택해 보세요."}
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
          templates={templates}
          defaultBlockTypeCode="notice"
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["community-notice-posts"] });
            qc.invalidateQueries({ queryKey: ["community-board-posts"] });
            qc.invalidateQueries({ queryKey: ["community-all-notice-posts-for-count"] });
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

  const initialNodeIds = post?.mappings?.map((m) => m.node) ?? [];
  const [inspectorNodeIds, setInspectorNodeIds] = useState<number[]>([]);

  useEffect(() => {
    if (post?.mappings?.length) {
      setInspectorNodeIds(post.mappings.map((m) => m.node));
    } else {
      setInspectorNodeIds([]);
    }
  }, [post?.id, post?.mappings]);

  const deleteMut = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-notice-posts"] });
      qc.invalidateQueries({ queryKey: ["community-board-posts"] });
      qc.invalidateQueries({ queryKey: ["community-all-notice-posts-for-count"] });
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
      feedback.success("노출 노드가 저장되었습니다.");
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
              노출 노드 저장
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
