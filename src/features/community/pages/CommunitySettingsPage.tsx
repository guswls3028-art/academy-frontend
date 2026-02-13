// PATH: src/features/community/pages/CommunitySettingsPage.tsx
// 블록 유형·양식 관리 — 커스텀 유형 추가/수정, 자주 쓰는 글 양식 저장·편집

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBlockTypes,
  deleteBlockType,
  fetchPostTemplates,
  createPostTemplate,
  updatePostTemplate,
  deletePostTemplate,
  type BlockType,
  type PostTemplate,
} from "../api/community.api";
import { Button, EmptyState } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import BlockTypeFormModal from "../components/BlockTypeFormModal";

const SECTION_STYLE = {
  borderRadius: "var(--radius-xl)",
  border: "1px solid var(--color-border-divider)",
  background: "var(--color-bg-surface)",
  padding: "var(--space-5)",
  marginBottom: "var(--space-6)",
};

export default function CommunitySettingsPage() {
  const qc = useQueryClient();
  const [blockTypeModal, setBlockTypeModal] = useState<{ open: boolean; edit?: BlockType }>({ open: false });
  const [templateModal, setTemplateModal] = useState<{ open: boolean; edit?: PostTemplate }>({ open: false });

  const { data: blockTypes = [], isLoading: loadingTypes } = useQuery({
    queryKey: ["community-block-types"],
    queryFn: () => fetchBlockTypes(),
  });

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["community-post-templates"],
    queryFn: () => fetchPostTemplates(),
  });

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">설정</h1>
      <p
        className="mb-4"
        style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}
      >
        게시물 유형과 자주 쓰는 글 양식을 관리합니다. 유형을 추가하면 글 작성 시 선택할 수 있고, 양식은 불러와서 수정해 쓰면 됩니다.
      </p>

      {/* 블록 유형 */}
      <section style={SECTION_STYLE}>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, margin: 0 }}>
            블록 유형
          </h2>
          <Button
            intent="primary"
            size="sm"
            onClick={() => setBlockTypeModal({ open: true })}
          >
            + 유형 추가
          </Button>
        </div>
        {loadingTypes ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : blockTypes.length === 0 ? (
          <EmptyState
            scope="panel"
            title="등록된 유형이 없습니다."
            description="위 '유형 추가'로 공지·질의·오탈자 외에 필요한 유형을 만드세요."
          />
        ) : (
          <ul className="flex flex-wrap gap-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {blockTypes.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border-divider)] px-3 py-2 bg-[var(--color-bg-surface-soft)]"
              >
                <span style={{ fontWeight: 600 }}>{b.label}</span>
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>({b.code})</span>
                <Button
                  intent="ghost"
                  size="sm"
                  onClick={() => setBlockTypeModal({ open: true, edit: b })}
                >
                  수정
                </Button>
                <Button
                  intent="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`"${b.label}" 유형을 삭제할까요?`)) {
                      deleteBlockType(b.id).then(() =>
                        qc.invalidateQueries({ queryKey: ["community-block-types"] })
                      );
                    }
                  }}
                >
                  삭제
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 양식 */}
      <section style={SECTION_STYLE}>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, margin: 0 }}>
            글 양식
          </h2>
          <Button
            intent="primary"
            size="sm"
            onClick={() => setTemplateModal({ open: true })}
          >
            + 양식 추가
          </Button>
        </div>
        {loadingTemplates ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : templates.length === 0 ? (
          <EmptyState
            scope="panel"
            title="저장된 양식이 없습니다."
            description="글 작성 화면에서 '양식으로 저장'하거나 여기서 '양식 추가'로 자주 쓰는 제목·내용을 등록하세요."
          />
        ) : (
          <ul className="space-y-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {templates.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-[var(--color-border-divider)] p-3 bg-[var(--color-bg-surface-soft)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
                    {t.block_type_label && (
                      <span
                        className="inline-block rounded px-2 py-0.5 text-xs"
                        style={{ background: "var(--color-bg-muted)", color: "var(--color-text-secondary)" }}
                      >
                        {t.block_type_label}
                      </span>
                    )}
                    {t.title && (
                      <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
                        {t.title.slice(0, 60)}{t.title.length > 60 ? "…" : ""}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      intent="ghost"
                      size="sm"
                      onClick={() => setTemplateModal({ open: true, edit: t })}
                    >
                      수정
                    </Button>
                    <Button
                      intent="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm(`"${t.name}" 양식을 삭제할까요?`)) {
                          deletePostTemplate(t.id).then(() =>
                            qc.invalidateQueries({ queryKey: ["community-post-templates"] })
                          );
                        }
                      }}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {blockTypeModal.open && (
        <BlockTypeFormModal
          edit={blockTypeModal.edit}
          onClose={() => setBlockTypeModal({ open: false })}
          onSuccess={() => setBlockTypeModal({ open: false })}
        />
      )}
      {templateModal.open && (
        <PostTemplateFormModal
          edit={templateModal.edit}
          blockTypes={blockTypes}
          onClose={() => setTemplateModal({ open: false })}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["community-post-templates"] });
            setTemplateModal({ open: false });
          }}
        />
      )}
    </div>
  );
}

