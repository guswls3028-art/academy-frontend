// PATH: src/features/community/pages/CommunityAdminPage.tsx
// 게시 관리: 게시판 관리(3패널) + 공지사항(ScopeSelector + 목록/작성)

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, Tree, Table, Select, Tag, message } from "antd";
import type { DataNode } from "antd/es/tree";
import {
  fetchScopeNodes,
  fetchBlockTypes,
  fetchAdminPosts,
  updatePostNodes,
  type PostEntity,
  type ScopeNodeMinimal,
} from "../api/community.api";
import { EmptyState, Button } from "@/shared/ui/ds";
import CommunityScopeSelector from "../components/CommunityScopeSelector";
import BlockTypeFormModal from "../components/BlockTypeFormModal";
import { NoticeBoardContent } from "./NoticeBoardPage";

const PAGE_SIZE = 20;

function buildTreeData(nodes: ScopeNodeMinimal[]): DataNode[] {
  const byLecture = new Map<number, ScopeNodeMinimal[]>();
  nodes.forEach((n) => {
    const arr = byLecture.get(n.lecture) ?? [];
    arr.push(n);
    byLecture.set(n.lecture, arr);
  });
  return Array.from(byLecture.entries())
    .map(([, list]) => {
      const course = list.find((n) => n.session == null);
      const sessions = list.filter((n) => n.session != null);
      if (!course) return null;
      return {
        key: String(course.id),
        title: course.lecture_title,
        children: sessions.map((s) => ({
          key: String(s.id),
          title: s.session_title ?? "차시",
        })),
      };
    })
    .filter(Boolean) as DataNode[];
}

const SUB_TAB_BOARD = "board";
const SUB_TAB_NOTICE = "notice";

