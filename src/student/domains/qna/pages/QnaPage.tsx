/**
 * 학생 Q&A 게시판 — 관리자 앱 커뮤니티(community) API 연동
 * 목록 조회, 상세 보기, 질문 작성
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import {
  fetchPosts,
  fetchPost,
  fetchBlockTypes,
  createPost,
  type PostEntity,
  type BlockType,
} from "@/features/community/api/community.api";

const QNA_BLOCK_CODE = "qna";

export default function QnaPage() {
  const qc = useQueryClient();
  const [openedId, setOpenedId] = useState<number | null>(null);
  const [showWrite, setShowWrite] = useState(false);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["student-community-posts"],
    queryFn: () => fetchPosts({}),
  });

  const { data: blockTypes = [] } = useQuery({
    queryKey: ["community-block-types"],
    queryFn: () => fetchBlockTypes(),
  });

  const qnaBlockType = blockTypes.find((b) => (b.code || "").toLowerCase() === QNA_BLOCK_CODE) ?? blockTypes[0];
  const qnaPosts = qnaBlockType
    ? posts.filter((p) => p.block_type === qnaBlockType.id)
    : posts;

  return (
    <StudentPageShell
      title="Q&A 게시판"
      description="질문을 남기고 답변을 확인하세요."
      actions={
        (qnaBlockType ?? blockTypes[0]) && (
          <button
            type="button"
            className="stu-btn stu-btn--primary stu-btn--sm"
            onClick={() => setShowWrite(true)}
          >
            질문하기
          </button>
        )
      }
    >
      {isLoading ? (
        <div className="stu-card stu-card--soft" style={{ padding: "var(--stu-space-8)" }}>
          <div className="stu-muted">불러오는 중…</div>
        </div>
      ) : showWrite ? (
        <QnaWriteForm
          blockTypeId={qnaBlockType?.id}
          blockTypes={blockTypes}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["student-community-posts"] });
            setShowWrite(false);
          }}
          onCancel={() => setShowWrite(false)}
        />
      ) : qnaPosts.length === 0 ? (
        <EmptyState
          title="아직 질문이 없습니다."
          description="첫 질문을 남겨 보세요."
        />
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
          {qnaPosts.map((p) => (
            <li key={p.id}>
              <PostRow
                post={p}
                isOpen={openedId === p.id}
                onToggle={() => setOpenedId((id) => (id === p.id ? null : p.id))}
              />
            </li>
          ))}
        </ul>
      )}
    </StudentPageShell>
  );
}

function PostRow({
  post,
  isOpen,
  onToggle,
}: {
  post: PostEntity;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ["student-community-post", post.id],
    queryFn: () => fetchPost(post.id),
    enabled: isOpen,
  });
  const display = detail ?? post;

  return (
    <div className="stu-card stu-card--pressable" style={{ marginBottom: 0 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "var(--stu-space-4)",
          border: "none",
          background: "none",
          color: "var(--stu-text)",
          cursor: "pointer",
          font: "inherit",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 15, flex: 1, minWidth: 0 }}>
          {display.title}
        </span>
        <span className="stu-muted" style={{ fontSize: 12, flexShrink: 0 }}>
          {new Date(display.created_at).toLocaleDateString("ko-KR")}
        </span>
      </button>
      {isOpen && (
        <div
          style={{
            padding: "0 var(--stu-space-4) var(--stu-space-4)",
            borderTop: "1px solid var(--stu-border)",
            paddingTop: "var(--stu-space-4)",
          }}
        >
          {isLoading ? (
            <div className="stu-muted" style={{ fontSize: 14 }}>불러오는 중…</div>
          ) : (
            <div
              style={{
                fontSize: 14,
                color: "var(--stu-text-muted)",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              {display.content || "내용 없음"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QnaWriteForm({
  blockTypeId,
  blockTypes,
  onSuccess,
  onCancel,
}: {
  blockTypeId: number | undefined;
  blockTypes: BlockType[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const qc = useQueryClient();
  const createMut = useMutation({
    mutationFn: () =>
      createPost({
        block_type: blockTypeId ?? blockTypes[0]?.id ?? 1,
        title: title.trim(),
        content: content.trim(),
        node_ids: [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-community-posts"] });
      setTitle("");
      setContent("");
      onSuccess();
    },
  });

  const effectiveBlockTypeId = blockTypeId ?? blockTypes[0]?.id;
  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && effectiveBlockTypeId != null;

  return (
    <div className="stu-card stu-card--soft" style={{ padding: "var(--stu-space-6)" }}>
      <input
        type="text"
        placeholder="제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="stu-input"
        style={{
          width: "100%",
          marginBottom: "var(--stu-space-4)",
        }}
      />
      <textarea
        placeholder="질문 내용을 입력하세요."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        className="stu-textarea"
        style={{
          width: "100%",
          marginBottom: "var(--stu-space-4)",
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", gap: "var(--stu-space-2)", justifyContent: "flex-end" }}>
        <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          className="stu-btn stu-btn--primary stu-btn--sm"
          disabled={!canSubmit || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          {createMut.isPending ? "등록 중…" : "등록"}
        </button>
      </div>
      {createMut.isError && (
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--stu-danger)" }}>
          {createMut.error instanceof Error ? createMut.error.message : "등록에 실패했습니다."}
        </div>
      )}
    </div>
  );
}