function PostTemplateFormModal({
  edit,
  blockTypes,
  onClose,
  onSuccess,
}: {
  edit?: PostTemplate;
  blockTypes: BlockType[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(edit?.name ?? "");
  const [blockTypeId, setBlockTypeId] = useState<number | null>(edit?.block_type ?? null);
  const [title, setTitle] = useState(edit?.title ?? "");
  const [content, setContent] = useState(edit?.content ?? "");

  const createMut = useMutation({
    mutationFn: () =>
      createPostTemplate({
        name: name.trim(),
        block_type: blockTypeId ?? undefined,
        title: title.trim() || undefined,
        content: content.trim() || undefined,
      }),
    onSuccess: () => onSuccess(),
  });
  const updateMut = useMutation({
    mutationFn: () =>
      updatePostTemplate(edit!.id, {
        name: name.trim(),
        block_type: blockTypeId ?? undefined,
        title: title.trim() || undefined,
        content: content.trim() || undefined,
      }),
    onSuccess: () => onSuccess(),
  });

  const handleSubmit = () => {
    if (!name.trim()) return;
    if (edit) updateMut.mutate();
    else createMut.mutate();
  };

  const pending = createMut.isPending || updateMut.isPending;

  return (
    <AdminModal open onClose={onClose} type="action" width={560}>
      <ModalHeader
        type="action"
        title={edit ? "양식 수정" : "양식 추가"}
        description={edit ? "양식 이름과 내용을 수정합니다." : "자주 쓰는 제목·내용을 저장해 두었다가 글 작성 시 불러올 수 있습니다."}
      />
      <ModalBody>
        <div style={{ marginBottom: 12 }}>
          <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1">
            양식 이름
          </label>
          <input
            className="ds-input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 중간고사 공지"
            disabled={pending}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1">
            기본 유형 (선택)
          </label>
          <select
            className="ds-input w-full"
            value={blockTypeId ?? ""}
            onChange={(e) => setBlockTypeId(e.target.value ? Number(e.target.value) : null)}
            disabled={pending}
          >
            <option value="">선택 안 함</option>
            {blockTypes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1">
            제목 (기본값)
          </label>
          <input
            className="ds-input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="불러올 때 채워질 제목"
            disabled={pending}
          />
        </div>
        <div style={{ marginBottom: 0 }}>
          <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1">
            내용 (기본값)
          </label>
          <textarea
            className="ds-input w-full"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="불러올 때 채워질 본문"
            rows={6}
            style={{ resize: "vertical" }}
            disabled={pending}
          />
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" size="sm" onClick={onClose} disabled={pending}>
              취소
            </Button>
            <Button
              intent="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={!name.trim() || pending}
            >
              {edit ? (updateMut.isPending ? "저장 중…" : "저장") : createMut.isPending ? "추가 중…" : "추가"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