export default function CommunityAdminPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const subTab = searchParams.get("tab") === SUB_TAB_NOTICE ? SUB_TAB_NOTICE : SUB_TAB_BOARD;
  const setSubTab = (tab: string) => setSearchParams(tab === SUB_TAB_BOARD ? {} : { tab });

  const [blockTypeId, setBlockTypeId] = useState<number | null>(null);
  const [lectureId, setLectureId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [selectedPost, setSelectedPost] = useState<PostEntity | null>(null);
  const [inspectorNodeIds, setInspectorNodeIds] = useState<number[]>([]);
  const [showAddBlockType, setShowAddBlockType] = useState(false);

  const { data: scopeNodes = [] } = useQuery({
    queryKey: ["community-scope-nodes"],
    queryFn: () => fetchScopeNodes(),
  });

  const { data: blockTypes = [] } = useQuery({
    queryKey: ["community-block-types"],
    queryFn: () => fetchBlockTypes(),
  });

  const { data: adminData, isLoading: loadingPosts } = useQuery({
    queryKey: ["community-admin-posts", blockTypeId, lectureId, page],
    queryFn: () =>
      fetchAdminPosts({
        blockTypeId: blockTypeId ?? undefined,
        lectureId: lectureId ?? undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const treeData = useMemo(() => buildTreeData(scopeNodes), [scopeNodes]);

  const lectureOptions = useMemo(() => {
    const seen = new Set<number>();
    return scopeNodes
      .filter((n) => n.session == null)
      .filter((n) => {
        if (seen.has(n.lecture)) return false;
        seen.add(n.lecture);
        return true;
      })
      .map((n) => ({ label: n.lecture_title, value: n.lecture }));
  }, [scopeNodes]);

  const posts = adminData?.results ?? [];
  const total = adminData?.count ?? 0;

  const columns = [
    {
      title: "제목",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (t: string, r: PostEntity) => (
        <button
          type="button"
          className="text-left font-semibold text-[var(--color-primary)] hover:underline"
          onClick={() => {
            setSelectedPost(r);
            setInspectorNodeIds(r.mappings?.map((m) => m.node) ?? []);
          }}
        >
          {t}
        </button>
      ),
    },
    {
      title: "유형",
      dataIndex: "block_type_label",
      key: "block_type_label",
      width: 100,
      render: (label: string) => <Tag>{label}</Tag>,
    },
    {
      title: "노출 노드",
      key: "nodes",
      width: 220,
      render: (_: unknown, r: PostEntity) => (
        <div className="flex flex-wrap gap-1">
          {r.mappings?.map((m) => (
            <Tag key={m.id}>{m.node_detail?.lecture_title} {m.node_detail?.session_title ? `· ${m.node_detail.session_title}` : "(전체)"}</Tag>
          )) ?? null}
        </div>
      ),
    },
    {
      title: "작성일",
      dataIndex: "created_at",
      key: "created_at",
      width: 110,
      render: (v: string) => v?.slice(0, 10),
    },
  ];

  const updateNodesMut = useMutation({
    mutationFn: ({ postId, nodeIds }: { postId: number; nodeIds: number[] }) =>
      updatePostNodes(postId, nodeIds),
    onSuccess: () => {
      message.success("노출 노드가 저장되었습니다.");
      qc.invalidateQueries({ queryKey: ["community-admin-posts"] });
      setSelectedPost(null);
    },
    onError: () => message.error("저장에 실패했습니다."),
  });

  const handleSaveNodes = () => {
    if (!selectedPost || inspectorNodeIds.length === 0) return;
    updateNodesMut.mutate({ postId: selectedPost.id, nodeIds: inspectorNodeIds });
  };

  const nodePickerOptions = useMemo(() => {
    return scopeNodes.map((n) => ({
      label: n.session_title ? `${n.lecture_title} · ${n.session_title}` : `${n.lecture_title} (전체)`,
      value: n.id,
    }));
  }, [scopeNodes]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-[var(--color-border-divider)] pb-2">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            subTab === SUB_TAB_BOARD
              ? "bg-[var(--color-primary)] text-white"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]"
          }`}
          onClick={() => setSubTab(SUB_TAB_BOARD)}
        >
          게시판 관리
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            subTab === SUB_TAB_NOTICE
              ? "bg-[var(--color-primary)] text-white"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]"
          }`}
          onClick={() => setSubTab(SUB_TAB_NOTICE)}
        >
          공지사항
        </button>
      </div>

      {subTab === SUB_TAB_NOTICE ? (
        <>
          <CommunityScopeSelector />
          <NoticeBoardContent />
        </>
      ) : (
    <Layout className="!bg-transparent !min-h-0">
        <Layout.Sider
          width={280}
          className="!bg-[var(--color-bg-surface)] !rounded-xl border border-[var(--color-border-divider)] overflow-hidden"
        >
          <div className="p-3 border-b border-[var(--color-border-divider)] font-semibold text-sm text-[var(--color-text-secondary)]">
            노출 위치 (ScopeNode)
          </div>
          <div className="p-2 overflow-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
            {treeData.length === 0 ? (
              <EmptyState scope="panel" title="노드 없음" />
            ) : (
              <Tree
                showLine
                defaultExpandAll
                treeData={treeData}
                selectable={false}
              />
            )}
          </div>
        </Layout.Sider>

        <Layout.Content className="px-4 !min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Select
              placeholder="유형"
              allowClear
              value={blockTypeId}
              onChange={setBlockTypeId}
              options={blockTypes.map((b) => ({ label: b.label, value: b.id }))}
              style={{ width: 120 }}
            />
            <Button intent="secondary" size="sm" onClick={() => setShowAddBlockType(true)}>
              + 블록 추가
            </Button>
            <Select
              placeholder="강의"
              allowClear
              value={lectureId}
              onChange={setLectureId}
              options={lectureOptions}
              style={{ width: 200 }}
            />
          </div>
          <div className="rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] overflow-hidden">
            {loadingPosts ? (
              <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={{
                  current: page,
                  pageSize: PAGE_SIZE,
                  total,
                  onChange: setPage,
                  showSizeChanger: false,
                }}
                columns={columns}
                dataSource={posts}
                locale={{ emptyText: "게시물이 없습니다." }}
              />
            )}
          </div>
        </Layout.Content>

        <Layout.Sider
          width={320}
          className="!bg-[var(--color-bg-surface)] !rounded-xl border border-[var(--color-border-divider)] overflow-hidden"
        >
          <div className="p-3 border-b border-[var(--color-border-divider)] font-semibold text-sm text-[var(--color-text-secondary)]">
            Inspector
          </div>
          <div className="p-4 overflow-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
            {!selectedPost ? (
              <EmptyState scope="panel" title="글을 선택하세요" description="중앙 목록에서 행을 클릭하세요." />
            ) : (
              <>
                <div className="mb-4">
                  <div className="font-bold text-[var(--color-text-primary)] mb-1">{selectedPost.title}</div>
                  <Tag>{selectedPost.block_type_label}</Tag>
                  <div className="text-xs text-[var(--color-text-muted)] mt-2">
                    {selectedPost.created_at?.slice(0, 16)}
                  </div>
                </div>
                <div className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                  노출 노드
                </div>
                <Select
                  mode="multiple"
                  placeholder="노드 추가"
                  value={inspectorNodeIds}
                  onChange={setInspectorNodeIds}
                  options={nodePickerOptions}
                  style={{ width: "100%", marginBottom: 12 }}
                  maxTagCount="responsive"
                />
                <div className="flex gap-2">
                  <Button intent="primary" size="sm" onClick={handleSaveNodes} loading={updateNodesMut.isPending}>
                    저장
                  </Button>
                  <Button intent="secondary" size="sm" onClick={() => setSelectedPost(null)}>
                    닫기
                  </Button>
                </div>
              </>
            )}
          </div>
        </Layout.Sider>
      </Layout>
      )}

      {showAddBlockType && (
        <BlockTypeFormModal
          onClose={() => setShowAddBlockType(false)}
          onSuccess={() => setShowAddBlockType(false)}
          onSuccessWithCreated={(block) => setBlockTypeId(block.id)}
        />
      )}
    </div>
  );
}
