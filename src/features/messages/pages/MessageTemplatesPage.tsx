// PATH: src/features/messages/pages/MessageTemplatesPage.tsx
// 템플릿 저장 — 기본 | 강의 | 클리닉 (ds-tabs), 아이콘 카드, students 도메인 UI 통일

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FiMessageSquare, FiClock } from "react-icons/fi";
import { EmptyState } from "@/shared/ui/ds";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import TemplateEditModal from "../components/TemplateEditModal";
import {
  fetchMessageTemplates,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  submitMessageTemplateReview,
  type MessageTemplateItem,
  type MessageTemplatePayload,
  type MessageTemplateCategory,
} from "../api/messages.api";
import { TEMPLATE_CATEGORY_LABELS } from "../constants/templateBlocks";
import "../styles/templateEditor.css";

const QUERY_KEY = ["messaging", "templates"] as const;

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

const CATEGORIES: MessageTemplateCategory[] = ["default", "lecture", "clinic"];

/** 저장된 템플릿이 예약 발송용인지. 추후 API 필드 있으면 그걸로 대체 */
function isScheduledTemplate(_t: MessageTemplateItem): boolean {
  return false;
}

function TemplateList({
  category,
  onAdd,
  onOpenView,
  onOpenEdit,
}: {
  category: MessageTemplateCategory;
  onAdd: () => void;
  onOpenView: (t: MessageTemplateItem) => void;
  onOpenEdit: (t: MessageTemplateItem) => void;
}) {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEY, category],
    queryFn: () => fetchMessageTemplates(category),
    staleTime: 30 * 1000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteMessageTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const submitReviewMut = useMutation({
    mutationFn: (id: number) => submitMessageTemplateReview(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      feedback.success(data.detail || "검수 신청이 완료되었습니다.");
    },
    onError: (err: unknown) => {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : null;
      feedback.error(msg || "검수 신청에 실패했습니다.");
    },
  });

  if (isLoading) {
    return (
      <div className="py-8 text-center text-[var(--color-text-muted)] text-sm">
        불러오는 중…
      </div>
    );
  }

  if (templates.length === 0) {
    const descriptions: Record<MessageTemplateCategory, string> = {
      default: "어디서나 사용할 수 있는 기본 템플릿입니다. 이름 2/3글자, 사이트 링크 블록을 사용할 수 있습니다.",
      lecture: "강의·차시(세션) 내 학생 선택 후 메시지 발송할 때만 사용됩니다. 강의명, 출결, 시험/과제 성적 등 블록을 사용할 수 있습니다.",
      clinic: "클리닉 내 학생 선택 후 메시지 발송할 때만 사용됩니다. 클리닉 합불, 클리닉 날짜 블록을 사용할 수 있습니다.",
    };
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="저장된 템플릿이 없습니다"
        description={descriptions[category]}
        actions={<Button intent="primary" size="sm" onClick={onAdd}>+ 템플릿 추가</Button>}
      />
    );
  }

  return (
    <div className="template-cards grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
      {templates.map((t) => {
        const scheduled = isScheduledTemplate(t);
        return (
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            className="template-card p-4 flex flex-col items-center text-center cursor-pointer select-none"
            onDoubleClick={() => onOpenView(t)}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("[data-action]")) return;
            }}
          >
            <div className="template-card__icon-wrap w-14 h-14 flex items-center justify-center mb-3">
              {scheduled ? (
                <FiClock size={28} aria-hidden />
              ) : (
                <FiMessageSquare size={28} aria-hidden />
              )}
            </div>
            <div className="font-medium text-[var(--color-text-primary)] text-sm truncate w-full" title={t.name}>
              {t.name}
            </div>
            <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">
              {formatDate(t.updated_at)}
            </div>
            {t.solapi_status && (
              <div className="mt-1 text-[10px] font-medium" style={{ color: t.solapi_status === "APPROVED" ? "var(--color-success)" : t.solapi_status === "REJECTED" ? "var(--color-status-error)" : "var(--color-primary)" }}>
                {t.solapi_status === "PENDING" && "검수 대기"}
                {t.solapi_status === "APPROVED" && "승인"}
                {t.solapi_status === "REJECTED" && "반려"}
              </div>
            )}
            <div className="mt-3 flex gap-1.5 flex-wrap justify-center" data-action>
              <Button
                intent="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEdit(t);
                }}
              >
                수정
              </Button>
              {t.solapi_status !== "PENDING" && t.solapi_status !== "APPROVED" && (
                <Button
                  intent="primary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`"${t.name}" 템플릿을 카카오 알림톡 검수 신청할까요? (PFID 연동 필요)`)) {
                      submitReviewMut.mutate(t.id);
                    }
                  }}
                  disabled={submitReviewMut.isPending}
                >
                  {submitReviewMut.isPending && submitReviewMut.variables === t.id ? "신청 중…" : "검수 신청"}
                </Button>
              )}
              <Button
                intent="danger"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`"${t.name}" 템플릿을 삭제할까요?`)) {
                    deleteMut.mutate(t.id);
                  }
                }}
                disabled={deleteMut.isPending}
              >
                삭제
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type ModalOpenState = "create" | { template: MessageTemplateItem; mode: "view" | "edit" } | null;

export default function MessageTemplatesPage() {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<MessageTemplateCategory>("default");
  const [modalOpen, setModalOpen] = useState<ModalOpenState>(null);

  const createMut = useMutation({
    mutationFn: (payload: MessageTemplatePayload) => createMessageTemplate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setModalOpen(null);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<MessageTemplatePayload> }) =>
      updateMessageTemplate(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setModalOpen(null);
    },
  });

  const isCreate = modalOpen === "create";
  const isEditOrView = modalOpen !== null && modalOpen !== "create";
  const editing = isEditOrView ? modalOpen.template : null;
  const openAsView = isEditOrView && modalOpen.mode === "view";
  const modalCategory = editing ? editing.category : activeCategory;

  return (
    <>
      <Panel
        variant="primary"
        title="템플릿 저장"
        description="메시지 발송 시 사용할 양식을 저장합니다. 기본·강의·클리닉 카테고리별로 관리할 수 있습니다."
      >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="ds-tabs ds-tabs--flat" role="tablist">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat}
                className={`ds-tab ${activeCategory === cat ? "is-active" : ""}`}
                onClick={() => setActiveCategory(cat)}
              >
                {TEMPLATE_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <Button intent="primary" size="sm" onClick={() => setModalOpen("create")}>
            + 템플릿 추가
          </Button>
        </div>

        <TemplateList
          category={activeCategory}
          onAdd={() => setModalOpen("create")}
          onOpenView={(t) => setModalOpen({ template: t, mode: "view" })}
          onOpenEdit={(t) => setModalOpen({ template: t, mode: "edit" })}
        />
      </div>

      <TemplateEditModal
        open={isCreate || isEditOrView}
        onClose={() => setModalOpen(null)}
        category={modalCategory}
        initial={editing ?? undefined}
        defaultLocked={openAsView}
        onSubmit={(payload) => {
          if (editing) {
            updateMut.mutate({ id: editing.id, payload });
          } else {
            createMut.mutate(payload);
          }
        }}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </>
  );
}
