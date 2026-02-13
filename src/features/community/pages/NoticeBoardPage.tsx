// PATH: src/features/community/pages/NoticeBoardPage.tsx
// 공지사항 목록+작성 (게시 관리 내 "공지사항" 탭에서 사용, 또는 단독 라우트용)

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunityScope } from "../context/CommunityScopeContext";
import {
  fetchScopeNodes,
  resolveNodeIdFromScope,
  fetchCommunityBoardPosts,
  fetchCommunityBoardCategories,
  createCommunityBoardPost,
  fetchBlockTypes,
  fetchPostTemplates,
  createPostTemplate,
  type BoardPost,
  type BlockType,
  type PostTemplate,
  type ScopeNodeMinimal,
  type CommunityScopeParams,
} from "../api/community.api";
import { fetchLectures } from "@/features/lectures/api/sessions";
import { EmptyState, Button } from "@/shared/ui/ds";

/** 게시 관리 내 "공지사항" 탭에서 임베드용. ScopeSelector는 상위(게시 관리)에서 노출. */
export function NoticeBoardContent() {
  const qc = useQueryClient();
  const { scope, lectureId, sessionId, effectiveLectureId } = useCommunityScope();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const scopeParams = { scope, lectureId: effectiveLectureId ?? undefined, sessionId: sessionId ?? undefined };

  const { data: lectures = [] } = useQuery({
    queryKey: ["lectures-list"],
    queryFn: () => fetchLectures({ is_active: true }),
  });

  const { data: scopeNodes = [] } = useQuery<ScopeNodeMinimal[]>({
    queryKey: ["community-scope-nodes"],
    queryFn: () => fetchScopeNodes(),
    enabled: true,
  });

  const nodeId = useMemo(
    () => resolveNodeIdFromScope(scopeNodes, scopeParams),
    [scopeNodes, scope, effectiveLectureId, sessionId]
  );

  const { data: categories = [], isLoading: loadingCats } = useQuery<BlockType[]>({
    queryKey: ["community-block-types"],
    queryFn: () => fetchBlockTypes(),
    enabled: true,
  });

  const { data: templates = [] } = useQuery<PostTemplate[]>({
    queryKey: ["community-post-templates"],
    queryFn: () => fetchPostTemplates(),
    enabled: showCreate,
  });

  const { data: posts = [], isLoading: loadingPosts } = useQuery<BoardPost[]>({
    queryKey: ["community-board-posts", scope, effectiveLectureId, sessionId, selectedCategoryId, nodeId],
    queryFn: () =>
      fetchCommunityBoardPosts({
        ...scopeParams,
        categoryId: selectedCategoryId ?? undefined,
      }),
    enabled: scope === "all" || (scope === "lecture" && effectiveLectureId != null) || (scope === "session" && sessionId != null),
  });

  const lectureTitleMap = useMemo(() => {
    const m = new Map<number, string>();
    lectures.forEach((l) => m.set(l.id, l.title));
    return m;
  }, [lectures]);

  if ((scope === "lecture" && effectiveLectureId == null) || (scope === "session" && (!effectiveLectureId || sessionId == null))) {
    return (
      <EmptyState
        scope="panel"
        title={scope === "session" ? "강의·차시를 선택하세요" : "강의를 선택하세요"}
        description={
          scope === "session"
            ? "노출 범위를 '세션별'로 두고 강의와 차시를 선택하면 해당 차시 공지를 관리할 수 있습니다."
            : "노출 범위를 '강의별'로 두고 위에서 강의를 선택하면 해당 강의의 공지를 관리할 수 있습니다."
        }
      />
    );
  }

  const canCreate = scope === "all" || (scope === "lecture" && effectiveLectureId) || (scope === "session" && sessionId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: "var(--font-title)",
            color: "var(--color-text-muted)",
          }}
        >
          {scope === "all" ? "전체 공지" : scope === "session" ? "해당 차시 공지" : "해당 강의 공지"} · {posts.length}개
        </span>
        {canCreate && (
          <Button intent="primary" size="sm" onClick={() => setShowCreate(true)}>
            + 공지 작성
          </Button>
        )}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            intent={selectedCategoryId === null ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedCategoryId(null)}
          >
            전체
          </Button>
          {categories.map((c) => (
            <Button
              key={c.id}
              intent={selectedCategoryId === c.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategoryId(c.id)}
            >
              {c.label}
            </Button>
          ))}
        </div>
      )}

      {loadingPosts ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : posts.length === 0 ? (
        <EmptyState
          scope="panel"
          title="등록된 공지가 없습니다."
          description="위 '공지 작성'으로 등록하거나, 노출 범위를 바꿔 다른 공지를 확인하세요."
        />
      ) : (
        <ul className="flex flex-col gap-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {posts.map((p) => (
            <li
              key={p.id}
              style={{
                padding: "var(--space-4)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border-divider)",
                background: "var(--color-bg-surface)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div
                    style={{
                      fontSize: "var(--text-md)",
                      fontWeight: 700,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {p.title}
                  </div>
                  {scope === "all" && p.lecture != null && p.lecture && (
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-muted)",
                        marginTop: 4,
                        display: "inline-block",
                      }}
                    >
                      {lectureTitleMap.get(p.lecture) ?? `강의 #${p.lecture}`}
                    </span>
                  )}
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-muted)",
                      marginTop: 6,
                    }}
                  >
                    {new Date(p.created_at).toLocaleDateString("ko-KR")}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && canCreate && (
        <NoticeCreateModal
          scope={scope}
          scopeNodes={scopeNodes}
          scopeParams={scopeParams}
          effectiveLectureId={effectiveLectureId ?? undefined}
          sessionId={sessionId ?? undefined}
          blockTypes={categories}
          templates={templates}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["community-board-posts"] });
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function NoticeCreateModal({
  scope,
  scopeNodes,
  scopeParams,
  effectiveLectureId,
  sessionId,
  blockTypes,
  templates,
  onClose,
  onSuccess,
}: {
  scope: "all" | "lecture" | "session";
  scopeNodes: ScopeNodeMinimal[];
  scopeParams: CommunityScopeParams;
  effectiveLectureId?: number;
  sessionId?: number | null;
  blockTypes: BlockType[];
  templates: PostTemplate[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [blockTypeId, setBlockTypeId] = useState<number | null>(blockTypes[0]?.id ?? null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const qc = useQueryClient();

  const loadTemplate = (t: PostTemplate) => {
    setTitle(t.title ?? "");
    setContent(t.content ?? "");
    if (t.block_type != null) setBlockTypeId(t.block_type);
  };

  const saveAsTemplateMut = useMutation({
    mutationFn: () =>
      createPostTemplate({
        name: templateName.trim(),
        block_type: blockTypeId ?? undefined,
        title: title.trim() || undefined,
        content: content.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-post-templates"] });
      setShowSaveAsTemplate(false);
      setTemplateName("");
    },
  });

  const nodeIds = useMemo(() => {
    if (scope === "lecture" && effectiveLectureId != null) {
      const n = scopeNodes.find((x) => x.lecture === effectiveLectureId && x.session == null);
      return n ? [n.id] : [];
    }
    if (scope === "session" && effectiveLectureId != null && sessionId != null) {
      const n = scopeNodes.find(
        (x) => x.lecture === effectiveLectureId && x.session === sessionId
      );
      return n ? [n.id] : [];
    }
    if (scope === "all" && selectedNodeId != null) return [selectedNodeId];
    return [];
  }, [scope, scopeNodes, effectiveLectureId, sessionId, selectedNodeId]);

  const createMut = useMutation({
    mutationFn: () =>
      createCommunityBoardPost({
        block_type: blockTypeId ?? blockTypes[0]!.id,
        title: title.trim(),
        content: content.trim(),
        node_ids: nodeIds,
      }),
    onSuccess: () => onSuccess(),
  });

  const canSubmit =
    title.trim() &&
    content.trim() &&
    blockTypes.length > 0 &&
    (blockTypeId != null || blockTypes[0]?.id) &&
    nodeIds.length > 0;

  const courseNodes = useMemo(
    () => scopeNodes.filter((n) => n.level === "COURSE"),
    [scopeNodes]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-bg-surface)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-6)",
          maxWidth: 480,
          width: "90%",
          boxShadow: "var(--elevation-3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>공지 작성</h3>
        {templates.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>
              양식에서 불러오기
            </label>
            <select
              className="ds-input"
              style={{ width: "100%" }}
              value=""
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : 0;
                const t = templates.find((x) => x.id === id);
                if (t) loadTemplate(t);
                e.target.value = "";
              }}
            >
              <option value="">선택하세요</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.block_type_label ? ` (${t.block_type_label})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        {blockTypes.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16 }}>
            블록 타입이 없습니다. 관리자 설정에서 확인하세요.
          </p>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>
                유형
              </label>
              <select
                className="ds-input"
                value={blockTypeId ?? ""}
                onChange={(e) => setBlockTypeId(e.target.value ? Number(e.target.value) : null)}
                style={{ width: "100%" }}
              >
                {blockTypes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            {scope === "all" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>
                  노출 위치(강의)
                </label>
                <select
                  className="ds-input"
                  value={selectedNodeId ?? ""}
                  onChange={(e) => setSelectedNodeId(e.target.value ? Number(e.target.value) : null)}
                  style={{ width: "100%" }}
                >
                  <option value="">선택하세요</option>
                  {courseNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.lecture_title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>
                제목
              </label>
              <input
                className="ds-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목"
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>
                내용
              </label>
              <textarea
                className="ds-input"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="내용"
                rows={4}
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {(title.trim() || content.trim()) && (
              <Button
                intent="ghost"
                size="sm"
                onClick={() => setShowSaveAsTemplate(true)}
              >
                현재 내용을 양식으로 저장
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button intent="secondary" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button
              intent="primary"
              size="sm"
              onClick={() => createMut.mutate()}
              disabled={!canSubmit || createMut.isPending}
            >
              {createMut.isPending ? "등록 중…" : "등록"}
            </Button>
          </div>
        </div>
      </div>

      {showSaveAsTemplate && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
          onClick={() => !saveAsTemplateMut.isPending && setShowSaveAsTemplate(false)}
        >
          <div
            style={{
              background: "var(--color-bg-surface)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-5)",
              minWidth: 320,
              boxShadow: "var(--elevation-3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ marginBottom: 12, fontSize: 16, fontWeight: 700 }}>양식으로 저장</h4>
            <input
              className="ds-input"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="양식 이름 (예: 중간고사 공지)"
              style={{ width: "100%", marginBottom: 16 }}
              disabled={saveAsTemplateMut.isPending}
            />
            <div className="flex gap-2 justify-end">
              <Button
                intent="secondary"
                size="sm"
                onClick={() => setShowSaveAsTemplate(false)}
                disabled={saveAsTemplateMut.isPending}
              >
                취소
              </Button>
              <Button
                intent="primary"
                size="sm"
                onClick={() => templateName.trim() && saveAsTemplateMut.mutate()}
                disabled={!templateName.trim() || saveAsTemplateMut.isPending}
              >
                {saveAsTemplateMut.isPending ? "저장 중…" : "저장"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 블록 타입은 백엔드 시드/관리. 프론트에서 카테고리 추가 비활성화.

/** 단독 라우트용(리다이렉트 대상 등). 기본은 게시 관리 내 공지사항 탭 사용 권장. */
export default function NoticeBoardPage() {
  return <NoticeBoardContent />;
}
