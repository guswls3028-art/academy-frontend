// PATH: src/features/messages/components/TemplateExplorer.tsx
// 템플릿 저장 — 저장소 도메인과 동일한 파일 탐색기형 UI (좌측 트리 + 우측 그리드)

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FiMessageSquare, FiClock } from "react-icons/fi";
import { FilePlus } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import Breadcrumb from "@/features/storage/components/Breadcrumb";
import TemplateCategoryTree from "./TemplateCategoryTree";
import TemplateEditModal from "./TemplateEditModal";
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
import styles from "./TemplateExplorer.module.css";

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

/** 저장된 템플릿이 예약 발송용인지. 추후 API 필드 있으면 그걸로 대체 */
function isScheduledTemplate(_t: MessageTemplateItem): boolean {
  return false;
}

export type ModalOpenState = "create" | { template: MessageTemplateItem; mode: "view" | "edit" } | null;

export default function TemplateExplorer() {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<MessageTemplateCategory>("default");
  const [modalOpen, setModalOpen] = useState<ModalOpenState>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEY, activeCategory],
    queryFn: () => fetchMessageTemplates(activeCategory),
    staleTime: 30 * 1000,
  });

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
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      feedback.error(msg || "검수 신청에 실패했습니다.");
    },
  });

  const breadcrumbPath = [
    { id: null, name: "템플릿" },
    { id: activeCategory, name: TEMPLATE_CATEGORY_LABELS[activeCategory] },
  ];

  const isCreate = modalOpen === "create";
  const isEditOrView = modalOpen !== null && modalOpen !== "create";
  const editing = isEditOrView ? modalOpen.template : null;
  const openAsView = isEditOrView && modalOpen.mode === "view";
  const modalCategory = editing ? editing.category : activeCategory;

  const descriptions: Record<MessageTemplateCategory, string> = {
    default:
      "어디서나 사용할 수 있는 기본 템플릿입니다. 이름 2/3글자, 사이트 링크 블록을 사용할 수 있습니다.",
    lecture:
      "강의·차시(세션) 내 학생 선택 후 메시지 발송할 때만 사용됩니다. 강의명, 출결, 시험/과제 성적 등 블록을 사용할 수 있습니다.",
    clinic:
      "클리닉 내 학생 선택 후 메시지 발송할 때만 사용됩니다. 클리닉 합불, 클리닉 날짜 블록을 사용할 수 있습니다.",
  };

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Breadcrumb
          path={breadcrumbPath}
          onSelect={(id) => setActiveCategory((id as MessageTemplateCategory) ?? "default")}
        />
        <div className={styles.actions}>
          <Button intent="primary" size="sm" onClick={() => setModalOpen("create")}>
            <FilePlus size={16} style={{ marginRight: 6 }} />
            추가
          </Button>
        </div>
      </div>

      <div className={styles.body}>
        <aside className={styles.tree}>
          <TemplateCategoryTree currentCategory={activeCategory} onSelect={setActiveCategory} />
        </aside>

        <div className={styles.gridWrap}>
          {isLoading ? (
            <div className={styles.placeholder}>불러오는 중…</div>
          ) : templates.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
              <EmptyState
                scope="panel"
                tone="empty"
                title="저장된 템플릿이 없습니다"
                description={descriptions[activeCategory]}
                actions={
                  <Button intent="primary" size="sm" onClick={() => setModalOpen("create")}>
                    + 템플릿 추가
                  </Button>
                }
              />
            </div>
          ) : (
            <div className={styles.grid}>
              <div
                className={styles.item + " " + styles.itemAdd}
                onClick={() => setModalOpen("create")}
                title="새 템플릿 추가"
              >
                <FilePlus size={32} />
                <span>추가</span>
              </div>
              {templates.map((t) => {
                const scheduled = isScheduledTemplate(t);
                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    className={styles.item}
                    onDoubleClick={() => setModalOpen({ template: t, mode: "view" })}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("[data-action]")) return;
                    }}
                  >
                    <div className={styles.itemIcon}>
                      {scheduled ? (
                        <FiClock size={36} aria-hidden />
                      ) : (
                        <FiMessageSquare size={36} aria-hidden />
                      )}
                    </div>
                    <span className={styles.itemLabel} title={t.name}>
                      {t.name}
                    </span>
                    <span className={styles.itemMeta}>{formatDate(t.updated_at)}</span>
                    {t.solapi_status && (
                      <span
                        className={styles.itemMeta}
                        style={{
                          color:
                            t.solapi_status === "APPROVED"
                              ? "var(--color-success)"
                              : t.solapi_status === "REJECTED"
                                ? "var(--color-status-error)"
                                : "var(--color-primary)",
                        }}
                      >
                        {t.solapi_status === "PENDING" && "검수 대기"}
                        {t.solapi_status === "APPROVED" && "승인"}
                        {t.solapi_status === "REJECTED" && "반려"}
                      </span>
                    )}
                    <div className="mt-2 flex gap-1.5 flex-wrap justify-center" data-action>
                      <Button
                        intent="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalOpen({ template: t, mode: "edit" });
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
                            if (
                              window.confirm(
                                `"${t.name}" 템플릿을 카카오 알림톡 검수 신청할까요? (PFID 연동 필요)`
                              )
                            ) {
                              submitReviewMut.mutate(t.id);
                            }
                          }}
                          disabled={submitReviewMut.isPending}
                        >
                          {submitReviewMut.isPending && submitReviewMut.variables === t.id
                            ? "신청 중…"
                            : "검수 신청"}
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
          )}
        </div>
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
    </div>
  );
}
